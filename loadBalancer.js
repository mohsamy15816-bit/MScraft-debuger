const cluster = require('cluster');
const express = require('express');
const httpProxy = require('http-proxy');

// Load balancer for distributing traffic across multiple server instances
const app = express();

// Create proxy instances
const serverInstances = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
];

let currentInstance = 0;

// Proxy middleware for load balancing
app.use((req, res, next) => {
    const proxy = httpProxy.createProxyServer({});
    
    proxy.on('error', (err, req, res) => {
        console.error('Proxy error:', err);
        // Try next instance on error
        currentInstance = (currentInstance + 1) % serverInstances.length;
        proxy.web(req, res, { target: serverInstances[currentInstance] }, (err) => {
            res.status(503).json({ error: 'Service temporarily unavailable' });
        });
    });

    // Round-robin load balancing
    const target = serverInstances[currentInstance];
    currentInstance = (currentInstance + 1) % serverInstances.length;
    
    proxy.web(req, res, { target });
});

// WebSocket upgrade
const http = require('http');
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
    const proxy = httpProxy.createProxyServer({ ws: true });
    const target = serverInstances[currentInstance];
    currentInstance = (currentInstance + 1) % serverInstances.length;
    
    proxy.ws(req, socket, head, { target }, (err) => {
        console.error('WebSocket proxy error:', err);
    });
});

const LOAD_BALANCER_PORT = process.env.LOAD_BALANCER_PORT || 8000;
server.listen(LOAD_BALANCER_PORT, () => {
    console.log(`Load Balancer listening on port ${LOAD_BALANCER_PORT}`);
    console.log(`distributing traffic across ${serverInstances.length} server instances`);
});
