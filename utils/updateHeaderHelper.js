const { uploadFileToS3, deleteFromS3 } = require('./s3UploadHelper');

const updateHeader = async (user, newHeaderFile) => {
    if (user.header_photo) {
        await deleteFromS3(user.header_photo);
    }

    const newHeaderURL = await uploadFileToS3(newHeaderFile, 'headers');

    user.header_photo = newHeaderURL;
    await user.save();

    return user;
};

const clearHeader = async (user) => {
    if (user.header_photo) {
        await deleteFromS3(user.header_photo);
    }

    user.header_photo = '';
    await user.save();

    return user;
};

module.exports = { updateHeader, clearHeader };
