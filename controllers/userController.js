const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    fetchImageFromGoogleDrive,
    deleteFileFromGoogleDrive,
    uploadFileToGoogleDrive,
} = require('../utils/googleDriveHelper');
const redisClient = require('../config/redis');
const { updateAvatar, clearAvatar } = require('../utils/updateAvatarHelper');
const { updateHeader, clearHeader } = require('../utils/updateHeaderHelper');

const getUsers = async (req, res) => {
    const users = await User.find().select('-password').lean();
    if (!users?.length) {
        return res.status(404).json({ message: 'No users found' });
    }

    const usersWithCachedFiles = await Promise.all(
        users.map(async (user) => {
            if (user.avatar) {
                const avatarKey = `avatar:${user._id}`;
                let cachedAvatar = await redisClient.get(avatarKey);

                if (!cachedAvatar) {
                    const imageData = await fetchImageFromGoogleDrive(
                        user.avatar
                    );

                    await redisClient.set(avatarKey, imageData, { EX: 3600 });

                    cachedAvatar = imageData;
                }

                user.cachedAvatar = `data:image/jpeg;base64,${cachedAvatar}`;
            }

            if (user.header_photo) {
                const headerKey = `header:${user._id}`;
                let cachedHeader = await redisClient.get(headerKey);

                if (!cachedHeader) {
                    const imageData = await fetchImageFromGoogleDrive(
                        user.header_photo
                    );

                    await redisClient.set(headerKey, imageData, { EX: 3600 });

                    cachedHeader = imageData;
                }

                user.cachedHeader = `data:image/jpeg;base64,${cachedHeader}`;
            }
            return user;
        })
    );

    res.status(200).json(usersWithCachedFiles);
};

const getUserById = async (req, res) => {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'No users found' });
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

    if (user.avatar) {
        const avatarKey = `avatar:${user._id}`;
        let cachedAvatar = await redisClient.get(avatarKey);

        if (!cachedAvatar) {
            const imageData = await fetchImageFromGoogleDrive(user.avatar);

            await redisClient.set(avatarKey, imageData, { EX: 3600 });

            cachedAvatar = imageData;
        }

        user.cachedAvatar = `data:image/jpeg;base64,${cachedAvatar}`;
    }

    if (user.header_photo) {
        const headerKey = `header:${user._id}`;
        let cachedHeader = await redisClient.get(headerKey);

        if (!cachedHeader) {
            const imageData = await fetchImageFromGoogleDrive(
                user.header_photo
            );

            await redisClient.set(headerKey, imageData, { EX: 3600 });

            cachedHeader = imageData;
        }

        user.cachedHeader = `data:image/jpeg;base64,${cachedHeader}`;
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

    if (newUser.avatar) {
        const avatarKey = `avatar:${newUser._id}`;
        let cachedAvatar = await redisClient.get(avatarKey);

        if (!cachedAvatar) {
            const imageData = await fetchImageFromGoogleDrive(newUser.avatar);

            await redisClient.set(avatarKey, imageData, { EX: 3600 });

            cachedAvatar = imageData;
        }

        newUser.cachedAvatar = `data:image/jpeg;base64,${cachedAvatar}`;
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
        newUser,
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

    //  avatar update
    if (avatar && avatar !== user.avatar) {
        await updateAvatar(user, avatar);
    } else if (avatar === '' && user.avatar !== '') {
        await clearAvatar(user);
    }

    //  header photo update
    if (header_photo && header_photo !== user.header_photo) {
        if (user.header_photo) {
            await deleteFileFromGoogleDrive(user.header_photo);
        }
        user.header_photo = header_photo;
    } else if (header_photo === '' && user.header_photo !== '') {
        await deleteFileFromGoogleDrive(user.header_photo);
        user.header_photo = '';
    }

    if (email) user.email = email;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (fullname) user.fullname = fullname;
    if (verified !== undefined) user.verified = verified;
    if (req.body.hasOwnProperty('bio')) user.bio = bio;
    if (req.body.hasOwnProperty('location')) user.location = location;
    if (req.body.hasOwnProperty('website')) user.website = website;
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
        return res.status(404).json({ message: 'User not found' });
    }

    // Clear the avatar using clearAvatar
    if (user.avatar) {
        await clearAvatar(user);
    }

    // Clear the header photo
    if (user.header_photo) {
        const headerUrl = user.header_photo.split('id=')[1];
        if (headerUrl) {
            await deleteFileFromGoogleDrive(headerUrl);
        } else {
            console.error('Invalid header URL format');
        }
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

const uploadAvatarToUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    if (req.file && req.file !== user.avatar) {
        await updateAvatar(user, req.file);
    } else if (req.file === '' && user.avatar !== '') {
        await clearAvatar(user); // Use clearAvatar here
    }

    res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatarUrl: user.avatar,
    });
};

const uploadHeaderToUser = async (req, res) => {
    const { username } = req.params;

    const user = await User.findOne({ username }).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No header file uploaded' });
    }
    if (req.file && req.file !== user.header_photo) {
        await updateHeader(user, req.file);
    } else if (req.file === '' && user.avatar !== '') {
        await clearHeader(user);
    }

    res.status(200).json({
        message: 'Avatar uploaded successfully',
        headerURL: user.header_photo,
    });
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
