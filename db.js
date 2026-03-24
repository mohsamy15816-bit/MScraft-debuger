const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.pool = new Pool({
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'msshop50',
            user: process.env.POSTGRES_USER || 'msshop50_user',
            password: process.env.POSTGRES_PASSWORD || 'msshop50_password',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('connect', () => {
            console.log('Connected to PostgreSQL database');
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });

        this.initializeTables();
    }

    initializeTables() {
        // Users table
        this.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "lastLogin" TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Users table error:', err);
            else console.log('Users table ready');
        });

        // Worlds table
        this.pool.query(`
            CREATE TABLE IF NOT EXISTS worlds (
                id SERIAL PRIMARY KEY,
                worldName TEXT UNIQUE NOT NULL,
                ownerId INTEGER NOT NULL,
                worldData TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(ownerId) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('Worlds table error:', err);
            else console.log('Worlds table ready');
        });

        // Blocks table (stores block placements)
        this.pool.query(`
            CREATE TABLE IF NOT EXISTS blocks (
                id SERIAL PRIMARY KEY,
                worldId INTEGER NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                z INTEGER NOT NULL,
                blockType INTEGER NOT NULL,
                placedBy INTEGER,
                "placedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(worldId) REFERENCES worlds(id),
                FOREIGN KEY(placedBy) REFERENCES users(id),
                UNIQUE(worldId, x, y, z)
            )
        `, (err) => {
            if (err) console.error('Blocks table error:', err);
            else console.log('Blocks table ready');
        });

        // Player stats table
        this.pool.query(`
            CREATE TABLE IF NOT EXISTS playerStats (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL,
                worldId INTEGER NOT NULL,
                blocksPlaced INTEGER DEFAULT 0,
                blocksDestroyed INTEGER DEFAULT 0,
                timeInGame INTEGER DEFAULT 0,
                lastPosition TEXT,
                FOREIGN KEY(userId) REFERENCES users(id),
                FOREIGN KEY(worldId) REFERENCES worlds(id)
            )
        `, (err) => {
            if (err) console.error('PlayerStats table error:', err);
            else console.log('PlayerStats table ready');
        });
    }

    // User methods
    registerUser(username, password, email, callback) {
        const hashedPassword = bcrypt.hashSync(password, 8);
        this.pool.query(
            `INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id`,
            [username, hashedPassword, email],
            (err, result) => {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, result.rows[0].id);
                }
            }
        );
    }

    loginUser(username, password, callback) {
        this.pool.query(
            `SELECT * FROM users WHERE username = $1`,
            [username],
            (err, result) => {
                if (err || result.rows.length === 0) {
                    callback(new Error('User not found'), null);
                } else {
                    const user = result.rows[0];
                    if (!bcrypt.compareSync(password, user.password)) {
                        callback(new Error('Invalid password'), null);
                    } else {
                        // Update last login
                        this.pool.query(
                            `UPDATE users SET "lastLogin" = CURRENT_TIMESTAMP WHERE id = $1`,
                            [user.id]
                        );
                        callback(null, user);
                    }
                }
            }
        );
    }

    getUserById(userId, callback) {
        this.pool.query(
            `SELECT id, username, email, "createdAt", "lastLogin" FROM users WHERE id = $1`,
            [userId],
            (err, result) => {
                callback(err, result.rows[0]);
            }
        );
    }

    // World methods
    createWorld(worldName, userId, callback) {
        this.pool.query(
            `INSERT INTO worlds (worldName, ownerId, worldData) VALUES ($1, $2, $3) RETURNING id`,
            [worldName, userId, JSON.stringify({})],
            (err, result) => {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, result.rows[0].id);
                }
            }
        );
    }

    getWorlds(callback) {
        this.pool.query(
            `SELECT * FROM worlds ORDER BY "updatedAt" DESC LIMIT 10`,
            (err, result) => {
                callback(err, result.rows);
            }
        );
    }

    getWorldById(worldId, callback) {
        this.pool.query(
            `SELECT * FROM worlds WHERE id = $1`,
            [worldId],
            (err, result) => {
                callback(err, result.rows[0]);
            }
        );
    }

    // Block methods
    saveBlock(worldId, x, y, z, blockType, userId, callback) {
        this.pool.query(
            `INSERT INTO blocks (worldId, x, y, z, blockType, placedBy) VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(worldId, x, y, z) DO UPDATE SET blockType = $5, placedBy = $6, "placedAt" = CURRENT_TIMESTAMP`,
            [worldId, x, y, z, blockType, userId],
            callback
        );
    }

    getBlocks(worldId, callback) {
        this.pool.query(
            `SELECT * FROM blocks WHERE worldId = $1`,
            [worldId],
            (err, result) => {
                callback(err, result.rows);
            }
        );
    }

    loadWorldBlocks(worldId, callback) {
        this.pool.query(
            `SELECT x, y, z, blockType FROM blocks WHERE worldId = $1`,
            [worldId],
            (err, result) => {
                if (err) {
                    callback(err, null);
                } else {
                    // Convert to map format
                    const blockMap = new Map();
                    result.rows.forEach(b => {
                        blockMap.set(`${b.x},${b.y},${b.z}`, b.blockType);
                    });
                    callback(null, blockMap);
                }
            }
        );
    }

    // Player stats methods
    updatePlayerStats(userId, worldId, statsUpdate, callback) {
        const { blocksPlaced, blocksDestroyed, timeInGame, lastPosition } = statsUpdate;
        this.pool.query(
            `INSERT INTO playerStats (userId, worldId, blocksPlaced, blocksDestroyed, timeInGame, lastPosition)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT(userId, worldId) DO UPDATE SET 
             blocksPlaced = playerStats.blocksPlaced + $3,
             blocksDestroyed = playerStats.blocksDestroyed + $4,
             timeInGame = playerStats.timeInGame + $5,
             lastPosition = $6`,
            [userId, worldId, blocksPlaced || 0, blocksDestroyed || 0, timeInGame || 0, lastPosition],
            callback
        );
    }

    close() {
        this.pool.end();
    }
}

module.exports = new Database();
