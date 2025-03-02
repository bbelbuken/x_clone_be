const express = require('express');
const router = express.Router({ mergeParams: true }); // ! important
const postController = require('../controllers/postController');
const { upload } = require('../middlewares/multer'); // Adjust the path if necessary
const verifyJWT = require('../middlewares/verifyJWT');

router
    .route('/')
    .get(postController.getPosts)
    .post(verifyJWT, upload.array('mediaFiles', 4), postController.createPost);

router
    .route('/status/:postId')
    .patch(verifyJWT, upload.array('mediaFiles', 4), postController.updatePost)
    .delete(verifyJWT, postController.deletePost);

module.exports = router;
