const { drive } = require('../config/googleDriveConfig');
const fs = require('fs');

const uploadFileToGoogleDrive = async (file, folder) => {
    if (!file.name) {
        throw new Error('File name is missing');
    }

    const fileMetadata = {
        name: `${Date.now()}-${file.name}`, // Unique file name with timestamp
        parents: [folder], // Specify the folder ID where the file will be uploaded (if needed)
    };

    const media = {
        mimeType: file.mimetype, // MIME type (e.g., image/jpeg, video/mp4)
        body: fs.createReadStream(file.data), // File data stream
    };

    try {
        const fileUploaded = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id', // Return file ID
        });
        return `https://drive.google.com/uc?id=${fileUploaded.data.id}`; // Return the file URL
    } catch (error) {
        throw new Error(
            `Failed to upload file to Google Drive: ${error.message}`
        );
    }
};

const uploadFilesToGoogleDrive = async (files, folder) => {
    if (files.length > 4) {
        throw new Error('You can upload a maximum of 4 media per post');
    }

    const fileUrls = [];

    for (const file of files) {
        if (
            file.mimetype.includes('image') ||
            file.mimetype.includes('video')
        ) {
            const fileUrl = await uploadFileToGoogleDrive(file, folder);
            fileUrls.push(fileUrl);
        } else {
            throw new Error(
                'Invalid file type. Only images or videos are allowed'
            );
        }
    }

    return fileUrls;
};

const deleteFileFromGoogleDrive = async (fileId) => {
    try {
        await drive.files.delete({
            fileId: fileId,
        });
        console.log('File deleted successfully');
    } catch (error) {
        throw new Error(
            `Failed to delete file from Google Drive: ${error.message}`
        );
    }
};

module.exports = {
    deleteFileFromGoogleDrive,
    uploadFilesToGoogleDrive,
    uploadFileToGoogleDrive,
};
