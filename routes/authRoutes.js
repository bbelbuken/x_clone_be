const express = require('express');
const router = express.Router();
const loginLimiter = require('../middlewares/loginLimiter');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController.js');

router.route('/signup').post(userController.createUser);
router.route('/login').post(loginLimiter, authController.login);
router.route('/refresh').get(authController.refresh);
router.route('/logout').post(authController.logout);

module.exports = router;
