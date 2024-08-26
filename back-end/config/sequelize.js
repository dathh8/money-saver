const { Sequelize } = require('sequelize');
const defaultConfig = require('../etc/env').db;

const sequelize = new Sequelize(defaultConfig.database, defaultConfig.user, defaultConfig.password, {
    host: defaultConfig.host,
    dialect: 'mysql',
    logging: false, // Disable logging or set to console.log for debugging
  });
  
  module.exports = sequelize;