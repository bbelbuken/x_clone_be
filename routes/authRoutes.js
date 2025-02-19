const express = require('express');
const router = express.Router();
const loginLimiter = require('../middlewares/loginLimiter');

router.route('/signup').post();
router.route('/login').post(loginLimiter);

module.exports = router;
