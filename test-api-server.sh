#!/bin/bash
cd /Users/hongphat/Projects/desktop-portfolio
node api-server-simple.js &
SERVER_PID=$!
sleep 2
echo "Testing API..."
curl http://localhost:3001/api/test-minimal
echo ""
curl http://localhost:3001/api/stocks/list
echo ""
kill $SERVER_PID 2>/dev/null

