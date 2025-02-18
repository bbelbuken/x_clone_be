const User = require('../models/User');
const Post = require('../models/Post');
const { uploadFilesToGoogleDrive } = require('../utils/googleDriveHelper');

const getPosts = async (req, res) => {
    const posts = await Post.find().lean().populate('UserId', 'username');
    if (!posts?.length) {
        return res.status(404).json({ message: 'No posts found' });
    }

    res.status(200).json(posts);
};

const createPost = async (req, res) => {
    const { userId, content } = req.body;
    const mediaFiles = req.files || [];

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    let mediaUrls = [];
    if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
            const mediaUrl = await uploadFilesToGoogleDrive(
                file,
                process.env.GOOGLE_DRIVE_POSTMEDIA_FOLDERID
            );
            mediaUrls.push(mediaUrl);
        }
    }

    const post = await Post.create({
        content,
        userId,
        media: mediaUrls,
    });

    if (post) {
        return res.status(201).json({ message: 'New note created', post });
    } else {
        return res.status(400).json({ message: 'Invalid note data received' });
    }
};
