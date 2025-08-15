const { getConnection } = require('./connection');
const { createDatabase } = require('./createDatabase');
const { createTables } = require('./createTables');
const { addSampleData } = require('./sampleData');

//Main database setup function
async function setupDatabase() {
    let db;
    
    try {
        console.log('Starting database setup...');
        
        //Connect to database
        db = await getConnection();
        console.log('Connected to MySQL');
        
        //Create database
        const activeDatabase = await createDatabase(db);
        console.log(`Database '${activeDatabase}' ready`);
        
        //Create tables
        await createTables(db, activeDatabase);
        
        //Add test data
        await addSampleData(db, activeDatabase);
        
        console.log('Setup complete! Check phpMyAdmin');
        
    } catch (err) {
        console.error('Setup failed:', err.message);
        
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Check MySQL credentials in .env file');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Start MySQL server (XAMPP/MAMP)');
        }
        
    } finally {
        if (db) {
            await db.end();
            console.log('Connection closed');
        }
    }
}

//Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };