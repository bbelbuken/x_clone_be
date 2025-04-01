const {
    uploadToS3,
    getPresignedUrl,
    deleteFileFromS3,
} = require('../config/s3');

const uploadFileToS3 = async (file, folder) => {
    if (!file.originalname) {
        throw new Error('File name is missing');
    }
    return await uploadToS3(file, folder);
};

const uploadFilesToS3 = async (files, folder) => {
    if (files.length > 4) {
        throw new Error('Maximum 4 media files allowed');
    }
    return Promise.all(files.map((file) => uploadFileToS3(file, folder)));
};

module.exports = {
    uploadFileToS3,
    uploadFilesToS3,
    getPresignedUrl,
    deleteFileFromS3,
};
