'use client';

import { useEffect, useState } from 'react';

function getViewerSessionId(linkId: string) {
  const key = `mizrachi_link_session_${linkId}`;

  try {
    let sessionId = window.sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
  } catch {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function LinkViewHeartbeat({ linkId }: { linkId: string }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!linkId) return;

    let stopped = false;
    const sessionId = getViewerSessionId(linkId);

    async function sendHeartbeat() {
      if (stopped) return;

      try {
        const res = await fetch('/api/link-analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId, sessionId }),
        });

        if (res.status === 403) {
          const data = await res.json().catch(() => null);
          if (data?.blocked) {
            setBlocked(true);
          }
        }
      } catch (error) {
        console.error('link heartbeat failed', error);
      }
    }

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 10_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [linkId]);

  if (!blocked) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 text-white text-center p-6">
      <div className="max-w-md rounded-xl border border-red-500/40 bg-red-950/40 p-6">
        <div className="text-3xl mb-3">⛔</div>
        <h1 className="text-xl font-bold mb-2">הלינק נחסם</h1>
        <p className="text-sm text-gray-300">
          הצפייה בקישור זה הופסקה על ידי מנהל המערכת.
        </p>
      </div>
    </div>
  );
}
