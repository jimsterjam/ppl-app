#!/usr/bin/env bash
# Setup-Skript für Claude-Code-Cloud-Sessions (claude.ai/code).
# In der Cloud-Umgebung als Setup-Skript eintragen:  bash scripts/cloud-setup.sh
# Installiert die Abhängigkeiten für Root (Lint), server und client - wie in .github/workflows/ci.yml.
set -euo pipefail

cd "$(dirname "$0")/.."

WANTED_MAJOR="$(cut -d. -f1 .node-version 2>/dev/null || echo 24)"
CURRENT="$(node --version 2>/dev/null || echo 'nicht installiert')"
CURRENT_MAJOR="$(echo "$CURRENT" | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$CURRENT_MAJOR" != "$WANTED_MAJOR" ]; then
  echo "WARNUNG: Node $CURRENT, Projekt erwartet Node $WANTED_MAJOR (.node-version, CI)." >&2
fi

echo "== npm ci (Root) =="
npm ci --no-audit --no-fund

echo "== npm ci (server) =="
(cd server && npm ci --no-audit --no-fund)

echo "== npm ci (client) =="
(cd client && npm ci --no-audit --no-fund)

echo "Setup fertig."
