const {
    fetchImageFromGoogleDrive,
    uploadFileToGoogleDrive,
    deleteFileFromGoogleDrive,
} = require('./googleDriveHelper');
const redisClient = require('../config/redis');

const updateAvatar = async (user, newAvatarFile) => {
    if (user.avatar) {
        await deleteFileFromGoogleDrive(user.avatar);
    }

    const newAvatarUrl = await uploadFileToGoogleDrive(
        newAvatarFile,
        process.env.GOOGLE_DRIVE_USERAVATAR_FOLDERID
    );

    user.avatar = newAvatarUrl;

    const avatarKey = `avatar:${user._id}`;
    await redisClient.del(avatarKey);

    // new cache redis
    const imageData = await fetchImageFromGoogleDrive(newAvatarUrl);
    await redisClient.set(avatarKey, imageData, { EX: 3600 });

    user.cachedAvatarUrl = `data:image/jpeg;base64,${imageData}`;

    return user;
};

const clearAvatar = async (user) => {
    if (user.avatar) {
        await deleteFileFromGoogleDrive(user.avatar);
    }

    user.avatar = '';

    // invalidate redis
    const avatarKey = `avatar:${user._id}`;
    await redisClient.del(avatarKey);

    user.cachedAvatarUrl = '';

    return user;
};

module.exports = { updateAvatar, clearAvatar };
