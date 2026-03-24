const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const db = require('./db');
const cluster = require('cluster');
const os = require('os');
const redis = require('redis');

const app = express();
app.use(express.static(path.join(__dirname)));
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 10e6
});

// Redis for cross-server communication
const redisClient = redis.createClient({ host: 'localhost', port: 6379 });
redisClient.on('error', (err) => console.log('Redis error:', err));

// Multi-threaded clustering
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master process ${process.pid} starting ${numCPUs} worker processes...`);
    
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Respawning...`);
        cluster.fork();
    });
    
} else {
    // Worker process
    const PORT = process.env.PORT || 3000;

    // Game state management
    const players = new Map(); // playerId -> playerData
    const worlds = new Map();  // worldId -> worldData
    const worldBlocks = new Map(); // worldId -> Map of blocks

    // Player tracking
    io.on('connection', (socket) => {
        console.log(`New player connected: ${socket.id}`);

        socket.on('playerJoin', (playerData, worldId) => {
            players.set(socket.id, {
                id: socket.id,
                username: playerData.username,
                position: playerData.position,
                rotation: playerData.rotation,
                worldId: worldId,
                health: 20,
                lastUpdate: Date.now()
            });

            // Load world if not loaded
            if (!worldBlocks.has(worldId)) {
                loadWorldBlocks(worldId);
            }

            // Notify other players
            socket.broadcast.emit('playerJoined', {
                playerId: socket.id,
                username: playerData.username,
                position: playerData.position
            });

            // Send all players to new player
            const allPlayers = Array.from(players.values()).filter(p => p.worldId === worldId);
            socket.emit('setPeerPlayers', allPlayers);

            socket.join(`world-${worldId}`);
        });

        // Player movement sync
        socket.on('playerMove', (data) => {
            const player = players.get(socket.id);
            if (player) {
                player.position = data.position;
                player.rotation = data.rotation;
                player.lastUpdate = Date.now();

                // Broadcast to world players
                socket.broadcast.to(`world-${player.worldId}`).emit('playerMoved', {
                    playerId: socket.id,
                    position: data.position,
                    rotation: data.rotation
                });
            }
        });

        // Block placement
        socket.on('placeBlock', (data) => {
            const player = players.get(socket.id);
            if (player) {
                const key = `${data.x},${data.y},${data.z}`;
                
                if (!worldBlocks.has(player.worldId)) {
                    worldBlocks.set(player.worldId, new Map());
                }
                worldBlocks.get(player.worldId).set(key, data.blockType);

                // Save to database
                db.saveBlock(player.worldId, data.x, data.y, data.z, data.blockType, player.id);

                // Broadcast to all players in world
                io.to(`world-${player.worldId}`).emit('blockPlaced', {
                    x: data.x, y: data.y, z: data.z,
                    blockType: data.blockType,
                    playerId: socket.id
                });
            }
        });

        // Block destruction
        socket.on('breakBlock', (data) => {
            const player = players.get(socket.id);
            if (player) {
                const key = `${data.x},${data.y},${data.z}`;
                
                if (worldBlocks.has(player.worldId)) {
                    worldBlocks.get(player.worldId).delete(key);
                }

                // Save to database
                db.saveBlock(player.worldId, data.x, data.y, data.z, 0);

                // Broadcast to all players
                io.to(`world-${player.worldId}`).emit('blockBroken', {
                    x: data.x, y: data.y, z: data.z,
                    playerId: socket.id
                });
            }
        });

        // Chat
        socket.on('chat', (message) => {
            const player = players.get(socket.id);
            if (player) {
                io.to(`world-${player.worldId}`).emit('chatMessage', {
                    playerId: socket.id,
                    username: player.username,
                    message: message
                });
            }
        });

        // Player disconnection
        socket.on('disconnect', () => {
            const player = players.get(socket.id);
            if (player) {
                socket.broadcast.emit('playerLeft', socket.id);
                players.delete(socket.id);
                console.log(`Player ${socket.id} disconnected`);
            }
        });
    });

    function loadWorldBlocks(worldId) {
        db.loadWorldBlocks(worldId, (err, blocks) => {
            if (!err && blocks) {
                worldBlocks.set(worldId, blocks);
            } else {
                worldBlocks.set(worldId, new Map());
            }
        });
    }

    // REST API endpoints
    app.post('/api/register', (req, res) => {
        const { username, password, email } = req.body;
        db.registerUser(username, password, email, (err, userId) => {
            if (err) {
                res.status(400).json({ error: 'Registration failed' });
            } else {
                res.json({ success: true, userId });
            }
        });
    });

    app.post('/api/login', (req, res) => {
        const { username, password } = req.body;
        db.loginUser(username, password, (err, user) => {
            if (err) {
                res.status(401).json({ error: 'Invalid credentials' });
            } else {
                res.json({ success: true, user });
            }
        });
    });

    app.get('/api/worlds', (req, res) => {
        db.getWorlds((err, worlds) => {
            if (err) {
                res.status(500).json({ error: 'Failed to fetch worlds' });
            } else {
                res.json(worlds);
            }
        });
    });

    app.post('/api/world/create', (req, res) => {
        const { worldName, userId } = req.body;
        db.createWorld(worldName, userId, (err, worldId) => {
            if (err) {
                res.status(400).json({ error: 'World creation failed' });
            } else {
                res.json({ success: true, worldId });
            }
        });
    });

    server.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`);
    });
}
