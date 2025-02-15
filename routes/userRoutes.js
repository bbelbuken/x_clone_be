const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer-s3');
const s3 = require('../config/s3');

router.get('/');
router.post('/upload');
router.delete('/delete');
