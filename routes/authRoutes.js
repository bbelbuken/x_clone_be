const express = require('express');
const router = express.Router();
const loginLimiter = require('../middlewares/loginLimiter');

router.route('/signup').post();
router.route('/login').post(loginLimiter);
router.route('/refresh').get();
router.route('/logout').post();

module.exports = router;
