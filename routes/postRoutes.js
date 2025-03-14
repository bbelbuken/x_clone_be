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
    );

router
    .route('/:postId')
    .delete(/* verifyJWT, */ postController.deletePost)
    .patch(
        /* verifyJWT, */ upload.array('mediaFiles', 4),
        postController.updatePost
    );

router.route('/:postId/like').patch(postController.likePost);
router.route('/:postId/view').patch(postController.incrementView);
router.route('/:postId/repost').post(postController.repostPost);
router.route('/:postId/quote').post(postController.quotePost);

module.exports = router;
