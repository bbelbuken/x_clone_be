const express = require('express');
const router = express.Router();
const User = require('../models/User');
const s3 = require('../config/s3');

const getUser = async (req, res) => {
    const users = await User.find().select('-password').lean();
    if (!users?.length) {
        return res.status(400).json({ message: 'No users found' });
    }
    res.json(users);
};

const createUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // ? duplicate
    const duplicate = await User.findOne({ username })
        .collation({
            locale: 'en',
            strength: 2,
        }) // case sensitivity
        .lean()
        .exec();
    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate username' });
    }
};
