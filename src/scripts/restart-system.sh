#!/usr/bin/env bash
set +e

pkill -f stream-poller 2>/dev/null || true
pkill -f links-poller 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

export CRON_SECRET="$(grep '^CRON_SECRET=' .env 2>/dev/null | cut -d '=' -f2-)"

nohup bash -c 'while true; do npm run dev; echo "❌ NEXT CRASHED - restarting in 2s"; sleep 2; done' > next.log 2>&1 &
sleep 3

nohup bash -c 'while true; do npx tsx src/scripts/stream-poller.ts; echo "❌ STREAM POLLER CRASHED - restarting in 2s"; sleep 2; done' > poller.log 2>&1 &
sleep 2

nohup bash -c 'while true; do npx tsx src/scripts/links-poller.ts; echo "❌ LINKS POLLER CRASHED - restarting in 2s"; sleep 2; done' > links-poller.log 2>&1 &
