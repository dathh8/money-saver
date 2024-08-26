const mysql = require('mysql2');
const defaultConfig = require('../etc/env').db;

/**
 * Database class for managing connections and queries.
 */
class Database {

    /**
     * Creates a new Database instance.
     * 
     * @param {Object} [config=defaultConfig] - The configuration for the MySQL connection pool.
     */
    constructor(config = defaultConfig) {
        this.connection = mysql.createPool(config);
    }

    /**
     * Connects to the MySQL database.
     * 
     * @returns {Promise<void>} A promise that resolves when the connection is successfully established.
     * @throws {Error} Will throw an error if the connection fails.
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.connection.getConnection((error, connection) => {
                if (error) {
                    reject(error);
                } else {
                    connection.release();
                    resolve();
                }
            });
        });
    }

    /**
     * Executes a query on the MySQL database.
     * 
     * @param {string} sql - The SQL query to execute.
     * @param {Array} [values] - The values to bind to the SQL query.
     * @returns {Promise<Array<Object>>} A promise that resolves with the results of the query.
     * @throws {Error} Will throw an error if the query execution fails.
     */
    query(sql, values) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, values, (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
    }
}

module.exports = Database;