#!/usr/bin/env bash
set +e

STATUS_FILE="restart-status.json"

echo "{\"status\":\"starting\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":null}" > "$STATUS_FILE"

pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "stream-poller" 2>/dev/null || true
pkill -f "links-poller" 2>/dev/null || true

export CRON_SECRET="$(grep '^CRON_SECRET=' .env 2>/dev/null | cut -d '=' -f2-)"

nohup bash -c '
while true; do
  npm run dev
  echo "$(date -Iseconds) ❌ NEXT CRASHED - restarting in 2s" >> next.log
  sleep 2
done
' > next.log 2>&1 &

sleep 4

nohup bash -c '
while true; do
  npx tsx src/scripts/stream-poller.ts
  echo "$(date -Iseconds) ❌ STREAM POLLER CRASHED - restarting in 2s" >> poller.log
  sleep 2
done
' > poller.log 2>&1 &

sleep 3

nohup bash -c '
while true; do
  npx tsx src/scripts/links-poller.ts
  echo "$(date -Iseconds) ❌ LINKS POLLER CRASHED - restarting in 2s" >> links-poller.log
  sleep 2
done
' > links-poller.log 2>&1 &

sleep 5

NEXT_OK="false"
STREAM_OK="false"
LINKS_OK="false"

ps aux | grep "next dev" | grep -v grep >/dev/null 2>&1 && NEXT_OK="true"
ps aux | grep "stream-poller" | grep -v grep >/dev/null 2>&1 && STREAM_OK="true"
ps aux | grep "links-poller" | grep -v grep >/dev/null 2>&1 && LINKS_OK="true"

if [[ "$NEXT_OK" == "true" && "$STREAM_OK" == "true" && "$LINKS_OK" == "true" ]]; then
  echo "{\"status\":\"success\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":\"$(date -Iseconds)\",\"next\":\"$NEXT_OK\",\"streamPoller\":\"$STREAM_OK\",\"linksPoller\":\"$LINKS_OK\"}" > "$STATUS_FILE"
else
  echo "{\"status\":\"failed\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":\"$(date -Iseconds)\",\"next\":\"$NEXT_OK\",\"streamPoller\":\"$STREAM_OK\",\"linksPoller\":\"$LINKS_OK\"}" > "$STATUS_FILE"
fi
