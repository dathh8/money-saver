#!/bin/bash

# MySQL credentials
user=$USER
password=$PASS

# Database name
dbname=$DB_NAME

# Check if the database exists
db_exists=$(mysql -u "$user" -p"$password" -e "SHOW DATABASES LIKE '"$dbname"';" | grep "$dbname" > /dev/null; echo "$?")

# If the database does not exist, create it
if [ $db_exists -eq 1 ]; then
    echo "Database does not exist. Creating database..."
    mysql -u "$user" -p"$password" -e "CREATE DATABASE $dbname"
    echo "Database created."
else
    echo "Database is ready."
fi

# Check if the table database_history exists
table_exists=$(mysql -u "$user" -p"$password" -D "$dbname" -e "SHOW TABLES LIKE 'database_history';" | grep "database_history" > /dev/null; echo "$?")

# If the table does not exist, run your query
if [ $table_exists -eq 1 ]; then
    echo "Table database_history does not exist. Creating..."
    # Replace YOUR_QUERY_HERE with the actual query you want to run
    mysql -u "$user" -p"$password" -D "$dbname" -e "CREATE TABLE database_history (entity_id int AUTO_INCREMENT, table_name varchar(255), column_data text, constraint_data text, updated_at datetime DEFAULT current_timestamp ON UPDATE current_timestamp, created_at datetime DEFAULT current_timestamp, PRIMARY KEY (entity_id));"
    echo "Created table."
else
    echo "Table database_history exists."
fi