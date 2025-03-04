const User = require('../models/User');
const Post = require('../models/Post');
const {
    uploadFilesToGoogleDrive,
    deleteFileFromGoogleDrive,
    fetchImageFromGoogleDrive,
    fetchVideoFromGoogleDrive,
} = require('../utils/googleDriveHelper');
const redisClient = require('../config/redis');

const getPosts = async (req, res) => {
    const posts = await Post.find().lean();
    if (!posts?.length) {
        return res.status(404).json({ message: 'No posts found' });
    }

    const postsWithCachedFiles = await Promise.all(
        posts.map(async (post) => {
            if (post.media?.image && post.media.image.length > 0) {
                const cachedImages = await Promise.all(
                    post.media.image.map(async (image, index) => {
                        const imgKey = `img:${post._id}:${index}`;
                        let cachedImg = await redisClient.get(imgKey);

                        if (!cachedImg) {
                            const imageData = await fetchImageFromGoogleDrive(
                                image
                            );

                            await redisClient.set(imgKey, imageData, {
                                EX: 3600,
                            });

                            cachedImg = imageData;
                        }

                        return `data:image/jpeg;base64,${cachedImg}`; // Return base64-encoded image
                    })
                );

                post.cachedImages = cachedImages;
            }

            posts.map(async (post) => {
                if (post.media?.video && post.media.video.length > 0) {
                    const cachedVideos = await Promise.all(
                        post.media.video.map(async (videoUrl, index) => {
                            const videoKey = `video:${post._id}:${index}`;
                            let cachedVideo = await redisClient.get(videoKey);

                            if (!cachedVideo) {
                                const videoData =
                                    await fetchVideoFromGoogleDrive(videoUrl);

                                // Cache the video data (you can decide on expiration time)
                                await redisClient.set(videoKey, videoData, {
                                    EX: 3600,
                                });

                                cachedVideo = videoData;
                            }

                            // Return video buffer data directly (instead of base64-encoded data like images)
                            return cachedVideo; // Return the video buffer
                        })
                    );

                    post.cachedVideos = cachedVideos;
                }

                return post; // Return the post with cached videos
            });

            // Process user avatar
            const user = await User.findById(post.userId);

            if (!user) {
                throw new Error('User not found'); // This will be caught by your error handler
            }

            if (user.avatar) {
                const avatarKey = `avatar:${user._id}`; // Use user._id as key for avatar in Redis
                let cachedAvatar = await redisClient.get(avatarKey);

                if (!cachedAvatar) {
                    // Fetching img data from Google Drive
                    const imageData = await fetchImageFromGoogleDrive(
                        user.avatar
                    );

                    // Cache the avatar URL for future requests
                    await redisClient.set(avatarKey, imageData, { EX: 3600 });

                    cachedAvatar = imageData;
                }

                // Add the cached avatar URL to the post object
                post.cachedAvatarUrl = `data:image/jpeg;base64,${cachedAvatar}`;
            }

            // Return the post with cached images and avatar (if available)
            return post;
        })
    );

    // Send the final response once all posts are processed
    res.status(200).json(postsWithCachedFiles);
};

const createPost = async (req, res) => {
    const { userId, content } = req.body;
    const mediaFiles = req.files; // Handle single or multiple files

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let mediaUrls = {
        image: [],
        video: [],
    };

    if (mediaFiles.length > 0) {
        // Handle multiple or single file upload
        uploadedUrls = await uploadFilesToGoogleDrive(
            mediaFiles,
            process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
        );
        uploadedUrls.forEach((fileUrl, index) => {
            const mimeType = mediaFiles[index].mimetype; // Get MIME type of the file

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
        return res.status(201).json({ message: 'New post created', post });
    } else {
        return res.status(400).json({ message: 'Invalid post data received' });
    }
};

const updatePost = async (req, res) => {
    const { postId, username } = req.params;
    const { content, mediaFiles, deleteMediaIds } = req.body;

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
    if (deleteMediaIds && deleteMediaIds.length > 0) {
        for (const mediaUrl of deleteMediaIds) {
            const fileId = mediaUrl.split('id=')[1]; // Extract the fileId from the URL
            await deleteFileFromGoogleDrive(fileId); // Delete the file from Google Drive
        }
        // Remove the deleted media from post.media array
        post.media = post.media.filter(
            (mediaUrl) => !deleteMediaIds.includes(mediaUrl)
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

        const newMediaUrls = await uploadFilesToGoogleDrive(
            mediaFiles,
            process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
        );
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
    const { username } = req.body;

    // Find the user by username to verify ownership
    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Find the post by ID
    const post = await Post.findById(postId).exec();
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }

    // Ensure the user owns the post and is verified
    if (user._id.toString() !== post.userId.toString()) {
        return res
            .status(403)
            .json({ message: 'You are not authorized to delete this post' });
    }

    if (post.media.image && post.media.image.length > 0) {
        for (const mediaUrl of post.media.image) {
            const fileId = mediaUrl.split('id=')[1];
            await deleteFileFromGoogleDrive(fileId);
        }
    }

    if (post.media.video && post.media.video.length > 0) {
        for (const mediaUrl of post.media.video) {
            const fileId = mediaUrl.split('id=')[1];
            await deleteFileFromGoogleDrive(fileId);
        }
    }

    // invalidate redis cache for the post image
    if (post.media.image && post.media.image.length > 0) {
        await Promise.all(
            post.media.image.map(async (_, index) => {
                const imgKey = `img:${post._id}:${index}`;
                await redisClient.del(imgKey);
            })
        );
    }

    await post.deleteOne();
    return res.status(200).json({ message: 'Post deleted successfully' });
};

module.exports = { getPosts, createPost, updatePost, deletePost };
