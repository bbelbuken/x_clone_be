const {
    fetchImageFromGoogleDrive,
    uploadFileToGoogleDrive,
    deleteFileFromGoogleDrive,
} = require('./googleDriveHelper');
const redisClient = require('../config/redis');

const updateAvatar = async (user, newAvatarFile) => {
    const avatarFileId = user.avatar.split('id=')[1];
    if (user.avatar) {
        await deleteFileFromGoogleDrive(avatarFileId);
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

    await user.save();

    return user;
};

const clearAvatar = async (user) => {
    if (user.avatar) {
        const avatarFileId = user.avatar.split('id=')[1];
        await deleteFileFromGoogleDrive(avatarFileId);
    }

    user.avatar = '';

    // invalidate redis
    const avatarKey = `avatar:${user._id}`;
    await redisClient.del(avatarKey);

    user.cachedAvatarUrl = '';

    await user.save();

    return user;
};

module.exports = { updateAvatar, clearAvatar };
