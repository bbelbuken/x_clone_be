const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        content: {
            type: String,
            required: true,
        },

        media: {
            image: {
                type: String,
                default: '',
            },
            video: {
                type: String,
                default: '',
            },
        },

        reactions: {
            repliedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            repostedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            quotedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            likedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            viewedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Post', postSchema);
