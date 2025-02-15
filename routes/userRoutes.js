const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer-s3');
const s3 = require('../config/s3');
const userController = require('../controllers/userController');

router
    .route()
    .get('/', userController.getUser)
    .post('/', userController.createUser)
    .patch('/', userController.updateUser)
    .delete('/', userController.deleteUser);

module.exports = router;
