/**
 * The King's Shield — Static Server
 * Simple Express server for Render.com deployment
 */
const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag:   true,
}));

// Serve root files (index.html, style.css, app.js)
app.use(express.static(__dirname, {
  index: 'index.html',
  maxAge: '1h',
}));

// Health check for Render
app.get('/health', (req, res) => res.json({ ok: true, token: 'SHIELD', constant: 6174 }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚔  The King's Shield running on port ${PORT}`);
  console.log(`   Kaprekar's Constant: 6174 — All paths converge.`);
});
