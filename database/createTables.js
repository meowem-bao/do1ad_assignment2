//Create database tables
async function createTables(db, targetDb) {
    try {
        //Users table
        const usersSQL = `
            CREATE TABLE IF NOT EXISTS ${targetDb}.users (
                uid INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await db.execute(usersSQL);
        console.log('Users table ready');
        
        //Projects table
        const projectsSQL = `
            CREATE TABLE IF NOT EXISTS ${targetDb}.projects (
                pid INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                short_description TEXT NOT NULL,
                phase ENUM('design', 'development', 'testing', 'deployment', 'complete') NOT NULL DEFAULT 'design',
                uid INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (uid) REFERENCES ${targetDb}.users(uid)
            )
        `;
        
        await db.execute(projectsSQL);
        console.log('Projects table ready');
        
    } catch (err) {
        console.error('Table creation failed:', err.message);
        throw err;
    }
}

module.exports = { createTables };