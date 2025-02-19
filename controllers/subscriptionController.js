const User = require('../models/User');

const handleSubscription = async (req, res) => {
    const { userId } = req.body;

    const user = await User.findById(userId).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (user.verified) {
        return res.status(409).json({ message: 'User is already verified' });
    }

    user.verified = true;
    await user.save();

    return res
        .status(200)
        .json({ message: 'Subscription successful, user is now verified' });
};

module.exports = { handleSubscription };
