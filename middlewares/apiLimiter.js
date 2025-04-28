const rateLimit = require('express-rate-limit');
const { logEvents } = require('./logger');
const MongoStore = require('rate-limit-mongo');

const apiLimiter = rateLimit({
    store: new MongoStore({
        uri: process.env.MONGODB_URI,
        collectionName: 'apiRateLimits',
        expireTimeMs: 45 * 60 * 1000, // 45 minutes
    }),
    windowMs: 45 * 60 * 1000,
    max: 120, // 120 requests per window per IP
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
