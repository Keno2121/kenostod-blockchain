const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let filePath;
    if (req.url === '/' || req.url === '/snap.manifest.json') {
        filePath = path.join(__dirname, 'snap.manifest.json');
        res.setHeader('Content-Type', 'application/json');
    } else if (req.url === '/dist/bundle.js') {
        filePath = path.join(__dirname, 'dist', 'bundle.js');
        res.setHeader('Content-Type', 'application/javascript');
    } else {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200);
        res.end(data);
    } catch (e) {
        res.writeHead(500);
        res.end('Error reading file');
    }
});

server.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log('  UTL Snap Server Running!');
    console.log('===========================================');
    console.log('');
    console.log('  Serving at: http://localhost:' + PORT);
    console.log('');
    console.log('  Now go back to the UTL Snap Control Panel');
    console.log('  and click "Install UTL Snap"');
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('===========================================');
});
