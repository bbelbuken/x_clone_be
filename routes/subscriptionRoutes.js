const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

router.route('/').post(subscriptionController.handleSubscription);

module.exports = router;
