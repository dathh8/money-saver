const { User } = require('../models/indexModel');

class user {

    // Creating a new user
    static createUser = async (req, res) => {
        try {
            const { username, email, password } = req.body;
            const user = await User.create({ username, email, password });
            res.status(201).json({ message: 'User created successfully', user });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    };

    // Function to list all users
    static listUsers = async (req, res) => {
        try {
            const user = await User.findAll({
                attributes: ['user_id', 'first_name', 'last_name', 'email']
            });
            res.status(200).json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    // Authenticating a user
    static authenticateUser = async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            res.status(200).json({ message: 'Authentication successful' });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    };

    // Function to get a user by ID
    static getUserById = async (req, res) => {
        try {
            const user = await User.findByPk(req.params.id, {
                attributes: ['id', 'username', 'email', 'createdAt', 'updatedAt']
            });
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    // Function to get a user by username
    static getUserByUsername = async (req, res) => {
        try {
            const user = await User.findOne({
                where: { username: req.params.username },
                attributes: ['id', 'username', 'email', 'createdAt', 'updatedAt']
            });
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    // Function to get users with pagination
    static listUsersWithPagination = async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query; // Default to page 1, limit 10
            const offset = (page - 1) * limit;
            const { count, rows } = await User.findAndCountAll({
                limit,
                offset,
                attributes: ['id', 'username', 'email', 'createdAt', 'updatedAt']
            });
            res.status(200).json({
                total: count,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                users: rows
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

}

module.exports = user;