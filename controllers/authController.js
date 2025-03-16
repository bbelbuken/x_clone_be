const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    const { step, username, email, password } = req.body;

    if (step === 1) {
        if (!username && !email) {
            return res
                .status(400)
                .json({ message: 'Username or email is required' });
        }

        const foundUser = await User.findOne({
            $or: [{ username: username }, { email: email }],
        }).exec();

        if (!foundUser) {
            return res
                .status(401)
                .json({ message: "We couldn't find your account" });
        }

        return res
            .status(200)
            .json({ message: 'Account found', user: foundUser });
    }

    if (step === 2) {
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const foundUser = await User.findOne({
            $or: [{ username: username }, { email: email }],
        }).exec();

        if (!foundUser) {
            return res
                .status(401)
                .json({ message: "We couldn't find your account" });
        }

        const match = await bcrypt.compare(password, foundUser.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const accessToken = jwt.sign(
            {
                UserInfo: {
                    username: foundUser.username,
                },
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '1d' }
        );

        const refreshToken = jwt.sign(
            { username: foundUser.username },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({ accessToken, foundUser });
    }

    return res.status(400).json({ message: 'Invalid step' });
};

const refresh = (req, res) => {
    const cookies = req.cookies;

    if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized' });
    const refreshToken = cookies.jwt;

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
            if (err) return res.status(403).json({ message: 'Forbidden' });

            const foundUser = await User.findOne({
                username: decoded.username,
            }).exec();

            if (!foundUser)
                return res.status(401).json({ message: 'Unauthorized' });

            const accessToken = jwt.sign(
                {
                    UserInfo: {
                        username: foundUser.username,
                    },
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '1d' }
            );
            res.json({ accessToken });
        }
    );
};

const logout = (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); //No content
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
    res.json({ message: 'Cookie cleared' });
};

module.exports = { login, refresh, logout };
