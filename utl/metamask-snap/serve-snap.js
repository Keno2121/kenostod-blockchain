const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BASE = __dirname;

const MIME_TYPES = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.html': 'text/html'
};

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
        filePath = path.join(BASE, 'snap.manifest.json');
    } else if (req.url === '/dist/bundle.js') {
        filePath = path.join(BASE, 'dist', 'bundle.js');
    } else {
        const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
        filePath = path.join(BASE, safePath);
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log('  UTL Snap Server Running!');
    console.log(`  http://localhost:${PORT}`);
    console.log('===========================================');
    console.log('');
    console.log('Keep this terminal open.');
    console.log('Go back to the UTL Snap page and click "Install UTL Snap".');
    console.log('');
});
