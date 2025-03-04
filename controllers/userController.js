const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    deleteFileFromGoogleDrive,
    uploadFileToGoogleDrive,
} = require('../utils/googleDriveHelper');
const redisClient = require('../config/redis');

const getUsers = async (req, res) => {
    const users = await User.find().select('-password').lean();
    if (!users?.length) {
        return res.status(404).json({ message: 'No users found' });
    }
    res.json(users);
};

const getUserById = async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'No users found' });
    }
    res.json(user);
};

const createUser = async (req, res) => {
    const { username, fullname, password, email, dateOfBirth } = req.body;
    if (!username || !fullname || !password || !email || !dateOfBirth) {
        console.log('req.body:', req.body);
        console.log('req.file:', req.file);
        return res.status(400).json({ message: 'All fields are required' });
    }

    // ? duplicate
    const duplicate = await User.findOne({
        $or: [{ username }, { email }],
    })
        .collation({
            locale: 'en',
            strength: 2,
        }) // case sensitivity
        .lean()
        .exec();
    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate username or email' });
    }

    let avatarUrl = '';

    if (req.file) {
        avatarUrl = await uploadFileToGoogleDrive(
            req.file,
            process.env.GOOGLE_DRIVE_USERAVATAR_FOLDERID
        );
    }

    // * hash password
    const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

    const newUser = await User.create({
        username,
        fullname,
        password: hashedPwd,
        email,
        dateOfBirth,
        avatar: avatarUrl,
    });
    if (!newUser) {
        res.status(400).json({ message: 'Invalid user data received' });
    }

    const accessToken = jwt.sign(
        {
            UserInfo: { username: newUser.username },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
        { username: newUser.username },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );

    res.cookie('jwt', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
        message: `New user ${username} created`,
        accessToken,
    });
};

const updateUser = async (req, res) => {
    const {
        id,
        username,
        password,
        email,
        dateOfBirth,
        fullname,
        verified,
        bio,
        location,
        website,
        avatar,
        header_photo,
    } = req.body;

    // auth
    if (!id) {
        return res.status(400).json({ message: 'id is required' });
    }

    // find user by ID
    const user = await User.findById(id).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // ? duplicate
    if (username && username !== user.username) {
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
    }

    if (email) user.email = email;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (fullname) user.fullname = fullname;
    if (verified !== undefined) user.verified = verified;
    if (req.body.hasOwnProperty('bio')) user.bio = bio;
    if (req.body.hasOwnProperty('location')) user.location = location;
    if (req.body.hasOwnProperty('website')) user.website = website;
    if (password) user.password = await bcrypt.hash(password, 10);

    if (avatar && avatar !== user.avatar) {
        await deleteFileFromGoogleDrive(user.avatar);
        user.avatar = avatar;
    } else if (avatar === '' && user.avatar !== '') {
        await deleteFileFromGoogleDrive(user.avatar);
        user.avatar = '';
    }

    if (header_photo && header_photo !== user.header_photo) {
        await deleteFileFromGoogleDrive(user.header_photo);
        user.header_photo = header_photo;
    } else if (header_photo === '' && user.header_photo !== '') {
        await deleteFileFromGoogleDrive(user.header_photo);
        user.header_photo = '';
    }

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
        return res.status(404).json({ message: 'User not found' });
    }

    if (user.avatar) {
        const avatarUrl = user.avatar.split('id=')[1];
        if (avatarUrl) {
            const avatarKey = `avatar:${user._id}`;
            await redisClient.del(avatarKey);
            await deleteFileFromGoogleDrive(avatarUrl);
        } else {
            console.error('Invalid avatar URL formate');
        }
    }

    if (user.header_photo) {
        const headerUrl = user.header_photo.split('id=')[1];
        if (headerUrl) {
            await deleteFileFromGoogleDrive(headerUrl);
        } else {
            console.error('Invalid header URL formate');
        }
    }

    await Post.deleteMany({ userId: id });
    await user.deleteOne();

    res.json({
        message: `${user.username} deleted`,
    });
};

//////////////////////////////////////////////////////////////

const uploadAvatarToUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // ? Check if a file is uploaded
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    if (user.avatar) {
        return res
            .status(409)
            .json({ message: `${username} has already got an avatar` });
    }

    // Upload the file to drive and store the URL
    const avatarUrl = await uploadFileToGoogleDrive(
        req.file,
        process.env.GOOGLE_DRIVE_USERAVATAR_FOLDERID
    );

    // Store the Google Drive URL in the user's header field
    user.avatar = avatarUrl;
    await user.save();

    res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatarUrl: avatarUrl, // Return the Google Drive URL of the uploaded avatar
    });
};

const uploadHeaderToUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Check if a file is uploaded
    if (!req.file) {
        return res.status(400).json({ message: 'No header file uploaded' });
    }

    if (user.header_photo) {
        return res
            .status(409)
            .json({ message: `${username} has already got an header photo` });
    }

    // Upload the file to drive and store the URL
    const headerUrl = await uploadFileToGoogleDrive(
        req.file,
        process.env.GOOGLE_DRIVE_USERHEADER_FOLDERID
    );

    // Store the Google Drive URL in the user's header field
    user.header_photo = headerUrl;
    await user.save();

    res.status(200).json({
        message: 'Header uploaded successfully',
        headerUrl: headerUrl, // Return the Google Drive URL of the uploaded HEADER
    });
};

const deleteAvatarFromUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // ? Check if the user already has an avatar
    if (!user.avatar) {
        return res.status(400).json({ message: 'No avatar to delete' });
    }

    // Extract the file ID from the Google Drive URL
    const avatarFileId = user.avatar.split('id=')[1]; // Extract the file ID from the URL

    // Delete the avatar file from Google Drive
    await deleteFileFromGoogleDrive(avatarFileId);

    // Remove the avatar field from the user's document
    user.avatar = '';
    await user.save();

    res.status(200).json({ message: 'Avatar deleted successfully' });
};

const deleteHeaderFromUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // ? Check if the user already has an header
    if (!user.header_photo) {
        return res.status(400).json({ message: 'No header photo to delete' });
    }

    // Extract the file ID from the Google Drive URL
    const headerPhotoFileId = user.header_photo.split('id=')[1]; // Extract the file ID from the URL

    // Delete the header photo file from Google Drive
    await deleteFileFromGoogleDrive(headerPhotoFileId);

    user.header_photo = '';
    await user.save();

    res.status(200).json({ message: 'Header photo deleted successfully' });
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    uploadAvatarToUser,
    uploadHeaderToUser,
    deleteAvatarFromUser,
    deleteHeaderFromUser,
};
