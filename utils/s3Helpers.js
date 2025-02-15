const s3 = require('../config/s3');

const deleteFileFromS3 = async (fileUrl) => {
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileUrl.split('/').pop(), // Assuming the URL ends with the file key
    };

    try {
        await s3.deleteObject(params).promise();
    } catch (error) {
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
};

module.exports = { deleteFileFromS3 };
