const User = require('../models/User');
const bcrypt = require('bcrypt');
const s3 = require('../config/s3');

const getUser = async (req, res) => {
    const users = await User.find().select('-password').lean();
    if (!users?.length) {
        return res.status(400).json({ message: 'No users found' });
    }
    res.json(users);
};

const createUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // ? duplicate
    const duplicate = await User.findOne({ username })
        .collation({
            locale: 'en',
            strength: 2,
        }) // case sensitivity
        .lean()
        .exec();
    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate username' });
    }

    // * hash password
    const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

    const user = await User.create({ username, password: hashedPwd });
    if (user) {
        res.status(201), json({ message: `New user ${username} created` });
    } else {
        res.status(400).json({ message: 'Invalid user data received' });
    }
};

const updateUser = async (req, res) => {
    const {
        id,
        username,
        password,
        fullname,
        verified,
        bio,
        location,
        website,
    } = req.body;

    // auth
    if (!id) {
        return res.status(400).json({ message: 'id is required' });
    } else if (!password) {
        return res.status(400).json({ message: 'password is required' });
    } else if (!username) {
        return res.status(400).json({ message: 'username is required' });
    }

    // find user
    const user = await User.findById(id).exec();
    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    }

    // ? duplicate
    const duplicate = await User.findOne({ username })
        .collation({
            locale: 'en',
            strength: 2,
        }) // case sensitivity
        .lean()
        .exec();
    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate user' });
    }

    user.username = username;
    if (fullname) user.fullname = fullname;
    if (verified !== undefined) user.verified = verified;
    if (bio) user.bio = bio;
    if (location) user.location = location;
    if (website) user.website = website;
    if (password) user.password = await bcrypt.hash(password, 10);

    const updatedUser = await user.save();

    res.json({ message: `${updatedUser.username} updated` });
};

const deleteUser = async (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ message: 'User ID Required' });
    }

    const user = await User.findById(id).exec();
    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    }

    await user.deleteOne();

    res.json({ message: `Username ${user.username} with ID ${id} deleted` });
};

module.exports = {
    getUser,
    createUser,
    updateUser,
    deleteUser,
};
