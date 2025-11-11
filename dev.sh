#!/bin/bash

# Bro Split App - Robuster Development Start Script
# Startet Frontend & Backend mit Auto-Restart bei Crashes

set -e

echo "🚀 Starte Bro Split App Development Server..."
echo ""

# Cleanup alte Prozesse
echo "🧹 Cleanup: Beende alte Node-Prozesse auf Port 3001 und 5173/5174..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:5174 | xargs kill -9 2>/dev/null || true

echo "✅ Cleanup abgeschlossen"
echo ""

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktion für Backend-Start mit Auto-Restart
start_backend() {
  while true; do
    echo -e "${BLUE}🔵 [Backend] Starte Server...${NC}"
    cd /Users/testadmin/Documents/bro-split-app/server
    npm start || {
      echo -e "${YELLOW}⚠️  [Backend] Crash erkannt, restarte in 2 Sekunden...${NC}"
      sleep 2
    }
  done
}

# Funktion für Frontend-Start mit Auto-Restart
start_frontend() {
  while true; do
    echo -e "${GREEN}🟢 [Frontend] Starte Vite...${NC}"
    cd /Users/testadmin/Documents/bro-split-app/client
    npm run dev || {
      echo -e "${YELLOW}⚠️  [Frontend] Crash erkannt, restarte in 2 Sekunden...${NC}"
      sleep 2
    }
  done
}

# Cleanup-Handler bei CTRL+C
cleanup() {
  echo ""
  echo "🛑 Stoppe Server..."
  kill $(jobs -p) 2>/dev/null || true
  lsof -ti:3001 | xargs kill -9 2>/dev/null || true
  lsof -ti:5173 | xargs kill -9 2>/dev/null || true
  lsof -ti:5174 | xargs kill -9 2>/dev/null || true
  echo "✅ Server gestoppt"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Starte beide Server parallel
echo "▶️  Starte Server (CTRL+C zum Beenden)..."
echo ""

start_backend &
BACKEND_PID=$!

sleep 2  # Warte kurz, damit Backend zuerst startet

start_frontend &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Server gestartet!${NC}"
echo ""
echo "📱 Frontend: http://localhost:5174"
echo "🔌 Backend:  http://localhost:3001"
echo ""
echo "💡 Drücke CTRL+C zum Beenden"
echo ""

# Warte auf beide Prozesse
wait
