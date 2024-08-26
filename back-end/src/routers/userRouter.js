const express = require('express');
const userController = require('../controllers/userController');
const app = express();

const user_router = express.Router();

user_router.get('/', function(req, res) {
    res.status(200).json({
        users: 'ok',
    });
});

user_router.get('/list', userController.listUsers);

module.exports = user_router;