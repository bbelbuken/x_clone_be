const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadToS3 = async (file, folder) => {
    const key = `${folder}/${Date.now()}-${file.originalname}`;

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(params));

    // Generate a public URL (or use presigned URL if you prefer)
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

const deleteFromS3 = async (url) => {
    const key = url.split(`.amazonaws.com/`)[1];

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(params));
};

module.exports = { uploadToS3, deleteFromS3 };
