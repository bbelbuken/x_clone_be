const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/s3');

// Define the multer upload middleware
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME, // Your S3 bucket name
        acl: 'public-read', // This makes files publicly accessible
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '-' + file.originalname); // Unique filename
        },
    }),
});

// Middleware to handle avatar upload
const uploadAvatar = upload.single('avatar'); // 'avatar' is the field name from the form

// Middleware to handle header photo upload
const uploadHeader = upload.single('header_photo');

module.exports = { uploadAvatar, uploadHeader };
