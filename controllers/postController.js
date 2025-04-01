const User = require('../models/User');
const Post = require('../models/Post');
const {
    uploadFilesToS3,
    deleteFileFromS3,
    getPresignedUrl,
} = require('../utils/s3UploadHelper');
const mongoose = require('mongoose');

const getPosts = async (req, res) => {
    const posts = await Post.find()
        .populate({
            path: 'repliedPost.userId',
            select: 'username',
            model: 'User',
        })
        .lean();

    if (!posts?.length) {
        return res.status(404).json({ message: 'No posts found' });
    }

    // Process posts to add presigned URLs and reply usernames
    const processedPosts = await Promise.all(
        posts.map(async (post) => {
            // Generate presigned URLs for media
            const mediaWithUrls = {
                image: await Promise.all(
                    (post.media?.image || []).map((key) => getPresignedUrl(key))
                ),
                video: await Promise.all(
                    (post.media?.video || []).map((key) => getPresignedUrl(key))
                ),
            };

            return {
                ...post,
                media: mediaWithUrls,
                repliedPostUsername: post.repliedPost?.userId?.username || null,
            };
        })
    );

    res.status(200).json(processedPosts);
};

const getPostById = async (req, res) => {
    const { postId } = req.params;

    const post = await Post.findById(postId)
        .populate('repliedPost.userId')
        .lean()
        .exec();

    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Generate presigned URLs for media
    if (post.media?.image?.length) {
        post.media.image = await Promise.all(
            post.media.image.map((key) => getPresignedUrl(key))
        );
    }

    if (post.media?.video?.length) {
        post.media.video = await Promise.all(
            post.media.video.map((key) => getPresignedUrl(key))
        );
    }

    if (post.repliedPost?.userId) {
        post.repliedPostUsername = post.repliedPost.userId.username;
    }

    res.status(200).json(post);
};

const getRepliesForPost = async (req, res) => {
    const { postId } = req.params;

    // Convert postId to ObjectId for proper comparison
    const objectIdPostId = new mongoose.Types.ObjectId(postId);

    const replies = await Post.find({
        'repliedPost._id': objectIdPostId,
    })
        .populate('repliedPost.userId', 'username')
        .lean();

    if (!replies?.length) {
        return res
            .status(404)
            .json({ message: 'No replies found for this post' });
    }

    const repliesWithUrls = await Promise.all(
        replies.map(async (post) => {
            const formattedPost = { ...post };

            // Process images
            if (post.media?.image?.length) {
                formattedPost.media.image = await Promise.all(
                    post.media.image.map((key) => getPresignedUrl(key))
                );
            }

            // Process videos
            if (post.media?.video?.length) {
                formattedPost.media.video = await Promise.all(
                    post.media.video.map((key) => getPresignedUrl(key))
                );
            }

            // Maintain repliedPostUsername
            formattedPost.repliedPostUsername =
                post.repliedPost?.userId?.username;

            return formattedPost;
        })
    );

    res.status(200).json(repliesWithUrls);
};

const createPost = async (req, res) => {
    const { userId, content } = req.body;
    const mediaFiles = req.files || [];

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let mediaKeys = {
        image: [],
        video: [],
    };

    if (mediaFiles.length > 0) {
        // Upload files to S3 and get their keys
        const uploadedKeys = await uploadFilesToS3(mediaFiles, 'post-media');

        // Categorize them by type
        uploadedKeys.forEach((key, index) => {
            const mimeType = mediaFiles[index].mimetype;
            if (mimeType.startsWith('image/')) {
                mediaKeys.image.push(key);
            } else if (mimeType.startsWith('video/')) {
                mediaKeys.video.push(key);
            }
        });
    }

    const post = await Post.create({
        content,
        userId,
        media: mediaKeys, // Store only the S3 keys
    });

    if (post) {
        user.postCount += 1;
        await user.save();

        // Generate presigned URLs for the response
        const responsePost = post.toObject();
        responsePost.media.image = await Promise.all(
            post.media.image.map((key) => getPresignedUrl(key))
        );
        responsePost.media.video = await Promise.all(
            post.media.video.map((key) => getPresignedUrl(key))
        );

        return res.status(201).json({
            message: 'New post created',
            post: responsePost,
        });
    } else {
        return res.status(400).json({ message: 'Invalid post data received' });
    }
};

const updatePost = async (req, res) => {
    const { postId, username } = req.params;
    const { content, deleteMediaKeys } = req.body; // Changed from deleteMediaUrls to deleteMediaKeys
    const mediaFiles = req.files || []; // Get files from multer

    if (!postId || !username) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // check if user is verified
    if (user._id.toString() !== post.userId.toString() || !user.verified) {
        return res.status(403).json({
            message:
                'You are not authorized to edit this post or you are not a verified user',
        });
    }

    // 1. Handle deletion of media
    if (deleteMediaKeys?.length > 0) {
        await Promise.all(deleteMediaKeys.map((key) => deleteFromS3(key)));

        // Filter out deleted media
        post.media.image = post.media.image.filter(
            (key) => !deleteMediaKeys.includes(key)
        );
        post.media.video = post.media.video.filter(
            (key) => !deleteMediaKeys.includes(key)
        );
    }

    // 2. Handle adding new media
    if (mediaFiles.length > 0) {
        const totalMedia =
            post.media.image.length +
            post.media.video.length +
            mediaFiles.length;
        if (totalMedia > 4) {
            return res.status(400).json({
                message: 'Maximum 4 media files are allowed per post.',
            });
        }

        const uploadedKeys = await Promise.all(
            mediaFiles.map((file) => uploadToS3(file, 'post-media'))
        );

        // Categorize new media
        mediaFiles.forEach((file, index) => {
            const type = file.mimetype.startsWith('image/') ? 'image' : 'video';
            post.media[type].push(uploadedKeys[index]);
        });
    }

    post.content = content || post.content;
    const updatedPost = await post.save();

    // Generate presigned URLs for the response
    const responsePost = updatedPost.toObject();
    responsePost.media.image = await Promise.all(
        updatedPost.media.image.map((key) => getPresignedUrl(key))
    );
    responsePost.media.video = await Promise.all(
        updatedPost.media.video.map((key) => getPresignedUrl(key))
    );

    return res.status(200).json({
        message: 'Post updated successfully',
        post: responsePost,
    });
};

const deletePost = async (req, res) => {
    const { postId } = req.params;

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const user = await User.findById(post.userId).exec();
    if (user) {
        user.postCount -= 1;
        await user.save();
    }

    if (post.repliedPost) {
        const originalPost = await Post.findById(post.repliedPost._id).exec();
        if (originalPost) {
            originalPost.reactions.replyCount -= 1;
            originalPost.reactions.repliedBy =
                originalPost.reactions.repliedBy.filter(
                    (id) => id.toString() !== post.userId.toString()
                );
            await originalPost.save();
        }
    }

    // Delete media files from S3
    const deleteMediaPromises = [];

    // Delete all image files
    if (post.media?.image?.length > 0) {
        post.media.image.forEach((mediaUrl) => {
            deleteMediaPromises.push(deleteFileFromS3(mediaUrl));
        });
    }

    // Delete all video files
    if (post.media?.video?.length > 0) {
        post.media.video.forEach((mediaUrl) => {
            deleteMediaPromises.push(deleteFileFromS3(mediaUrl));
        });
    }

    // Wait for all media deletions to complete
    await Promise.all(deleteMediaPromises);

    await post.deleteOne();
    return res.status(200).json({ message: 'Post deleted successfully' });
};

const likePost = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const userIndex = post.reactions.likedBy.indexOf(userId);

    if (userIndex === -1) {
        post.reactions.likedBy.push(userId);
    } else {
        post.reactions.likedBy.splice(userIndex, 1);
    }

    await post.save();

    res.status(200).json({ likeCount: post.reactions.likeCount });
};

const bookmarkPost = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const userIndex = post.reactions.bookmarkedBy.indexOf(userId);

    if (userIndex === -1) {
        post.reactions.bookmarkedBy.push(userId);
    } else {
        post.reactions.bookmarkedBy.splice(userIndex, 1);
    }

    await post.save();

    res.status(200).json({ bookmarkedBy: post.reactions.bookmarkedBy });
};

const replyToPost = async (req, res) => {
    const { postId } = req.params;
    const { userId, content } = req.body;
    const mediaFiles = req.files || [];

    if (!userId || (!content && (!mediaFiles || mediaFiles.length === 0))) {
        return res.status(400).json({
            message: 'User ID and either content or media are required',
        });
    }

    const repliedPost = await Post.findById(postId).exec();
    if (!repliedPost) {
        return res.status(404).json({ message: 'Post not found' });
    }

    let mediaUrls = {
        image: [],
        video: [],
    };

    if (mediaFiles && mediaFiles.length > 0) {
        const uploadedUrls = await uploadFilesToS3(mediaFiles, 'post-media');

        uploadedUrls.forEach((fileUrl, index) => {
            const mimeType = mediaFiles[index].mimetype;
            if (mimeType.startsWith('image/')) {
                mediaUrls.image.push(fileUrl);
            } else if (mimeType.startsWith('video/')) {
                mediaUrls.video.push(fileUrl);
            }
        });
    }

    const replyPost = await Post.create({
        userId,
        content,
        media: mediaUrls,
        repliedPost: {
            ...repliedPost.toObject(),
            _id: repliedPost._id,
            userId: repliedPost.userId,
            content: repliedPost.content,
            media: repliedPost.media,
        },
    });

    // Push the userId into the repliedBy array and save the document
    repliedPost.reactions.repliedBy.push(userId);
    await repliedPost.save();

    res.status(201).json({ message: 'Reply created successfully', replyPost });
};

const incrementView = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the user has already viewed the post
    if (!post.reactions.viewedBy.includes(userId)) {
        post.reactions.viewedBy.push(userId);
        post.reactions.viewCount = post.reactions.viewedBy.length; // Update viewCount based on viewedBy length
        await post.save();
    }

    res.status(200).json({
        viewCount: post.reactions.viewCount,
        viewedBy: post.reactions.viewedBy,
    });
};

const repostPost = async (req, res) => {
    const { postId } = req.params;
    const { userId } = req.body;

    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    const isARepost = post.isARepost;
    const originalPostId = isARepost ? post.originalPost._id : post._id;
    const originalPost = isARepost
        ? await Post.findById(originalPostId).exec()
        : post;

    if (!originalPost) {
        return res.status(404).json({ message: 'Original post not found' });
    }

    const hasReposted = originalPost.reactions.repostedBy.includes(userId);

    if (hasReposted) {
        // Handle un-repost
        originalPost.reactions.repostedBy =
            originalPost.reactions.repostedBy.filter(
                (id) => id.toString() !== userId
            );
        originalPost.isReposted = false;
        await originalPost.save();

        await Post.findOneAndDelete({
            userId,
            'originalPost._id': originalPost._id,
        });

        return res.status(200).json({
            message: 'Repost removed successfully',
            originalPost,
        });
    } else {
        // Handle new repost
        const user = await User.findById(originalPost.userId);
        if (!user) {
            throw new Error('User not found');
        }

        originalPost.reactions.repostedBy.push(userId);
        originalPost.isReposted = true;
        await originalPost.save();

        // Generate presigned URLs for the original post's media
        const originalPostWithUrls = {
            ...originalPost.toObject(),
            media: {
                image: await Promise.all(
                    originalPost.media.image.map((key) => getPresignedUrl(key))
                ),
                video: await Promise.all(
                    originalPost.media.video.map((key) => getPresignedUrl(key))
                ),
            },
            user,
        };

        const repostedPost = new Post({
            userId,
            media: {
                image: [],
                video: [],
            },
            originalPost: originalPostWithUrls,
            isARepost: true,
        });

        await repostedPost.save();

        // Generate presigned URLs for the response
        const response = {
            ...repostedPost.toObject(),
            originalPost: originalPostWithUrls,
        };

        return res.status(200).json({
            message: 'Post reposted successfully',
            repostedPost: response,
        });
    }
};

const quotePost = async (req, res) => {
    const { postId } = req.params;
    const { userId, quoteContent } = req.body;
    const mediaFiles = req.files || [];

    const originalPost = await Post.findById(postId);
    if (!originalPost) {
        return res.status(404).json({ message: 'Post not found' });
    }

    let mediaUrls = {
        image: [],
        video: [],
    };

    if (mediaFiles.length > 0) {
        const uploadedUrls = await uploadFilesToS3(mediaFiles, 'post-media');

        uploadedUrls.forEach((fileUrl, index) => {
            const mimeType = mediaFiles[index].mimetype;
            if (mimeType.startsWith('image/')) {
                mediaUrls.image.push(fileUrl);
            } else if (mimeType.startsWith('video/')) {
                mediaUrls.video.push(fileUrl);
            }
        });
    }

    const userIndex = originalPost.reactions.quotedBy.indexOf(userId);
    if (userIndex === -1) {
        originalPost.reactions.quotedBy.push(userId);
    } else {
        originalPost.reactions.quotedBy.splice(userIndex, 1);
    }

    await originalPost.save();

    const quotedPost = new Post({
        userId,
        content: quoteContent,
        media: mediaUrls,
        originalPost: originalPost,
    });

    await quotedPost.save();

    res.status(200).json({
        message: 'Post quoted successfully',
        quotedPost,
    });
};

module.exports = {
    getPosts,
    getPostById,
    getRepliesForPost,
    createPost,
    updatePost,
    deletePost,
    likePost,
    bookmarkPost,
    replyToPost,
    incrementView,
    repostPost,
    quotePost,
};
