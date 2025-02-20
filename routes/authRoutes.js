const express = require('express');
const router = express.Router();
const loginLimiter = require('../middlewares/loginLimiter');
const authController = require('../controllers/authController');

router.route('/signup').post();
router.route('/login').post(loginLimiter, authController.login);
router.route('/refresh').get(authController.refresh);
router.route('/logout').post(authController.logout);

module.exports = router;
