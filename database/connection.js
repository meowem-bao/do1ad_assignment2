// Database Setup Files/connection.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Debug db connection config
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD exists:', !!process.env.DB_PASSWORD);

// Database connection pool configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Function to get a connection (for setup purposes)
async function getConnection() {
    try {
        const setupConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT
        };
        const connection = await mysql.createConnection(setupConfig);
        console.log('Database connected successfully');
        return connection;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Check your database credentials in .env file');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('MySQL server is not running. Start XAMPP/MAMP or your MySQL service');
        }
        
        throw error;
    }
}

// Test connection function
async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT
        });
        
        await connection.end();
        console.log('Database connected successfully');
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Check your database credentials in .env file');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('MySQL server is not running. Start XAMPP/MAMP or your MySQL service');
        }
        
        throw error;
    }
}

// Export the pool as default and also named exports for setup
module.exports = pool;
module.exports.getConnection = getConnection;
module.exports.testConnection = testConnection;