require('dotenv').config();
require('express-async-errors');
const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const corsOptions = require('./config/corsOptions');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/connectDB');
const fileUpload = require('express-fileupload');
const { logger, logEvents } = require('./middlewares/logger');
const errorHandler = require('./middlewares/errorHandler');
const PORT = process.env.PORT || 3500;

connectDB();
(async () => {
    const chalk = await import('chalk');
    console.log(chalk.default.cyan.blue(process.env.NODE_ENV));
})();

// MIDDLEWARES
app.use(logger);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload());
app.use(cookieParser());
app.use('/', express.static(path.join(__dirname, 'public')));

// ROUTES
app.use('/', require('./routes/root'));
app.use('/users', require('./routes/userRoutes'));

app.all('*', (req, res) => {
    res.status(404);
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'views', '404.html'));
    } else if (req.accepts('json')) {
        res.json({ message: '404 Not Found' });
    } else {
        res.type('txt').send('404 Not Found');
    }
});

app.use(errorHandler);

// LISTENERS
mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server is running port on ${PORT}`));
});
mongoose.connection.on('error', (err) => {
    console.error(err);
    logEvents(
        `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
        'mongoErrLog.log'
    );
});
