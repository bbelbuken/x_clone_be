const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oAuth2Client });

const testRefreshToken = async () => {
    try {
        const { tokens } = await oAuth2Client.refreshToken(REFRESH_TOKEN);

        (async () => {
            const chalk = await import('chalk');
            console.log(
                chalk.default.green.dim.italic(
                    'Refresh token is valid. New access token:',
                    tokens.access_token
                )
            );
        })();
    } catch (error) {
        console.error('Refresh token is invalid or expired:', error.message);
    }
};

testRefreshToken();
module.exports = { drive };
