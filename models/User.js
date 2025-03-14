const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },

        password: {
            type: String,
            required: true,
        },

        email: {
            type: String,
            required: true,
        },

        dateOfBirth: {
            type: String,
            required: true,
        },

        fullname: {
            type: String,
            default: '',
        },

        avatar: {
            type: String, // Store the URL of the avatar image
            default: '', // Default to an empty string if no avatar is provided
        },

        header_photo: {
            type: String, // Store the URL of the header photo
            default: '', // Default to an empty string if no header photo is provided
        },

        verified: {
            type: Boolean,
            default: false,
        },

        bio: {
            type: String,
            default: '',
        },

        location: {
            type: String,
            default: '',
        },

        website: {
            type: String,
            default: '',
        },

        followers: {
            type: [mongoose.Schema.Types.ObjectId], // Array of user IDs for followers
            ref: 'User',
            default: [],
        },

        following: {
            type: [mongoose.Schema.Types.ObjectId], // Array of user IDs for following
            ref: 'User',
            default: [],
        },

        postCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('User', userSchema);
