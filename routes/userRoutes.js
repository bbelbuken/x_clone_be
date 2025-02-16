const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router
    .route('/')
    .get(userController.getUser)
    .post(userController.createUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

router
    .route('/:username/upload_avatar')
    .post(userController.uploadAvatarToUser);

router
    .route('/:username/upload_header')
    .post(userController.uploadHeaderToUser);

router
    .route('/:username/delete_avatar')
    .delete(userController.deleteAvatarFromUser);

router
    .route('/:username/delete_header')
    .delete(userController.deleteHeaderFromUser);

module.exports = router;
