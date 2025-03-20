const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { upload } = require('../middlewares/multer');

router
    .route('/')
    .get(userController.getUsers)
    .delete(userController.deleteUser);

router
    .route('/:userId')
    .get(userController.getUserById)
    .patch(
        upload.fields([
            { name: 'avatar', maxCount: 1 },
            { name: 'header_photo', maxCount: 1 },
        ]),
        userController.updateUser
    );

router.route('/current/:username').get(userController.getCurrentAccount);

router.route('/:userId/toggle-follow').post(userController.toggleFollowUser);

router
    .route('/:username/upload_avatar')
    .post(upload.single('avatar'), userController.uploadAvatarToUser);

router
    .route('/:username/upload_header')
    .post(upload.single('header_photo'), userController.uploadHeaderToUser);

router
    .route('/:username/delete_avatar')
    .delete(userController.deleteAvatarFromUser);

router
    .route('/:username/delete_header')
    .delete(userController.deleteHeaderFromUser);

module.exports = router;
