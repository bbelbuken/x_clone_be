const User = require('../models/User');
const Post = require('../models/Post');
const { deleteFileFromS3 } = require('../utils/s3Helpers');

const getPosts = async (req, res) => {
    const posts = await Post.find().lean().populate('UserId', 'username');
    if (!posts?.length) {
        return res.status(400).json({ message: 'No posts found' });
    }

    res.status(200).json(posts);
};

const createPosts = async;
