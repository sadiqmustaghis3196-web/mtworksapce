#!/usr/bin/env bash
# MT Nexus Global ERP — Development Environment Starter
# Starts PostgreSQL, Backend Express API, and Frontend Static Server

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="/Users/mac/development/Postgres.app/Contents/Versions/16/bin"
PG_DATA="/Users/mac/development/postgres_data"

echo "======================================================="
echo "🚀 Starting MT Nexus Global Development Services"
echo "======================================================="

# 1. Start PostgreSQL if not already running
if "$PG_BIN/pg_isready" > /dev/null 2>&1; then
  echo "✅ PostgreSQL is already running."
else
  echo "🔄 Starting PostgreSQL..."
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_DATA/server.log" start
  "$PG_BIN/pg_isready"
  echo "✅ PostgreSQL started."
fi

# 2. Check & Start Backend API (Port 5000)
if lsof -i :5000 > /dev/null 2>&1; then
  echo "✅ Backend API is already running on http://127.0.0.1:5000"
else
  echo "🔄 Starting Backend Express API on port 5000..."
  (cd "$DIR/server" && nohup node src/app.js > "$DIR/server/server.log" 2>&1 &)
  sleep 2
  echo "✅ Backend API started (Logs: server/server.log)"
fi

# 3. Check & Start Frontend Static Server (Port 8000)
if lsof -i :8000 > /dev/null 2>&1; then
  echo "✅ Frontend Static Server is already running on http://localhost:8000"
else
  echo "🔄 Starting Frontend Server on port 8000..."
  (cd "$DIR" && nohup python3 scripts/serve.py > /dev/null 2>&1 &)
  sleep 1
  echo "✅ Frontend Static Server started on http://localhost:8000"
fi

echo "======================================================="
echo "🌐 Login URL: http://localhost:8000/login.html"
echo "🌐 Workspace: http://localhost:8000/index.html"
echo "📡 Health Check: http://127.0.0.1:5000/api/health"
echo "======================================================="
