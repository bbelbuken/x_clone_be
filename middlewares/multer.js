const multer = require('multer');

// Set up storage configuration for multer (store the file in memory or disk)
const storage = multer.memoryStorage(); // Store in memory (you can also use diskStorage to store on the server)

// Initialize multer with your storage options and file size limits
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB (you can adjust this as needed)
    fileFilter: (req, file, cb) => {
        // Ensure the file is of type image or video
        if (
            !file.mimetype.startsWith('image') &&
            !file.mimetype.startsWith('video')
        ) {
            return cb(
                new Error(
                    'Invalid file type. Only images and videos are allowed.'
                )
            );
        }
        cb(null, true); // Accept file
    },
});

module.exports = { upload };
