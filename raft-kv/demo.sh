#!/usr/bin/env bash
# Usage: ./demo.sh   (after `docker compose up -d --build`)
set -e
sleep 2
for p in 8081 8082 8083; do curl -s localhost:$p/status; echo; done
LEADER_PORT=$(for p in 8081 8082 8083; do curl -s localhost:$p/status | grep -q '"role":"leader"' && echo $p; done | head -1)
echo "leader is on port $LEADER_PORT"
curl -s -X PUT -d 'world' localhost:$LEADER_PORT/kv/hello
echo "killing leader..."; docker kill $(docker ps -q --filter publish=$LEADER_PORT)
sleep 2
for p in 8081 8082 8083; do curl -s -m1 localhost:$p/status; echo; done
