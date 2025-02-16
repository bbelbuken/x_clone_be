const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3');
const fs = require('fs');

// Upload a single file to S3
const uploadFileToS3 = async (file, folder) => {
    if (!file.name) {
        throw new Error('File name is missing');
    }

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${folder}/${Date.now()}-${file.name}`, // Unique key with folder and timestamp
        Body: file.data,
        ContentType: file.mimetype, // MIME type (e.g., image/jpeg, video/mp4)
    };

    try {
        const command = new PutObjectCommand(params);
        await s3.send(command); // Upload the file to S3
        return `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${params.Key}`; // Return the file URL
    } catch (error) {
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
};

// Upload multiple files to S3 (limit to 4 images or 1 video per post)
const uploadFilesToS3 = async (files, folder) => {
    if (files.length > 4) {
        throw new Error(
            'You can upload a maximum of 4 photos or 1 video per post'
        );
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

    return fileUrls; // Return an array of URLs of uploaded files
};

const deleteFileFromS3 = async (fileKey) => {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileKey,
    };

    try {
        const command = new DeleteObjectCommand(params);
        await s3.send(command);
    } catch (error) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

module.exports = { deleteFileFromS3, uploadFilesToS3, uploadFileToS3 };
