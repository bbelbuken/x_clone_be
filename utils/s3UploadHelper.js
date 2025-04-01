const { uploadFile, deleteFile } = require('../config/s3');

const uploadFileToS3 = async (file, folder) => {
    if (!file.originalname) {
        throw new Error('File name is missing');
    }
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;
    return await uploadFile(file.buffer, fileName, file.mimetype);
};

const uploadFilesToS3 = async (files, folder) => {
    if (files.length > 4) {
        throw new Error('Maximum 4 media files allowed');
    }
    return Promise.all(files.map((file) => uploadFileToS3(file, folder)));
};

const deleteFileFromS3 = async (fileUrl) => {
    const url = new URL(fileUrl);
    const fileKey = url.pathname.substring(1);
    await deleteFile(fileKey);
};

module.exports = {
    uploadFileToS3,
    uploadFilesToS3,
    deleteFileFromS3,
};
