const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

// Upload a file to S3
const uploadFile = async (fileBuffer, fileName, mimetype) => {
    const uploadParams = {
        Bucket: bucketName,
        Body: fileBuffer,
        Key: fileName,
        ContentType: mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    // Generate a public URL (or use presigned URL if you prefer)
    return `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
};

// Get a file from S3
const getFileStream = async (fileKey) => {
    const downloadParams = {
        Bucket: bucketName,
        Key: fileKey,
    };

    const command = new GetObjectCommand(downloadParams);
    const response = await s3Client.send(command);
    return response.Body;
};

// Delete a file from S3
const deleteFile = async (fileKey) => {
    const deleteParams = {
        Bucket: bucketName,
        Key: fileKey,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
};

module.exports = { uploadFile, getFileStream, deleteFile };
