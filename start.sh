#!/bin/bash
echo "[Sovereign Bots] Installing Python dependencies..."
# Use python3 -m pip (more reliable than bare pip3 on Render)
python3 -m pip install requests base58 --quiet --no-warn-script-location 2>&1
echo "[Sovereign Bots] Core Python deps done (requests, base58)"
python3 -m pip install solana solders --quiet --no-warn-script-location 2>&1 || \
  echo "[Sovereign Bots] solana/solders optional — scan-only mode if missing"
echo "[Sovereign Bots] Starting bot server..."
exec node bot-server.js
