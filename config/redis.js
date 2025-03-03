const redis = require('redis');

const client = redis.createClient({
    url: 'redis://localhost:6379', // Your Redis URL
});

client.connect();

client.on('connect', () => {
    console.log('Connected to Redis');
});

client.on('error', (err) => {
    console.error('Redis error : ', err);
});

module.exports = client;
