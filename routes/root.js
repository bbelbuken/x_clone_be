const express = require('express');
const router = express.Router();
const path = require('path');
const postController = require('../controllers/postController');

router.get('^/$|/index(.html)?', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

router.route('/home').get(postController.getPosts);

module.exports = router;
