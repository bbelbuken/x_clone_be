const { uploadFileToS3, deleteFromS3 } = require('./s3UploadHelper');

const updateAvatar = async (user, newAvatarFile) => {
    if (user.avatar) {
        await deleteFromS3(user.avatar);
    }

    const newAvatarUrl = await uploadFileToS3(newAvatarFile, 'user-avatars');

    user.avatar = newAvatarUrl;
    await user.save();

    return user;
};

const clearAvatar = async (user) => {
    if (user.avatar) {
        await deleteFromS3(user.avatar);
    }

    user.avatar = '';
    await user.save();

    return user;
};

module.exports = { updateAvatar, clearAvatar };
