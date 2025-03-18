const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { upload } = require('../middlewares/multer');

router
    .route('/')
    .get(postController.getPosts)
    .post(upload.array('mediaFiles', 4), postController.createPost);

router
    .route('/:postId')
    .get(postController.getPostById)
    .delete(postController.deletePost)
    .patch(upload.array('mediaFiles', 4), postController.updatePost);

router.route('/:postId/like').patch(postController.likePost);
router.route('/:postId/view').patch(postController.incrementView);
router.route('/:postId/repost').post(postController.repostPost);
router.route('/:postId/quote').post(postController.quotePost);

module.exports = router;
