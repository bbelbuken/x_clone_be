const { uploadFile, getFileStream, deleteFile } = require('../config/s3');

const uploadFileToS3 = async (file, folder) => {
    if (!file.originalname) {
        throw new Error('File name is missing');
    }

    const fileName = `${folder}/${Date.now()}-${file.originalname}`;

    try {
        const fileUrl = await uploadFile(file.buffer, fileName, file.mimetype);
        return fileUrl;
    } catch (error) {
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};

const uploadFilesToS3 = async (files, folder) => {
    if (files.length > 4) {
        throw new Error('You can upload a maximum of 4 media per post');
    }

    const fileUrls = [];

    for (const file of files) {
        if (
            file.mimetype.includes('image') ||
            file.mimetype.includes('video')
        ) {
            const fileUrl = await uploadFileToS3(file, folder);
            fileUrls.push(fileUrl);
        } else {
            throw new Error(
                'Invalid file type. Only images or videos are allowed'
            );
        }
    }

    return fileUrls;
};

const deleteFileFromS3 = async (fileUrl) => {
    try {
        // Extract the key from the URL
        const url = new URL(fileUrl);
        const fileKey = url.pathname.substring(1); // Remove leading slash
        await deleteFile(fileKey);
    } catch (error) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

const fetchImageFromS3 = async (fileUrl) => {
    try {
        // Extract the key from the URL
        const url = new URL(fileUrl);
        const fileKey = url.pathname.substring(1); // Remove leading slash

        const data = await getFileStream(fileKey);

        return new Promise((resolve, reject) => {
            const chunks = [];
            data.on('data', (chunk) => chunks.push(chunk));
            data.on('error', reject);
            data.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64Image = buffer.toString('base64');
                if (!base64Image) {
                    return reject(new Error('Image data is empty'));
                }
                resolve(base64Image);
            });
        });
    } catch (error) {
        throw new Error(`Failed to fetch image from S3: ${error.message}`);
    }
};

module.exports = {
    uploadFileToS3,
    uploadFilesToS3,
    deleteFileFromS3,
    fetchImageFromS3,
};
