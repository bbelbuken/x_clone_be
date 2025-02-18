const express = require('express');
const router = express.Router({ mergeParams: true }); // ! important
const postController = require('../controllers/postController');
const { upload } = require('../middlewares/multer'); // Adjust the path if necessary

router
    .route('/')
    .get(postController.getPosts)
    .post(upload.array('mediaFiles', 4), postController.createPost);

router
    .route('/status/:postId')
    .patch(upload.array('mediaFiles', 4), postController.updatePost)
    .delete(postController.deletePost);

module.exports = router;
