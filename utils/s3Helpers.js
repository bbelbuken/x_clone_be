const s3 = require('../config/s3');
const {
    deleteObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const deleteFileFromS3 = async (fileUrl) => {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileUrl.split('/').pop(), // Extract file key from URL
    };

    try {
        const command = new DeleteObjectCommand(params);
        await s3.send(command);
    } catch (error) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

module.exports = { deleteFileFromS3 };
