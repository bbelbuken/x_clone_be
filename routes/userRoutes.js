const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { upload } = require('../middlewares/multer');
const verifyJWT = require('../middlewares/verifyJWT');

router.use(verifyJWT);

router
    .route('/')
    .get(userController.getUser)
    .post(userController.createUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

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
