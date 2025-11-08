#!/bin/bash

# Watchdog für Backend-Server
# Startet Server automatisch neu bei Crash

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

RESTART_COUNT=0
MAX_RESTARTS=10

echo -e "${BLUE}🐕 Backend Watchdog aktiv${NC}\n"

while true; do
    echo -e "${GREEN}▶️  Starte Backend (Versuch $((RESTART_COUNT + 1)))...${NC}"
    
    cd /Users/testadmin/Documents/bro-split-app/server
    node server.js
    
    EXIT_CODE=$?
    RESTART_COUNT=$((RESTART_COUNT + 1))
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Backend sauber beendet${NC}"
        break
    fi
    
    echo -e "${RED}❌ Backend crashed mit Code $EXIT_CODE${NC}"
    
    if [ $RESTART_COUNT -ge $MAX_RESTARTS ]; then
        echo -e "${RED}🛑 Max Restarts erreicht ($MAX_RESTARTS), gebe auf${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⏳ Warte 2 Sekunden vor Neustart...${NC}\n"
    sleep 2
done
