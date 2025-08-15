const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Generate cryptographically secure random password
function generatePassword(length = 8) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
}

// Add sample data for testing
async function addSampleData(db, dbName) {
    try {
        // Check if data exists
        const [rows] = await db.execute(`SELECT COUNT(*) as total FROM ${dbName}.users`);
        
        if (rows[0].total > 0) {
            console.log('Sample data already exists');
            return;
        }
        
        // Create test user with random password
        const plainPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        
        const [userResult] = await db.execute(
            `INSERT INTO ${dbName}.users (username, password, email) VALUES (?, ?, ?)`,
            ['testuser', hashedPassword, 'test@example.com']
        );
        
        // Sample projects
        const projects = [
            ['E-commerce Site', '2024-02-01', 'Online shopping platform with payment integration', 'development'],
            ['Task Manager App', '2024-01-15', 'Mobile app for personal task management', 'testing'],
            ['Legacy Migration', '2023-12-10', 'Moving old system to modern database', 'complete']
        ];
        
        for (let project of projects) {
            await db.execute(
                `INSERT INTO ${dbName}.projects (title, start_date, short_description, phase, uid) VALUES (?, ?, ?, ?, ?)`,
                [...project, userResult.insertId]
            );
        }
        
        console.log('Sample data added');
        console.log('Test User: testuser');
        console.log(`Test user password: ${plainPassword}`);
        
    } catch (err) {
        console.log('Sample data failed:', err.message);
    }
}

module.exports = { addSampleData };