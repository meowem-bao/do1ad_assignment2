// Create database if it doesn't exist
async function createDatabase(db) {
    const targetDb = process.env.DB_NAME;
    
    try {
        // Use query() instead of execute() for CREATE DATABASE
        await db.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\``);
        console.log(`Database '${targetDb}' created`);
        return targetDb;

    } catch (err) {
        console.error('Database creation failed:', err.message);
        throw err;
    }
}

module.exports = { createDatabase };