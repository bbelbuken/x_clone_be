const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { updateAvatar, clearAvatar } = require('../utils/updateAvatarHelper');
const { updateHeader, clearHeader } = require('../utils/updateHeaderHelper');
const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3UploadHelper');

const getUsers = async (req, res) => {
    const users = await User.find()
        .select('-password -__v') // Exclude password and version key
        .lean();

    if (!users?.length) {
        return res.status(404).json({ message: 'No users found' });
    }

    res.status(200).json(users);
};

const getUserById = async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId)
        .select('username avatar header_photo verified email fullname')
        .lean();

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
};

const getCurrentAccount = async (req, res) => {
    const { username } = req.params;
    const user = await User.findOne({ username })
        .select('-password')
        .lean()
        .exec();
    if (!user) {
        return res.status(404).json({ message: 'No users found' });
    }

    res.json(user);
};

const createUser = async (req, res) => {
    const { username, fullname, password, email, dateOfBirth } = req.body;
    if (!username || !fullname || !password || !email || !dateOfBirth) {
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
        avatarUrl = await uploadFileToS3(
            req.file,
            'user-avatars' // S3 folder name
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
        { expiresIn: '1d' }
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
        newUser,
    });
};

const updateUser = async (req, res) => {
    const { userId } = req.params;
    const {
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

    if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
    }

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (username && username !== user.username) {
        const duplicate = await User.findOne({ username })
            .collation({ locale: 'en', strength: 2 }) // Case sensitivity
            .lean()
            .exec();
        if (duplicate) {
            return res.status(409).json({ message: 'Duplicate user' });
        }
        user.username = username;
    }

    // Handle avatar update or deletion
    if (req.files?.avatar) {
        // Delete old avatar if exists
        if (user.avatar) {
            await deleteFileFromS3(user.avatar);
        }
        // Upload new avatar
        const avatarFile = req.files.avatar[0];
        user.avatar = await uploadFileToS3(avatarFile, 'user-avatars');
    } else if (avatar === '' && user.avatar !== '') {
        // Delete avatar if empty string passed
        await deleteFileFromS3(user.avatar);
        user.avatar = '';
    }

    // Handle header photo update or deletion
    if (req.files?.header_photo) {
        // Delete old header if exists
        if (user.header_photo) {
            await deleteFileFromS3(user.header_photo);
        }
        // Upload new header
        const headerFile = req.files.header_photo[0];
        user.header_photo = await uploadFileToS3(headerFile, 'user-headers');
    } else if (header_photo === '' && user.header_photo !== '') {
        // Delete header if empty string passed
        await deleteFileFromS3(user.header_photo);
        user.header_photo = '';
    }

    if (email) user.email = email;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (fullname) user.fullname = fullname;
    if (verified !== undefined) user.verified = verified;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (password) user.password = await bcrypt.hash(password, 10);

    const updatedUser = await user.save();
    res.json({ message: `${updatedUser.username} updated`, updatedUser });
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

    // Delete avatar from S3 if exists
    if (user.avatar) {
        await deleteFileFromS3(user.avatar);
    }

    // Delete header photo from S3 if exists
    if (user.header_photo) {
        await deleteFileFromS3(user.header_photo);
    }

    // Delete user's posts
    await Post.deleteMany({ userId: id });

    // Delete the user
    await user.deleteOne();

    res.json({
        message: `${user.username} deleted`,
    });
};

const toggleFollowUser = async (req, res) => {
    const { userId } = req.params;
    const { currentUserId } = req.body;

    if (!userId || !currentUserId) {
        return res.status(400).json({ message: 'User IDs are required' });
    }

    if (userId === currentUserId) {
        return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!currentUser || !targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = currentUser.following.includes(userId);

    if (isFollowing) {
        // Unfollow the user
        currentUser.following.pull(userId);
        targetUser.followers.pull(currentUserId);
    } else {
        // Follow the user
        currentUser.following.push(userId);
        targetUser.followers.push(currentUserId);
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({
        message: isFollowing
            ? 'Unfollowed successfully'
            : 'Followed successfully',
        isFollowing: !isFollowing, // Return the new state (true if now following, false if unfollowed)
    });
};

//////////////////////////////////////////////////////////////
const uploadAvatarToUser = async (user, file) => {
    if (!file) {
        throw new Error('No file uploaded');
    }

    if (file && file !== user.avatar) {
        await updateAvatar(user, file);
    } else if (file === '' && user.avatar !== '') {
        await clearAvatar(user);
    }

    return { avatarUrl: user.avatar };
};

const uploadHeaderToUser = async (user, file) => {
    if (!file) {
        throw new Error('No header file uploaded');
    }

    if (file && file !== user.header_photo) {
        await updateHeader(user, file);
    } else if (file === '' && user.header_photo !== '') {
        await clearHeader(user);
    }

    return { headerUrl: user.header_photo };
};

const deleteAvatarFromUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!user.avatar) {
        return res.status(400).json({ message: 'No avatar to delete' });
    }

    await clearAvatar(user);

    res.status(200).json({ message: 'Avatar deleted successfully' });
};

const deleteHeaderFromUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!user.header_photo) {
        return res.status(400).json({ message: 'No header photo to delete' });
    }

    await clearHeader(user);

    res.status(200).json({ message: 'Header photo deleted successfully' });
};

module.exports = {
    getUsers,
    getUserById,
    getCurrentAccount,
    createUser,
    updateUser,
    deleteUser,
    uploadAvatarToUser,
    uploadHeaderToUser,
    deleteAvatarFromUser,
    deleteHeaderFromUser,
    toggleFollowUser,
};
