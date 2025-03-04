const { drive } = require('../config/googleDriveConfig');
const streamifier = require('streamifier');
const https = require('https');

const uploadFileToGoogleDrive = async (file, folder) => {
    if (!file.originalname) {
        throw new Error('File name is missing');
    }

    const fileMetadata = {
        name: `${Date.now()}-${file.originalname}`, // Ensure you're using originalname
        parents: [folder], // Folder ID to upload the file to
    };

    const media = {
        mimeType: file.mimetype, // MIME type (image/jpeg, video/mp4, etc.)
        body: streamifier.createReadStream(file.buffer), // Use the buffer to upload the file
    };

    try {
        const fileUploaded = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
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

const fetchImageFromGoogleDrive = (url) => {
    return new Promise((resolve, reject) => {
        https
            .get(url, (response) => {
                if (response.statusCode === 303) {
                    // Handle redirect
                    const redirectUrl = response.headers.location;

                    // Fetch the image from the redirect URL
                    https
                        .get(redirectUrl, (redirectResponse) => {
                            if (redirectResponse.statusCode !== 200) {
                                return reject(
                                    new Error(
                                        `Failed to fetch image. Status code: ${redirectResponse.statusCode}`
                                    )
                                );
                            }

                            let data = [];
                            redirectResponse.on('data', (chunk) => {
                                data.push(chunk);
                            });

                            redirectResponse.on('end', () => {
                                const buffer = Buffer.concat(data);
                                const base64Image = buffer.toString('base64');
                                if (!base64Image) {
                                    return reject(
                                        new Error('Image data is empty')
                                    );
                                }
                                resolve(base64Image);
                            });
                        })
                        .on('error', (err) => {
                            reject(err);
                        });
                } else if (response.statusCode !== 200) {
                    return reject(
                        new Error(
                            `Failed to fetch image. Status code: ${response.statusCode}`
                        )
                    );
                } else {
                    // Handle direct response
                    let data = [];
                    response.on('data', (chunk) => {
                        data.push(chunk);
                    });

                    response.on('end', () => {
                        const buffer = Buffer.concat(data);
                        const base64Image = buffer.toString('base64');
                        if (!base64Image) {
                            return reject(new Error('Image data is empty'));
                        }
                        resolve(base64Image);
                    });
                }
            })
            .on('error', (err) => {
                reject(err);
            });
    });
};

module.exports = {
    deleteFileFromGoogleDrive,
    uploadFilesToGoogleDrive,
    uploadFileToGoogleDrive,
    fetchImageFromGoogleDrive,
};
