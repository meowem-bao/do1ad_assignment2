// database-init.js - Initialize database before starting the app
const { setupDatabase } = require('./setup.js');

// Initialize database and start app
async function initializeApp() {
    try {
        console.log('Initializing database...');
        await setupDatabase();
        
        console.log('Database ready!');
        console.log('Starting application...\n');
        
        // Start the Express app after database is ready
        require('./app.js');
        
    } catch (error) {
        console.error('Failed to initialize application:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\nFix: Check your MySQL credentials in .env file');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\nFix: Start MySQL server (XAMPP/MAMP/MySQL service)');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('\nFix: Database does not exist - this script should create it automatically');
        }
        
        console.error('\n Make sure your .env file has correct database settings:');
        console.error('   DB_HOST=localhost');
        console.error('   DB_USER=root');
        console.error('   DB_NAME=(leave empty to use default: project_manager)');
        
        process.exit(1);
    }
}

// Run only if this file is executed directly
if (require.main === module) {
    console.log('Project Manager - Database Initialization');
    console.log('==========================================\n');
    initializeApp();
} else {
    module.exports = { initializeApp };
}