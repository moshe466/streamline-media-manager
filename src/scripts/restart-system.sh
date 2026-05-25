#!/usr/bin/env bash
set +e

STATUS_FILE="restart-status.json"
NOTIFY_CHAT_ID="$1"

echo "{\"status\":\"starting\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":null,\"notifyChatId\":\"${NOTIFY_CHAT_ID}\"}" > "$STATUS_FILE"

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
sleep 3

NEXT_OK="false"
STREAM_OK="false"
LINKS_OK="false"

ps aux | grep "next dev" | grep -v grep >/dev/null 2>&1 && NEXT_OK="true"
ps aux | grep "stream-poller" | grep -v grep >/dev/null 2>&1 && STREAM_OK="true"
ps aux | grep "links-poller" | grep -v grep >/dev/null 2>&1 && LINKS_OK="true"

if [[ "$NEXT_OK" == "true" && "$STREAM_OK" == "true" && "$LINKS_OK" == "true" ]]; then
  echo "{\"status\":\"success\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":\"$(date -Iseconds)\",\"next\":\"$NEXT_OK\",\"streamPoller\":\"$STREAM_OK\",\"linksPoller\":\"$LINKS_OK\",\"notifyChatId\":\"${NOTIFY_CHAT_ID}\"}" > "$STATUS_FILE"
  if [[ -n "$NOTIFY_CHAT_ID" ]]; then
    nohup npx tsx src/scripts/send-restart-success.ts "$NOTIFY_CHAT_ID" success > restart-notify.log 2>&1 &
  fi
else
  echo "{\"status\":\"failed\",\"startedAt\":\"$(date -Iseconds)\",\"finishedAt\":\"$(date -Iseconds)\",\"next\":\"$NEXT_OK\",\"streamPoller\":\"$STREAM_OK\",\"linksPoller\":\"$LINKS_OK\",\"notifyChatId\":\"${NOTIFY_CHAT_ID}\"}" > "$STATUS_FILE"
  if [[ -n "$NOTIFY_CHAT_ID" ]]; then
    nohup npx tsx src/scripts/send-restart-success.ts "$NOTIFY_CHAT_ID" failed > restart-notify.log 2>&1 &
  fi
fi
