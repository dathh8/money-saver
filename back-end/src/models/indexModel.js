const sequelize = require('../../config/sequelize');
const User = require('./userModel');

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    await sequelize.sync({ force: false }); // Use { force: true } to drop and re-create tables
    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

syncDatabase();

module.exports = {
  User
};