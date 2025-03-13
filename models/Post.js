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
        },

        media: {
            image: {
                type: [String],
                default: '',
            },
            video: {
                type: [String],
                default: '',
            },
        },

        reactions: {
            replyCount: {
                type: Number,
                default: 0,
            },

            repliedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            repostCount: {
                type: Number,
                default: 0,
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

            likeCount: {
                type: Number,
                default: 0,
            },

            likedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },

            viewCount: {
                type: Number,
                default: 0,
            },

            viewedBy: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'User',
                default: [],
            },
        },

        originalPost: {
            type: mongoose.Schema.Types.Mixed,
        },

        isARepost: {
            type: Boolean,
            default: false,
        },

        isReposted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Pre-save middleware to update the count fields
// ! 'save' is unique
postSchema.pre('save', function (next) {
    this.reactions.replyCount = this.reactions.repliedBy.length;
    this.reactions.repostCount =
        this.reactions.repostedBy.length + this.reactions.quotedBy.length;
    this.reactions.likeCount = this.reactions.likedBy.length;
    this.reactions.viewCount = this.reactions.viewedBy.length;

    next();
});

module.exports = mongoose.model('Post', postSchema);
