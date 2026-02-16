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

function findFile(dir, baseName, ext) {
    const exact = path.join(dir, baseName + ext);
    if (fs.existsSync(exact)) return exact;

    const withOne = path.join(dir, baseName + ' (1)' + ext);
    if (fs.existsSync(withOne)) return withOne;

    const withTwo = path.join(dir, baseName + ' (2)' + ext);
    if (fs.existsSync(withTwo)) return withTwo;

    try {
        const files = fs.readdirSync(dir);
        const match = files.find(f => f.startsWith(baseName) && f.endsWith(ext));
        if (match) return path.join(dir, match);
    } catch (e) {}

    return null;
}

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
        filePath = findFile(BASE, 'snap.manifest', '.json');
    } else if (req.url === '/dist/bundle.js') {
        const distDir = path.join(BASE, 'dist');
        filePath = findFile(distDir, 'bundle', '.js');
    } else if (req.url === '/serve-snap.js') {
        filePath = findFile(BASE, 'serve-snap', '.js');
    } else {
        const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
        filePath = path.join(BASE, safePath);
    }

    if (!filePath || !fs.existsSync(filePath)) {
        console.log('  [404] ' + req.url + ' - file not found');
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    console.log('  [200] ' + req.url + ' -> ' + path.basename(filePath));
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log('  UTL Snap Server Running!');
    console.log('  Serving at: http://localhost:' + PORT);
    console.log('===========================================');
    console.log('');
    console.log('Now go back to the UTL Snap Control Panel');
    console.log('and click "Install UTL Snap".');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    const manifestPath = findFile(BASE, 'snap.manifest', '.json');
    const bundlePath = findFile(path.join(BASE, 'dist'), 'bundle', '.js');

    if (manifestPath) {
        console.log('  Found: ' + path.basename(manifestPath));
    } else {
        console.log('  WARNING: snap.manifest.json NOT FOUND!');
    }
    if (bundlePath) {
        console.log('  Found: dist/' + path.basename(bundlePath));
    } else {
        console.log('  WARNING: dist/bundle.js NOT FOUND!');
    }
    console.log('');
});
