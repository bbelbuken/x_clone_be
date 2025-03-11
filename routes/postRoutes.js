const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { upload } = require('../middlewares/multer'); // Adjust the path if necessary
const verifyJWT = require('../middlewares/verifyJWT');

router
    .route('/')
    .get(postController.getPosts)
    .post(
        /* verifyJWT, */ upload.array('mediaFiles', 4),
        postController.createPost
    )
    .delete(/* verifyJWT, */ postController.deletePost);

router
    .route('/status/:postId')
    .patch(
        /* verifyJWT, */ upload.array('mediaFiles', 4),
        postController.updatePost
    );

module.exports = router;
