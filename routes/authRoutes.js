const express = require('express');
const router = express.Router();
const loginLimiter = require('../middlewares/loginLimiter');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController.js');
const { upload } = require('../middlewares/multer');

router
    .route('/signup')
    .post(upload.single('avatar'), userController.createUser);
router.route('/login').post(loginLimiter, authController.login);
router.route('/refresh').get(authController.refresh);
router.route('/logout').post(authController.logout);
router.route('/switch-account').patch(authController.switchAccount);

module.exports = router;
