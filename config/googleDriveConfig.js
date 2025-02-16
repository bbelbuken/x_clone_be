const { google } = require('googleapis');

// Load the keyfile path from the environment variables
const KEYFILE = process.env.GOOGLE_DRIVE_KEYFILE_PATH;

// Set up Google Auth and Drive API client
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/drive.file'], // Adjust the scope based on your needs
});

const drive = google.drive({ version: 'v3', auth });

module.exports = { drive };
