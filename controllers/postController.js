const User = require('../models/User');
const Post = require('../models/Post');
const {
    uploadFilesToS3,
    deleteFileFromS3,
} = require('../utils/s3UploadHelper');

const getPosts = async (req, res) => {
    const posts = await Post.find()
        .populate('userId') // Gets minimal user info
        .populate({
            path: 'repliedPost.userId',
            select: 'username',
            model: 'User',
        })
        .lean();

    if (!posts?.length) {
        return res.status(404).json({ message: 'No posts found' });
    }

    // Add repliedPostUsername to each post if it exists
    const postsWithReplyUsernames = posts.map((post) => ({
        ...post,
        repliedPostUsername: post.repliedPost?.userId?.username || null,
    }));

    res.status(200).json(postsWithReplyUsernames);
};

const getPostById = async (req, res) => {
    const { postId } = req.params;

    const post = await Post.findById(postId)
        .populate('userId')
        .populate('repliedPost.userId', 'username')
        .lean()
        .exec();

    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Add repliedPostUsername if this is a reply
    if (post.repliedPost?.userId) {
        post.repliedPostUsername = post.repliedPost.userId.username;
    }

    res.status(200).json(post);
};

const getRepliesForPost = async (req, res) => {
    const { postId } = req.params;

    const replies = await Post.find({
        'repliedPost._id': postId, // Mongoose automatically converts string to ObjectId
    })
        .populate('repliedPost.userId', 'username') // Get replied post author info
        .lean();

    if (!replies?.length) {
        return res
            .status(404)
            .json({ message: 'No replies found for this post' });
    }

    // Add repliedPostUsername field if reply exists
    const formattedReplies = replies.map((post) => ({
        ...post,
        repliedPostUsername: post.repliedPost?.userId?.username,
    }));

    res.status(200).json(formattedReplies);
};

const createPost = async (req, res) => {
    const { userId, content } = req.body;
    const mediaFiles = req.files || [];

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let mediaUrls = {
        image: [],
        video: [],
    };

    if (mediaFiles.length > 0) {
        // Upload files to S3 and categorize them
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

    const post = await Post.create({
        content,
        userId,
        media: mediaUrls, // Store URLs of uploaded files
    });

    if (post) {
        user.postCount += 1;
        await user.save();

        return res.status(201).json({ message: 'New post created', post });
    } else {
        return res.status(400).json({ message: 'Invalid post data received' });
    }
};

const updatePost = async (req, res) => {
    const { postId, username } = req.params;
    const { content, mediaFiles, deleteMediaUrls } = req.body;

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
    if (deleteMediaUrls?.length > 0) {
        await Promise.all(deleteMediaUrls.map((url) => deleteFileFromS3(url)));

        // Filter out deleted media
        post.media.image = post.media.image.filter(
            (url) => !deleteMediaUrls.includes(url)
        );
        post.media.video = post.media.video.filter(
            (url) => !deleteMediaUrls.includes(url)
        );
    }

    // 2. Handle adding new media
    if (mediaFiles && mediaFiles.length > 0) {
        const totalMedia = post.media.length + mediaFiles.length;
        if (totalMedia > 4) {
            return res.status(400).json({
                message: 'Maximum 4 media files are allowed per post.',
            });
        }

        const newMediaUrls = await uploadFilesToS3(mediaFiles, 'post-media');
        post.media.push(...newMediaUrls); // Add new media URLs to the existing media array
    }

    post.content = content || post.content;
    const updatedPost = await post.save();

    return res
        .status(200)
        .json({ message: 'Post updated successfully', post: updatedPost });
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
        const uploadedUrls = await uploadFilesToGoogleDrive(
            mediaFiles,
            process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
        );

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
    await repliedPost.save(); // Save the updated document

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

    //  if the post is a repost or the original post
    const isARepost = post.isARepost;
    const originalPostId = isARepost ? post.originalPost._id : post._id;

    // original post changes according to ID
    const originalPost = isARepost
        ? await Post.findById(originalPostId).exec()
        : post;

    if (!originalPost) {
        return res.status(404).json({ message: 'Original post not found' });
    }

    const hasReposted = originalPost.reactions.repostedBy.includes(userId);

    if (hasReposted) {
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
        // create a repost
        let cachedImages = [];
        let cachedAvatarUrl = null;

        if (originalPost.media?.image && originalPost.media.image.length > 0) {
            cachedImages = await Promise.all(
                originalPost.media.image.map(async (image, index) => {
                    const imgKey = `img:${originalPost._id}:${index}`;
                    let cachedImg = await redisClient.get(imgKey);

                    if (!cachedImg) {
                        const imageData = await fetchImageFromGoogleDrive(
                            image
                        );
                        await redisClient.set(imgKey, imageData, { EX: 3600 });
                        cachedImg = imageData;
                    }

                    return `data:image/jpeg;base64,${cachedImg}`;
                })
            );
        }

        const user = await User.findById(originalPost.userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (user.avatar) {
            const avatarKey = `avatar:${user._id}`;
            let cachedAvatar = await redisClient.get(avatarKey);

            if (!cachedAvatar) {
                const imageData = await fetchImageFromGoogleDrive(user.avatar);
                await redisClient.set(avatarKey, imageData, { EX: 3600 });
                cachedAvatar = imageData;
            }

            cachedAvatarUrl = `data:image/jpeg;base64,${cachedAvatar}`;
        }

        originalPost.reactions.repostedBy.push(userId);
        originalPost.isReposted = true;
        await originalPost.save();

        // fresh copy
        const repostedPost = new Post({
            userId,
            media: {
                image: [],
                video: [],
            },
            originalPost: {
                ...originalPost.toObject(),
                cachedImages,
                cachedAvatarUrl,
                user,
            },
            cachedImages,
            cachedAvatarUrl,
            isARepost: true,
        });

        await repostedPost.save();

        return res.status(200).json({
            message: 'Post reposted successfully',
            repostedPost,
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
        uploadedUrls = await uploadFilesToGoogleDrive(
            mediaFiles,
            process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
        );
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
