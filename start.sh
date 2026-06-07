#!/bin/bash
echo "[Sovereign Bots] Installing Python dependencies..."
pip3 install -r requirements.txt --quiet --no-warn-script-location 2>&1 || true
echo "[Sovereign Bots] Python deps ready. Starting bot server..."
exec node bot-server.js
