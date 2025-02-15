const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { uploadAvatar, uploadHeader } = require('../middlewares/upload');

router
    .route('/')
    .get(userController.getUser)
    .post(userController.createUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

router
    .route('/:username/upload_avatar')
    .post(uploadAvatar, userController.uploadAvatarToUser);

router
    .route('/:username/upload_header')
    .post(uploadHeader, userController.uploadHeaderToUser);

router
    .route('/:username/delete_avatar')
    .delete(userController.deleteAvatarFromUser);

router
    .route('/:username/delete_header')
    .delete(userController.deleteHeaderFromUser);

module.exports = router;
