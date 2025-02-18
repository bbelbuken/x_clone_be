const User = require('../models/User');
const Post = require('../models/Post');
const {
    uploadFilesToGoogleDrive,
    deleteFileFromGoogleDrive,
} = require('../utils/googleDriveHelper');

const getPosts = async (req, res) => {
    const posts = await Post.find().lean().populate('userId', 'username');
    if (!posts?.length) {
        return res.status(404).json({ message: 'No posts found' });
    }

    res.status(200).json(posts);
};

const createPost = async (req, res) => {
    const { userId, content } = req.body;
    const mediaFiles = req.files || (req.file ? [req.file] : []); // Handle single or multiple files

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let mediaUrls = {
        image: '',
        video: '',
    };

    if (mediaFiles.length > 0) {
        // Handle multiple or single file upload
        uploadedUrls = await uploadFilesToGoogleDrive(
            mediaFiles,
            process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
        );
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
    console.log(req.params);

    const { postId, username } = req.params;

    console.log('username from requested params', username);

    // Find the user by username to verify ownership
    const user = await User.findOne({ username }).exec();
    if (!user) {
        console.log('user not found with a username', username);

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

    if (post.media && post.media.length > 0) {
        for (const mediaUrl of post.media) {
            const fileId = mediaUrl.split('id=')[1];
            await deleteFileFromGoogleDrive(fileId);
        }
    }

    await post.deleteOne();
    return res.status(200).json({ message: 'Post deleted successfully' });
};

module.exports = { getPosts, createPost, updatePost, deletePost };
