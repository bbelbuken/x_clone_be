const rateLimit = require('express-rate-limit');
const { logEvents } = require('./logger');
const MongoStore = require('rate-limit-mongo');

const apiLimiter = rateLimit({
    store: new MongoStore({
        uri: process.env.MONGODB_URI, // Reuse your MongoDB connection
        collectionName: 'apiRateLimits', // Different collection from loginLimiter
        expireTimeMs: 15 * 60 * 1000, // 15 minutes
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window per IP
    message: 'Too many API requests, please try again later.',
    handler: (req, res, next, options) => {
        logEvents(
            `API Rate Limit Exceeded: ${req.ip}\t${req.method}\t${req.url}\t${req.headers.origin}`,
            'apiRateLimits.log'
        );
        res.status(options.statusCode).send(options.message);
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = apiLimiter;
