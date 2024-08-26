const fs = require('fs');
const { exec } = require('child_process');
const config = require('../etc/env.js').db;
const path = require('path');
const xml2js = require('xml2js');
const mysql = require('../config/db.js');
const util = require('util'); 

process.env.PASS = config.password;
process.env.USER = config.user;
process.env.DB_NAME = config.database;

setup().then(() => {
    console.log("Starting server...");
    require('../index.js')
}).catch((err) => {
    console.error(`Failed to setup: ${err}`);
});

/**
 * Setup
 */
async function setup() {
    try {
        console.log("Setup: Start!");
        await checkDatabase();
        await handleSetupDBWithXMLFile();
        console.log("Setup: Done!");
    } catch (err) {
        console.error(`Error during setup: ${err}`);
    }
}

/**
 * Check database
 *
 * @returns 
 */
function checkDatabase() {
    return new Promise((resolve, reject) => {
        // Check if the database exists
        console.log("Checking database");
        const scriptPath = path.resolve(__dirname, 'setup-db.sh');
        exec(scriptPath, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                reject(error);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.warn(`stderr: ${stderr}`);
            resolve();
        });
    });
}

/**
 * Handle setup database
 *
 * @param {*} filePath 
 */
async function handleSetupDBWithXMLFile() {
    // Define the path to the file
    const filePath = path.join(__dirname, '../etc/db.xml');
    const fsAccess = util.promisify(fs.access);
    const fsReadFile = util.promisify(fs.readFile);
    const parseString = util.promisify(xml2js.parseString);
    try {
        // Check if the file exists
        await fsAccess(filePath, fs.constants.F_OK);

        // Read the contents of the file
        const data = await fsReadFile(filePath, 'utf8');

        // Parse the XML data
        const result = await parseString(data);

        // The result is a JavaScript object. If the XML data represents a list,
        // you can access it as an array. For example, if the XML data is a list
        // of users, you can access it with result.users.
        await handleSetupDB(result.schema.table);
    } catch (err) {
        console.error(err);
    }
}


/**
 * Handle setup database
 *
 * @param {object} listTable 
 * @returns 
 */
async function handleSetupDB(listTable) {
    if (listTable == undefined) {
        console.log("No table found");
        return;
    }
    const dbHistory = await getAllDataOfTableDatabaseHistory();
    // foreach listTable to process data
    for (const table of listTable) {
        let tableName = table.$.name;
        let listColumn = table.column;
        let constraints = table.constraint;
        let listConstraintData = [];
        let listColumnData = [];
        listColumn.forEach(async (column) => {
            let columnName = column.$.name;
            let columnType = column.$.type;
            let columnLength = column.$.length;
            let columnNotNull = column.$.notNull;
            let columnPrimaryKey = column.$.primaryKey;
            let columnAutoIncrement = column.$.identity;
            let columnUnique = column.$.unique;
            let columnDefault = column.$.default;
            let columnCheck = column.$.check;
            let columnUpdate = column.$.update;
            listColumnData.push({
                columnName: columnName,
                columnType: columnType,
                columnLength: columnLength,
                columnNotNull: columnNotNull,
                columnPrimaryKey: columnPrimaryKey,
                columnAutoIncrement: columnAutoIncrement,
                columnUnique: columnUnique,
                columnDefault: columnDefault,
                columnCheck: columnCheck,
                columnUpdate: columnUpdate
            });
        });
        constraints.forEach(async (constraint) => {
            let constraintName = constraint.$.name;
            let constraintType = constraint.$.type;
            let constraintColumns = constraint.column;
            let constraintReference = constraint.$.reference;
            let constraintOnDelete = constraint.$.onDelete;
            let constraintOnUpdate = constraint.$.onUpdate;
            let constraintColumnData = [];
            constraintColumns.forEach((column) => {
                constraintColumnData.push(column.$.name);
            });
            listConstraintData.push({
                constraintName: constraintName,
                constraintType: constraintType,
                constraintColumn: constraintColumnData,
                constraintReference: constraintReference,
                constraintOnDelete: constraintOnDelete,
                constraintOnUpdate: constraintOnUpdate
            });
        });
        // Check if the table already exists in the database
        if (dbHistory[tableName] != undefined) {
            let tableNeedUpdate = await handleExistedTable(tableName, listColumnData, listConstraintData, dbHistory[tableName]);
            if (tableNeedUpdate) {
                await handleStoreDataToDatabaseHistory(tableName, listColumnData, listConstraintData, true);
            }
        } else {
            await handleCreateTable(tableName, listColumnData, listConstraintData);
            await handleStoreDataToDatabaseHistory(tableName, listColumnData, listConstraintData);
        }
    }
}

/**
 * Retrieves all data from a history database table.
 * 
 * @async
 * @function
 * @returns {Promise<Array<Object>>}
 * @throws {Error}
 */
async function getAllDataOfTableDatabaseHistory() {
    // Assuming that the table name is "database_history"
    const tableName = "database_history";
    
    // Create a new instance of the DB class
    const db = new mysql();
    // Your code to retrieve all data from the "database_history" table goes here
    const query = `SELECT * FROM ${tableName}`;
    try {
        const data = await db.query(query);
        let dataConverted = data.reduce((acc, row) => {
            acc[row.table_name] = row;
            return acc;
        }, {});
        return dataConverted;
    } catch (err) {
        console.error(`Error executing query: ${err}`);
        return {};
    }
}

/**
 * Handle create table
 *
 * @param {*} tableName 
 * @param {*} listColumnData 
 * @param {*} listConstraintData 
 */
async function handleCreateTable(tableName, listColumnData, listConstraintData) {
    let query = `CREATE TABLE ${tableName} (`;

    const columnDefinitions = listColumnData.map(column => {
        let definition = `${column.columnName} ${column.columnType}`;
        if (column.columnLength) {
            definition += `(${column.columnLength})`;
        }
        if (column.columnNotNull === 'true') {
            definition += ' NOT NULL';
        }
        if (column.columnPrimaryKey === 'true') {
            definition += ' PRIMARY KEY';
        }
        if (column.columnAutoIncrement === 'true') {
            definition += ' AUTO_INCREMENT';
        }
        if (column.columnUnique === 'true') {
            definition += ' UNIQUE';
        }
        if (column.columnDefault) {
            definition += ` DEFAULT ${column.columnDefault}`;
        }
        if (column.columnCheck) {
            definition += ` CHECK (${column.columnCheck})`;
        }
        if (column.columnUpdate) {
            definition += ` ON UPDATE ${column.columnUpdate}`;
        }
        return definition;
    }).join(', ');

    // Initialize an array to hold primary key column names
    let primaryKeyColumns = [];

    // Iterate over listConstraintData to find primary key constraints
    listConstraintData.forEach(constraint => {
        if (constraint.constraintType === 'primary') {
            primaryKeyColumns.push(constraint.constraintColumn[0]);
        }
    });

    // Append PRIMARY KEY constraint if primaryKeyColumns array is not empty
    if (primaryKeyColumns.length > 0) {
        query += columnDefinitions + `, PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
    } else {
        query += columnDefinitions;
    }
    query += ');';
    try {
        const db = new mysql();
        await db.query(query);
        console.log(`Table ${tableName} created successfully!`);
    } catch (err) {
        console.error(`Error creating table: ${err}`);
    }
}

/**
 * Handle Existed Table
 *
 * @param {*} tableName 
 * @param {*} listColumnData 
 * @param {*} listConstraintData 
 * @param {*} historyData 
 * @returns 
 */
async function handleExistedTable(tableName, listColumnData, listConstraintData, historyData) {
    let oldColumnData = JSON.parse(historyData.column_data),
        oldConstraintData = JSON.parse(historyData.constraint_data),
        tableNeedUpdate = false;
    // Check if the table structure has changed
    if (JSON.stringify(oldColumnData) !== JSON.stringify(listColumnData)) {
        // Handle column changes
        await handleColumnChanges(tableName, oldColumnData, listColumnData);
        tableNeedUpdate = true;
    }
    if (JSON.stringify(oldConstraintData) !== JSON.stringify(listConstraintData)) {
        // Handle constraint changes
        await handleConstraintChanges(tableName, oldConstraintData, listConstraintData);
        tableNeedUpdate = true;
    }
    if (tableNeedUpdate) {
        console.log(`Table ${tableName} updated successfully!`);
    }
    return tableNeedUpdate;
}

/**
 * Handle constraint changes
 *
 * @param {*} tableName 
 * @param {*} oldConstraintData 
 * @param {*} listConstraintData 
 */
async function handleConstraintChanges(tableName, oldConstraintData, listConstraintData) {
    let db = new mysql();
    let constraintNames = listConstraintData.map(constraint => constraint.constraintName);
    let oldConstraintNames = oldConstraintData.map(constraint => constraint.constraintName);
    let constraintsToAdd = listConstraintData.filter(constraint => !oldConstraintNames.includes(constraint.constraintName));
    let constraintsToRemove = oldConstraintData.filter(constraint => !constraintNames.includes(constraint.constraintName));
    let constraintsToModify = listConstraintData.filter(constraint => {
        let oldConstraint = oldConstraintData.find(oldConstraint => oldConstraint.constraintName === constraint.constraintName);
        return JSON.stringify(oldConstraint) !== JSON.stringify(constraint);
    });
    // Add new constraints
    // if (constraintsToAdd.length > 0) {
    //     for (const constraint of constraintsToAdd) {
    //         let query = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} (${constraint.constraintColumn.join(', ')}`;
    //         if (constraint.constraintReference) {
    //             query += ` REFERENCES ${constraint.constraintReference}`;
    //         }
    //         if (constraint.constraintOnDelete) {
    //             query += ` ON DELETE ${constraint.constraintOnDelete}`;
    //         }
    //         if (constraint.constraintOnUpdate) {
    //             query += ` ON UPDATE ${constraint.constraintOnUpdate}`;
    //         }
    //         query += ');';
    //         try {
    //             await db.query(query);
    //             console.log(`Constraint ${constraint.constraintName} added to table ${tableName}`);
    //         } catch (err) {
    //             console.error(`Error adding constraint ${constraint.constraintName} to table ${tableName}: ${err}`);
    //         }
    //     }
    // }   


}

/**
 * Handle column changes
 *
 * @param {*} tableName 
 * @param {*} oldColumnData 
 * @param {*} listColumnData 
 */
async function handleColumnChanges(tableName, oldColumnData, listColumnData) {
    let db = new mysql();
    let columnNames = listColumnData.map(column => column.columnName);
    let oldColumnNames = oldColumnData.map(column => column.columnName);
    let columnsToAdd = listColumnData.filter(column => !oldColumnNames.includes(column.columnName));
    let columnsToRemove = oldColumnData.filter(column => !columnNames.includes(column.columnName));
    let columnsToModify = listColumnData.filter(column => {
        let oldColumn = oldColumnData.find(oldColumn => oldColumn.columnName === column.columnName);
        return JSON.stringify(oldColumn) !== JSON.stringify(column);
    });
    // Add new columns
    for (const column of columnsToAdd) {
        let query = `ALTER TABLE ${tableName} ADD COLUMN ${column.columnName} ${column.columnType}`;
        if (column.columnLength) {
            query += `(${column.columnLength})`;
        }
        if (column.columnNotNull === 'true') {
            query += ' NOT NULL';
        }
        if (column.columnPrimaryKey === 'true') {
            query += ' PRIMARY KEY';
        }
        if (column.columnAutoIncrement === 'true') {
            query += ' AUTO_INCREMENT';
        }
        if (column.columnUnique === 'true') {
            query += ' UNIQUE';
        }
        if (column.columnDefault) {
            query += ` DEFAULT ${column.columnDefault}`;
        }
        if (column.columnCheck) {
            query += ` CHECK (${column.columnCheck})`;
        }
        if (column.columnUpdate) {
            query += ` ON UPDATE ${column.columnUpdate}`;
        }
        try {
            await db.query(query);
            console.log(`Column ${column.columnName} added to table ${tableName}`);
        } catch (err) {
            console.error(`Error adding column ${column.columnName} to table ${tableName}: ${err}`);
        }
    }

    // Remove columns
    for (const column of columnsToRemove) {
        let query = `ALTER TABLE ${tableName} DROP COLUMN ${column.columnName}`;
        try {
            await db.query(query);
            console.log(`Column ${column.columnName} removed from table ${tableName}`);
        } catch (err) {
            console.error(`Error removing column ${column.columnName} from table ${tableName}: ${err}`);
        }
    }

    // Modify columns
    for (const column of columnsToModify) {
        let query = `ALTER TABLE ${tableName} MODIFY COLUMN ${column.columnName} ${column.columnType}`;
        if (column.columnLength) {
            query += `(${column.columnLength})`;
        }
        if (column.columnNotNull === 'true') {
            query += ' NOT NULL';
        }
        if (column.columnPrimaryKey === 'true') {
            query += ' PRIMARY KEY';
        }
        if (column.columnAutoIncrement === 'true') {
            query += ' AUTO_INCREMENT';
        }
        if (column.columnUnique === 'true') {
            query += ' UNIQUE';
        }
        if (column.columnDefault) {
            query += ` DEFAULT ${column.columnDefault}`;
        }
        if (column.columnCheck) {
            query += ` CHECK (${column.columnCheck})`;
        }
        if (column.columnUpdate) {
            query += ` ON UPDATE ${column.columnUpdate}`;
        }
        try {
            await db.query(query);
            console.log(`Column ${column.columnName} modified in table ${tableName}`);
        } catch (err) {
            console.error(`Error modifying column ${column.columnName} in table ${tableName}: ${err}`);
        }
    }
}


/**
 * Handle store data to database history
 *
 * @param {*} tableName 
 * @param {*} listColumnData 
 * @param {*} listConstraintData 
 */
async function handleStoreDataToDatabaseHistory(tableName, listColumnData, listConstraintData, updateAction = false) {
    let query = `INSERT INTO database_history (table_name, column_data, constraint_data) VALUES (?, ?, ?);`;
    const db = new mysql();
    if (updateAction) {
        query = `UPDATE database_history SET column_data = ?, constraint_data = ? WHERE table_name = ?;`;
        await db.query(query, [JSON.stringify(listColumnData), JSON.stringify(listConstraintData), tableName]);
        return;
    }
    await db.query(query, [tableName, JSON.stringify(listColumnData), JSON.stringify(listConstraintData)]);
}

module.exports = setup;
