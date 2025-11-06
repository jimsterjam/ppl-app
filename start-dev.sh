#!/bin/bash

# Bro Split App - Development Starter with Auto-Restart
echo "🚀 Starting Bro Split App Development Environment"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Shutting down development environment..."
    pkill -P $$ 2>/dev/null || true
    pkill -f "node server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Check if ports are available
echo "📋 Checking ports..."
if lsof -i :3001 >/dev/null 2>&1; then
    echo "⚠️  Port 3001 is already in use - killing..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

if lsof -i :5173 >/dev/null 2>&1; then
    echo "⚠️  Port 5173 is already in use - killing..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Backend Wrapper mit Auto-Restart
start_backend() {
    while true; do
        echo "🔧 Starting Backend Server..."
        cd /Users/testadmin/Documents/bro-split-app/server
        node server.js 2>&1 | tee /tmp/backend.log
        EXIT_CODE=$?
        if [ $EXIT_CODE -ne 0 ]; then
            echo "❌ Backend crashed with code $EXIT_CODE - Restarting in 3s..."
            sleep 3
        else
            echo "✅ Backend stopped normally"
            break
        fi
    done
}

# Frontend Wrapper mit Auto-Restart
start_frontend() {
    sleep 3 # Backend-Zeit zum Starten
    while true; do
        echo "🎨 Starting Frontend Client..."
        cd /Users/testadmin/Documents/bro-split-app/client
        npm run dev 2>&1 | tee /tmp/frontend.log
        EXIT_CODE=$?
        if [ $EXIT_CODE -ne 0 ]; then
            echo "❌ Frontend crashed with code $EXIT_CODE - Restarting in 3s..."
            sleep 3
        else
            echo "✅ Frontend stopped normally"
            break
        fi
    done
}

# Start beide Services im Hintergrund
start_backend &
BACKEND_WRAPPER_PID=$!

start_frontend &
FRONTEND_WRAPPER_PID=$!

sleep 5

echo ""
echo "✅ Development environment started!"
echo "📱 Frontend: http://localhost:5173"
echo "🔌 Backend: http://localhost:3001"
echo "🧪 Test Dashboard: http://localhost:5173/features-test"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/backend.log"
echo "   Frontend: tail -f /tmp/frontend.log"
echo ""
echo "🔄 Auto-Restart enabled (services restart on crash)"
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for wrapper processes
wait $BACKEND_WRAPPER_PID $FRONTEND_WRAPPER_PID