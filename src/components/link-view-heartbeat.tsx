'use client';

import { useEffect } from 'react';

export function LinkViewHeartbeat({ linkId }: { linkId: string }) {
  useEffect(() => {
    if (!linkId) return;

    let stopped = false;

    async function sendHeartbeat() {
      if (stopped) return;

      try {
        await fetch('/api/link-analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId }),
        });
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

  return null;
}
