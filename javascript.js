// MSshop50 - Minecraft Classic Game - FIXED VERSION with Super Uncrash System

// Super Uncrash System - Global Error Handler
window.addEventListener('error', function(e) {
    console.error('Super Uncrash System: Caught global error:', e.error);
    console.error('Error details:', e.message, 'at', e.filename, 'line', e.lineno);
    // Prevent the error from stopping the game
    e.preventDefault();
    return false;
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Super Uncrash System: Caught unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// Error logging utility
function logError(context, error) {
    console.error(`Super Uncrash System [${context}]:`, error);
    // Could extend this to send errors to a server or save locally
}

// Safe function wrapper
function safeExecute(context, func, ...args) {
    try {
        return func.apply(this, args);
    } catch (error) {
        logError(context, error);
        return null;
    }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
// Disabled fog for massive FPS boost
// scene.fog = new THREE.Fog(0x87ceeb, 150, 300);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('gameCanvas'), 
    antialias: false,
    powerPreference: 'high-performance',
    precision: 'lowp',
    stencil: false,
    depth: true
}); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(0.75); // Reduced pixel ratio for major FPS boost
renderer.sortObjects = false;
renderer.autoClear = true;

// Ultra-minimal lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);
// Removed directional light entirely for FPS

// Reusable geometry and materials for instancing
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
// Use MeshBasicMaterial instead of MeshPhongMaterial for better performance
const materials = {
    1: new THREE.MeshBasicMaterial({ color: 0x888888 }), // Stone
    2: new THREE.MeshBasicMaterial({ color: 0x8B6914 }), // Dirt
    3: new THREE.MeshBasicMaterial({ color: 0x3CB371 }), // Grass
    4: new THREE.MeshBasicMaterial({ color: 0x654321 }), // Wood
    5: new THREE.MeshBasicMaterial({ color: 0x228B22 }), // Leaves
    6: new THREE.MeshBasicMaterial({ color: 0xCDAA7D }), // Sand
    7: new THREE.MeshBasicMaterial({ color: 0x8B7765 }), // Gravel
    8: new THREE.MeshBasicMaterial({ color: 0xC0A080 }), // Clay
    9: new THREE.MeshBasicMaterial({ color: 0x4FA3FF }), // Water
    10: new THREE.MeshBasicMaterial({ color: 0xFF4500 }), // Lava
    11: new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), // Obsidian
    12: new THREE.MeshBasicMaterial({ color: 0x000000 }), // Coal Ore
    13: new THREE.MeshBasicMaterial({ color: 0xA89968 }), // Iron Ore
    14: new THREE.MeshBasicMaterial({ color: 0xFFD700 }), // Gold Ore
    15: new THREE.MeshBasicMaterial({ color: 0x00FF00 }), // Diamond Ore
    16: new THREE.MeshBasicMaterial({ color: 0xFF6347 }), // Copper Ore
    17: new THREE.MeshBasicMaterial({ color: 0xCD5C5C }), // Brick
    18: new THREE.MeshBasicMaterial({ color: 0x808080 }), // Concrete
    19: new THREE.MeshBasicMaterial({ color: 0x8B8680 }), // Marble
    20: new THREE.MeshBasicMaterial({ color: 0xF5DEB3 }), // Tiles
    21: new THREE.MeshBasicMaterial({ color: 0xCCCCCC }), // Glass
};

// Player
const player = {
    position: new THREE.Vector3(0, 50, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: 0,
    speed: 0.3,
    jumpForce: 0.6,
    gravity: 0.02,
    selectedBlock: 1
};

// Block types - EXPANDED
const BLOCKS = { 
    AIR: 0, 
    STONE: 1, DIRT: 2, GRASS: 3, WOOD: 4, LEAVES: 5,
    SAND: 6, GRAVEL: 7, CLAY: 8, WATER: 9, LAVA: 10, OBSIDIAN: 11,
    COAL_ORE: 12, IRON_ORE: 13, GOLD_ORE: 14, DIAMOND_ORE: 15, COPPER_ORE: 16,
    BRICK: 17, CONCRETE: 18, MARBLE: 19, TILES: 20, GLASS: 21
};

const BLOCK_NAMES = {
    0: 'Air', 1: 'Stone', 2: 'Dirt', 3: 'Grass', 4: 'Wood', 5: 'Leaves',
    6: 'Sand', 7: 'Gravel', 8: 'Clay', 9: 'Water', 10: 'Lava', 11: 'Obsidian',
    12: 'Coal Ore', 13: 'Iron Ore', 14: 'Gold Ore', 15: 'Diamond Ore', 16: 'Copper Ore',
    17: 'Brick', 18: 'Concrete', 19: 'Marble', 20: 'Tiles', 21: 'Glass'
};

const COLORS = { 
    0: 0xffffff, 1: 0x888888, 2: 0x8B6914, 3: 0x3CB371, 4: 0x654321, 5: 0x228B22,
    6: 0xCDAA7D, 7: 0x8B7765, 8: 0xC0A080, 9: 0x4FA3FF, 10: 0xFF4500, 11: 0x1a1a1a,
    12: 0x000000, 13: 0xA89968, 14: 0xFFD700, 15: 0x00FF00, 16: 0xFF6347,
    17: 0xCD5C5C, 18: 0x808080, 19: 0x8B8680, 20: 0xF5DEB3, 21: 0xCCCCCC
};

// World data
const worldData = new Map();
let meshes = [];

// Settings variables - CHUNK-BASED OPTIMIZATION
let shadowsEnabled = false;
let antialiasEnabled = false;
let renderDistance = 60;  // Increased slightly for smoother experience
let mouseSensitivity = 0.005;
let playerSpeed = 0.3;
let worldSize = 1000;  // Increased for larger world
let lastRenderTime = 0;
let renderThrottleMs = 0;
let skipFrames = 0;
let renderUpdateCounter = 0;

// Chunk system constants
const CHUNK_SIZE = 16;  // 16x16x16 blocks per chunk
const CHUNK_HEIGHT = 16;
const VERTICAL_CHUNKS = 4;  // 64 blocks tall

// Chunk management
const chunkCache = new Map();  // chunkKey -> chunkData
const loadedChunks = new Set();  // Currently loaded chunk keys
let maxChunksLoaded = 2000;  // Increased for larger world

function loadChunksAroundPlayer(px, py, pz, radius) {
    const chunkRadius = Math.ceil(radius / CHUNK_SIZE) + 2;  // Load 2 extra chunks ahead
    const playerChunkX = Math.floor(px / CHUNK_SIZE);
    const playerChunkY = Math.floor(py / CHUNK_HEIGHT);
    const playerChunkZ = Math.floor(pz / CHUNK_SIZE);
    
    // Generate chunks in radius
    for (let cx = playerChunkX - chunkRadius; cx <= playerChunkX + chunkRadius; cx++) {
        for (let cy = Math.max(0, playerChunkY - 1); cy <= Math.min(VERTICAL_CHUNKS - 1, playerChunkY + 1); cy++) {
            for (let cz = playerChunkZ - chunkRadius; cz <= playerChunkZ + chunkRadius; cz++) {
                const chunkKey = `${cx},${cy},${cz}`;
                if (!loadedChunks.has(chunkKey)) {
                    generateChunk(cx, cy, cz);
                }
            }
        }
    }
    
    // Unload distant chunks if over limit
    if (loadedChunks.size > maxChunksLoaded) {
        const chunksToUnload = [];
        for (const chunkKey of loadedChunks) {
            const [cx, cy, cz] = chunkKey.split(',').map(Number);
            const dist = Math.max(Math.abs(cx - playerChunkX), Math.abs(cz - playerChunkZ));
            if (dist > chunkRadius + 2) {
                chunksToUnload.push(chunkKey);
            }
        }
        for (const chunkKey of chunksToUnload) {
            loadedChunks.delete(chunkKey);
            chunkCache.delete(chunkKey);
            // Remove from worldData - but since worldData is global, perhaps keep or remove
            // For simplicity, keep in worldData
        }
    }
}

// Chunk utilities
function getChunkKey(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_HEIGHT);
    const cz = Math.floor(z / CHUNK_SIZE);
    return `${cx},${cy},${cz}`;
}

function getBlockInChunk(x, y, z) {
    const chunkKey = getChunkKey(x, y, z);
    const chunk = chunkCache.get(chunkKey);
    if (!chunk) return BLOCKS.AIR;
    
    const localX = x % CHUNK_SIZE;
    const localY = y % CHUNK_HEIGHT;
    const localZ = z % CHUNK_SIZE;
    const blockKey = `${localX},${localY},${localZ}`;
    return chunk.get(blockKey) || BLOCKS.AIR;
}

// Screen management
function showScreen(screenId) {
    console.log('Switching to screen:', screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        console.log('Screen switched successfully');
    } else {
        console.error('Screen not found:', screenId);
    }
}

// Menu event listeners
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize game directly
        if (meshes.length === 0) {
            safeExecute('generateTerrain', generateTerrain);
            safeExecute('renderWorld', renderWorld);
        }
    } catch (error) {
        logError('DOMContentLoaded', error);
    }
});
function loadSettingsToUI() {
    document.getElementById('shadowsToggle').checked = shadowsEnabled;
    document.getElementById('antialiasToggle').checked = antialiasEnabled;
    document.getElementById('renderDistance').value = renderDistance;
    document.getElementById('renderDistanceValue').textContent = renderDistance;
    document.getElementById('mouseSensitivity').value = mouseSensitivity;
    document.getElementById('mouseSensitivityValue').textContent = mouseSensitivity;
    document.getElementById('playerSpeed').value = playerSpeed;
    document.getElementById('playerSpeedValue').textContent = playerSpeed;
    document.getElementById('worldSize').value = worldSize;
    document.getElementById('worldSizeValue').textContent = worldSize;
}

function saveSettingsFromUI() {
    shadowsEnabled = document.getElementById('shadowsToggle').checked;
    antialiasEnabled = document.getElementById('antialiasToggle').checked;
    renderDistance = parseInt(document.getElementById('renderDistance').value);
    mouseSensitivity = parseFloat(document.getElementById('mouseSensitivity').value);
    playerSpeed = parseFloat(document.getElementById('playerSpeed').value);
    worldSize = parseInt(document.getElementById('worldSize').value);

    // Save to localStorage
    localStorage.setItem('msShop50Settings', JSON.stringify({
        shadowsEnabled,
        antialiasEnabled,
        renderDistance,
        mouseSensitivity,
        playerSpeed,
        worldSize
    }));
}

function loadSettings() {
    const saved = localStorage.getItem('msShop50Settings');
    if (saved) {
        const settings = JSON.parse(saved);
        shadowsEnabled = settings.shadowsEnabled || false;
        antialiasEnabled = settings.antialiasEnabled || false;
        renderDistance = settings.renderDistance || 60;
        mouseSensitivity = settings.mouseSensitivity || 0.005;
        playerSpeed = settings.playerSpeed || 0.3;
        worldSize = settings.worldSize || 80;
    }
}

function applySettings() {
    player.speed = playerSpeed;

    // Reinitialize renderer if antialiasing changed
    if (antialiasEnabled !== (renderer.getPixelRatio() > 1)) {
        const newRenderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: antialiasEnabled
        });
        newRenderer.setSize(window.innerWidth, window.innerHeight);
        // Replace the old renderer
        const canvas = document.getElementById('gameCanvas');
        canvas.parentNode.replaceChild(newRenderer.domElement, canvas);
        newRenderer.domElement.id = 'gameCanvas';
        renderer = newRenderer;
    }

    // Apply shadows
    if (shadowsEnabled) {
        renderer.shadowMap.enabled = true;
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.set(2048, 2048);
        meshes.forEach(mesh => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        });
    } else {
        renderer.shadowMap.enabled = false;
        directionalLight.castShadow = false;
    }
}

function getKey(x, y, z) {
    return Math.floor(x) + ',' + Math.floor(y) + ',' + Math.floor(z);
}

function setBlock(x, y, z, type) {
    worldData.set(getKey(x, y, z), type);
}

function getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y > 100) return BLOCKS.AIR;
    return worldData.get(getKey(x, y, z)) || BLOCKS.AIR;
}

// Generate terrain with chunk-based system
function generateChunk(chunkX, chunkY, chunkZ) {
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    
    if (chunkCache.has(chunkKey)) {
        return chunkCache.get(chunkKey);
    }
    
    const chunk = new Map();
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            
            // Noise-based height
            const noise = Math.sin(worldX * 0.1) * Math.cos(worldZ * 0.1) * 5;
            const height = Math.floor(20 + noise);
            
            for (let y = chunkY * CHUNK_HEIGHT; y < (chunkY + 1) * CHUNK_HEIGHT; y++) {
                let blockType = BLOCKS.AIR;
                
                if (y <= height) {
                    if (y < height - 4) {
                        blockType = BLOCKS.STONE;
                        const rand = Math.random();
                        if (y < 10) {
                            if (rand < 0.02) blockType = BLOCKS.DIAMOND_ORE;
                            else if (rand < 0.05) blockType = BLOCKS.GOLD_ORE;
                        }
                        if (rand < 0.03) blockType = BLOCKS.IRON_ORE;
                        if (rand < 0.04) blockType = BLOCKS.COAL_ORE;
                    } else if (y === height - 1) {
                        blockType = BLOCKS.DIRT;
                    } else if (y === height) {
                        blockType = BLOCKS.GRASS;
                    }
                }
                
                // Add bedrock layer at y=0
                if (y === 0) blockType = BLOCKS.OBSIDIAN;
                
                if (blockType !== BLOCKS.AIR) {
                    const localY = y % CHUNK_HEIGHT;
                    const blockKey = `${x},${localY},${z}`;
                    chunk.set(blockKey, blockType);
                    worldData.set(`${worldX},${y},${worldZ}`, blockType);
                }
            }
            
            // Trees
            if (height > 15 && Math.random() < 0.01) {
                const treeH = 3 + Math.floor(Math.random() * 2);
                for (let i = 0; i < treeH; i++) {
                    const worldY = height + 1 + i;
                    const chunkYTree = Math.floor(worldY / CHUNK_HEIGHT);
                    const localYTree = worldY % CHUNK_HEIGHT;
                    const blockKey = `${x},${localYTree},${z}`;
                    if (chunkYTree === chunkY) {
                        chunk.set(blockKey, BLOCKS.WOOD);
                    }
                    worldData.set(`${worldX},${worldY},${worldZ}`, BLOCKS.WOOD);
                }
                
                // Foliage
                const foliageY = height + 1 + treeH;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (Math.abs(dx) + Math.abs(dz) <= 1) {
                            worldData.set(`${worldX + dx},${foliageY},${worldZ + dz}`, BLOCKS.LEAVES);
                        }
                    }
                }
            }
        }
    }
    
    chunkCache.set(chunkKey, chunk);
    loadedChunks.add(chunkKey);
    return chunk;
}

function generateTerrain() {
    console.log("Generating terrain with chunk system...");
    
    // Pre-generate chunks around spawn
    const spawnChunkX = 0;
    const spawnChunkY = 1;
    const spawnChunkZ = 0;
    
    for (let cx = spawnChunkX - 3; cx <= spawnChunkX + 3; cx++) {
        for (let cy = 0; cy < VERTICAL_CHUNKS; cy++) {
            for (let cz = spawnChunkZ - 3; cz <= spawnChunkZ + 3; cz++) {
                generateChunk(cx, cy, cz);
            }
        }
    }
    
    console.log(`Terrain generated! Chunks: ${loadedChunks.size}, Blocks: ${worldData.size}`);
}

// Render world with EXTREME optimizations
let lastUpdatePos = new THREE.Vector3(0, 0, 0);
let updateThreshold = 3; // Only update when moved 3 units

function renderWorld() {
    renderUpdateCounter++;
    // Only render every 10 frames
    if (renderUpdateCounter % 10 !== 0) return;
    
    const currentPos = new THREE.Vector3(
        Math.floor(player.position.x),
        Math.floor(player.position.y),
        Math.floor(player.position.z)
    );
    
    // Only update if player moved significantly
    const dist = currentPos.distanceTo(lastUpdatePos);
    if (dist < updateThreshold && meshes.length > 0) return;
    
    lastUpdatePos.copy(currentPos);
    
    // Load chunks around player
    loadChunksAroundPlayer(currentPos.x, currentPos.y, currentPos.z, renderDistance);
    
    // Batch remove old meshes
    const oldMeshes = meshes;
    meshes = [];
    oldMeshes.forEach(m => scene.remove(m));

    const px = currentPos.x;
    const pz = currentPos.z;
    const rd = renderDistance;
    const blockLimit = 3000; // Increased for smoother rendering
    let blockCount = 0;

    // Ultra-optimized iteration
    for (let [key, blockType] of worldData) {
        if (blockCount >= blockLimit) break;
        if (blockType === BLOCKS.AIR) continue;

        const [x, y, z] = key.split(',').map(Number);
        
        // Aggressive culling
        if (Math.abs(x - px) > rd || Math.abs(z - pz) > rd) continue;
        if (y < currentPos.y - 5 || y > currentPos.y + 30) continue;
        
        // Create cube with minimal material
        const cube = new THREE.Mesh(boxGeometry, materials[blockType] || materials[1]);
        cube.position.set(x + 0.5, y + 0.5, z + 0.5);

        scene.add(cube);
        meshes.push(cube);
        blockCount++;
    }
}

// Input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape') document.getElementById('instructions').classList.toggle('hidden');
    if (e.key === 'i' || e.key === 'I') {
        const overlay = document.getElementById('inventoryOverlay');
        overlay.classList.toggle('hidden');
    }
    // Support keys 1-9 and 0 for selecting blocks 1-10
    if (e.key >= '0' && e.key <= '9') {
        let blockNum = parseInt(e.key);
        if (blockNum === 0) blockNum = 10; // 0 selects block 10
        if (blockNum <= 21) {
            player.selectedBlock = blockNum;
            updateInventory();
        }
    }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Mouse wheel to cycle blocks
window.addEventListener('wheel', (e) => {
    if (document.getElementById('inventoryOverlay').classList.contains('hidden')) {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        player.selectedBlock += direction;
        if (player.selectedBlock < 1) player.selectedBlock = 21;
        if (player.selectedBlock > 21) player.selectedBlock = 1;
        updateInventory();
    }
}, { passive: false });

// Mouse
const canvas = document.getElementById('gameCanvas');
document.addEventListener('click', () => {
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) return;
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        player.yaw -= e.movementX * mouseSensitivity;
        player.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, player.pitch - e.movementY * mouseSensitivity));
    }
});

// Click to break/place blocks
document.addEventListener('mousedown', (e) => {
    const dir = new THREE.Vector3(
        Math.sin(player.yaw),
        Math.sin(player.pitch),
        -Math.cos(player.yaw)
    );

    for (let i = 0.1; i < 50; i += 0.5) {
        const point = player.position.clone().addScaledVector(dir, i);
        const block = getBlock(point.x, point.y, point.z);

        if (block !== BLOCKS.AIR) {
            if (e.button === 0) {
                setBlock(point.x, point.y, point.z, BLOCKS.AIR);
                updateBlock(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
            } else if (e.button === 2) {
                const backward = dir.clone().multiplyScalar(i - 1);
                const placePos = player.position.clone().add(backward);
                setBlock(placePos.x, placePos.y, placePos.z, player.selectedBlock);
                updateBlock(Math.floor(placePos.x), Math.floor(placePos.y), Math.floor(placePos.z));
            }
            break;
        }
    }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Respawn button
document.getElementById('respawnBtn').addEventListener('click', () => {
    player.position.set(0, 50, 0);
    player.velocity.set(0, 0, 0);
});

// Inventory buttons and items
const closeInventoryBtn = document.getElementById('closeInventoryBtn');
if (closeInventoryBtn) {
    closeInventoryBtn.addEventListener('click', () => {
        document.getElementById('inventoryOverlay').classList.add('hidden');
    });
}

// Inventory item selection
document.querySelectorAll('.inventory-item').forEach(item => {
    item.addEventListener('click', () => {
        const blockNum = parseInt(item.dataset.block);
        player.selectedBlock = blockNum;
        updateInventory();
        document.getElementById('inventoryOverlay').classList.add('hidden');
    });
});

// Inventory
function updateInventory() {
    // Update quick slot bar
    document.querySelectorAll('.inventory-slot').forEach(slot => {
        if (parseInt(slot.dataset.block) === player.selectedBlock) {
            slot.classList.add('active');
        } else {
            slot.classList.remove('active');
        }
    });
    
    // Update inventory overlay items
    document.querySelectorAll('.inventory-item').forEach(item => {
        if (parseInt(item.dataset.block) === player.selectedBlock) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Player physics
function updatePlayer() {
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, Math.sin(player.yaw));
    
    // Calculate intended movement
    const moveVector = new THREE.Vector3(0, 0, 0);
    if (keys['w']) moveVector.add(forward);
    if (keys['s']) moveVector.sub(forward);
    if (keys['a']) moveVector.sub(right);
    if (keys['d']) moveVector.add(right);
    moveVector.normalize().multiplyScalar(player.speed);
    
    // Check horizontal collision
    const newX = player.position.x + moveVector.x;
    const newZ = player.position.z + moveVector.z;
    
    // Check if new position is blocked
    let canMoveX = true;
    let canMoveZ = true;
    
    for (let dy = -1; dy <= 0; dy++) {
        if (getBlock(newX, player.position.y + dy, player.position.z) !== BLOCKS.AIR) {
            canMoveX = false;
        }
        if (getBlock(player.position.x, player.position.y + dy, newZ) !== BLOCKS.AIR) {
            canMoveZ = false;
        }
    }
    
    if (canMoveX) player.position.x = newX;
    if (canMoveZ) player.position.z = newZ;
    
    player.velocity.y -= player.gravity;
    player.position.y += player.velocity.y;
    
    // Check ground
    let onGround = false;
    for (let dx = -0.3; dx <= 0.3; dx += 0.3) {
        for (let dz = -0.3; dz <= 0.3; dz += 0.3) {
            if (getBlock(player.position.x + dx, player.position.y - 1.5, player.position.z + dz) !== BLOCKS.AIR) {
                onGround = true;
                break;
            }
        }
        if (onGround) break;
    }
    
    if (onGround) {
        player.velocity.y = 0;
        player.position.y = Math.ceil(player.position.y);
        if (keys[' ']) player.velocity.y = player.jumpForce;
    }
    
    if (player.position.y < -50) {
        player.position.set(0, 50, 0);
        player.velocity.set(0, 0, 0);
    }
}

// Stats
let frameCount = 0, lastTime = Date.now();
function updateStats() {
    const now = Date.now();
    if (now - lastTime >= 1000) {
        document.getElementById('fps').textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = now;
        // Update coordinates less frequently to reduce DOM thrashing
        document.getElementById('coordinates').textContent = 
            `X: ${Math.floor(player.position.x)}, Y: ${Math.floor(player.position.y)}, Z: ${Math.floor(player.position.z)}`;
    }
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize game
console.log("Starting MSshop50...");
showScreen('gameContainer');
updateInventory();

function animate() {
    requestAnimationFrame(animate);

    // Only update game if we're in game screen
    if (document.getElementById('gameContainer').classList.contains('active')) {
        updatePlayer();
        
        // Update render world very infrequently
        if (frameCount % 30 === 0) {
            renderWorld();
        }
        
        camera.position.copy(player.position);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;

        renderer.render(scene, camera);
        
        // Update stats even less frequently
        if (frameCount % 30 === 0) {
            updateStats();
        }
    }
    frameCount++;
}

animate();
console.log("MSshop50 ready!");
