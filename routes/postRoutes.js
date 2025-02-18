const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

router.route('/').get(postController.getPosts).post(postController.createPost);

router
    .route('/status/:postId')
    .patch(postController.updatePost)
    .delete(postController.deletePost);

module.exports = router;
