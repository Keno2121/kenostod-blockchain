const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function computeShasum(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('base64');
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

    if (req.url === '/' || req.url === '/snap.manifest.json') {
        const manifestPath = findFile(BASE, 'snap.manifest', '.json');
        const bundlePath = findFile(path.join(BASE, 'dist'), 'bundle', '.js');
        if (!manifestPath) { res.writeHead(404); res.end('Manifest not found'); return; }
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            if (bundlePath) {
                const correctShasum = computeShasum(bundlePath);
                if (manifest.source && manifest.source.shasum !== correctShasum) {
                    console.log('  [FIX] Updating shasum to match bundle.js');
                    console.log('        Old: ' + manifest.source.shasum);
                    console.log('        New: ' + correctShasum);
                    manifest.source.shasum = correctShasum;
                }
            }
            const json = JSON.stringify(manifest, null, 2);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(json);
            console.log('  [200] /snap.manifest.json (shasum auto-corrected)');
        } catch (e) {
            console.log('  [500] Error reading manifest: ' + e.message);
            res.writeHead(500);
            res.end('Error reading manifest');
        }
        return;
    }

    let filePath;
    if (req.url === '/dist/bundle.js') {
        filePath = findFile(path.join(BASE, 'dist'), 'bundle', '.js');
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
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log('  UTL Snap Server Running!');
    console.log('  Serving at: http://localhost:' + PORT);
    console.log('===========================================');

    const manifestPath = findFile(BASE, 'snap.manifest', '.json');
    const bundlePath = findFile(path.join(BASE, 'dist'), 'bundle', '.js');

    if (manifestPath) console.log('  Found: ' + path.basename(manifestPath));
    else console.log('  WARNING: snap.manifest.json NOT FOUND!');

    if (bundlePath) {
        console.log('  Found: dist/' + path.basename(bundlePath));
        const shasum = computeShasum(bundlePath);
        console.log('  Bundle shasum: ' + shasum);
    } else {
        console.log('  WARNING: dist/bundle.js NOT FOUND!');
    }

    console.log('');
    console.log('  Shasum will be auto-corrected when MetaMask requests the manifest.');
    console.log('  Click "Install UTL Snap" on the website.');
    console.log('');
});
