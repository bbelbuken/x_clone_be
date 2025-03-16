const {
    fetchImageFromGoogleDrive,
    uploadFileToGoogleDrive,
    deleteFileFromGoogleDrive,
} = require('./googleDriveHelper');
const redisClient = require('../config/redis');

const updateHeader = async (user, newHeaderFile) => {
    const headerFileId = user.header_photo.split('id=')[1];
    if (user.header_photo) {
        await deleteFileFromGoogleDrive(headerFileId);
    }

    const newHeaderURL = await uploadFileToGoogleDrive(
        newHeaderFile,
        process.env.GOOGLE_DRIVE_USERHEADER_FOLDERID
    );

    user.header_photo = newHeaderURL;

    const headerKey = `header:${user._id}`;
    await redisClient.del(headerKey);

    // new cache redis
    const imageData = await fetchImageFromGoogleDrive(newHeaderURL);
    await redisClient.set(headerKey, imageData, { EX: 3600 });

    user.cachedHeaderURL = `data:image/jpeg;base64,${imageData}`;

    await user.save();

    return user;
};

const clearHeader = async (user) => {
    if (user.header_photo) {
        const headerFileId = user.header_photo.split('id=')[1];
        await deleteFileFromGoogleDrive(headerFileId);
    }

    user.header_photo = '';

    // invalidate redis
    const headerKey = `header:${user._id}`;
    await redisClient.del(headerKey);

    user.cachedHeaderURL = '';

    await user.save();

    return user;
};

module.exports = { updateHeader, clearHeader };
