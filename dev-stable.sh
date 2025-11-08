#!/bin/bash

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starte Bro Split App (Stabil-Modus mit Auto-Restart)${NC}\n"

# Cleanup-Funktion
cleanup() {
    echo -e "\n${YELLOW}🛑 Stoppe Server...${NC}"
    
    # Beende alle Child-Prozesse
    jobs -p | xargs -r kill 2>/dev/null
    
    # Räume Ports auf
    lsof -ti:3001 | xargs kill -9 2>/dev/null
    lsof -ti:5173,5174 | xargs kill -9 2>/dev/null
    
    echo -e "${GREEN}✅ Cleanup abgeschlossen${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C) und SIGTERM
trap cleanup SIGINT SIGTERM

# Initial Cleanup
echo -e "${BLUE}🧹 Cleanup: Beende alte Prozesse...${NC}"
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173,5174 | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}✅ Cleanup abgeschlossen${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Starte Backend mit Nodemon (Auto-Restart bei Änderungen)
echo -e "${BLUE}🔵 [Backend] Starte mit Nodemon (Auto-Restart aktiv)...${NC}"
(cd "$SCRIPT_DIR/server" && npx nodemon server.js) &
BACKEND_PID=$!

# Warte bis Backend ready ist
sleep 3

# Starte Frontend
echo -e "${GREEN}🟢 [Frontend] Starte Vite...${NC}\n"
(cd "$SCRIPT_DIR/client" && npm run dev) &
FRONTEND_PID=$!

echo -e "${GREEN}✅ Server gestartet!${NC}\n"
echo -e "${BLUE}📱 Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}🔌 Backend:  http://localhost:3001${NC}\n"
echo -e "${YELLOW}💡 Backend startet automatisch bei Änderungen neu${NC}"
echo -e "${YELLOW}💡 Drücke CTRL+C zum Beenden${NC}\n"

# Warte auf alle Background-Jobs
wait
