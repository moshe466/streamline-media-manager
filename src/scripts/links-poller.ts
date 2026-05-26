import 'dotenv/config';
import http from 'http';
import { getDb } from '@/lib/firebase-admin';
import { notifyAdminOnSecureLinkCreated } from '@/services/notifications';

type SecureLinkDoc = {
  streamName?: string;
  instanceId?: string;
  createdBy?: string;
  appHost?: string;
  createdVia?: 'app' | 'bot';
  announcedToTelegramAt?: any;
  createdAt?: any;
  expiresAt?: any;
};

const POLL_INTERVAL_MS = Number(process.env.LINKS_POLLER_INTERVAL_MS || 5000);
const PORT = Number(process.env.PORT || 8080);

let lastRunAt: string | null = null;
let lastError: string | null = null;
let processedCount = 0;

http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'links-poller',
      lastRunAt,
      lastError,
      processedCount,
      uptime: process.uptime(),
    }));
  })
  .listen(PORT, () => {
    console.log(`✅ links-poller health server listening on ${PORT}`);
  });

async function scanForUnannouncedLinks() {
  const db = getDb();
  lastRunAt = new Date().toISOString();

  const snapshot = await db
    .collection('secure_links')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const data = doc.data() as SecureLinkDoc;

    if (data.announcedToTelegramAt) continue;

    try {
      const expiresAt =
        typeof data.expiresAt?.toDate === 'function'
          ? data.expiresAt.toDate()
          : data.expiresAt
          ? new Date(data.expiresAt)
          : null;

      if (expiresAt && expiresAt < new Date()) {
        await doc.ref.set({
          announcedToTelegramAt: new Date(),
          announcedToTelegramSource: 'expired_skip',
        }, { merge: true });
        continue;
      }
    } catch (e) {
      console.error('LINKS POLLER expiry parse error', doc.id, e);
    }

    const streamName = data.streamName || 'לא ידוע';
    const actorName = data.createdBy || 'לא ידוע';
    const appHost = data.appHost || 'mcr.uhdrones.org.il';
    const source = data.createdVia === 'bot' ? 'bot' : 'app';

    try {
      await notifyAdminOnSecureLinkCreated(streamName, actorName, doc.id, appHost, source);

      await doc.ref.set({
        announcedToTelegramAt: new Date(),
        announcedToTelegramSource: `poller_${source}`,
      }, { merge: true });

      processedCount++;

      console.log('LINK ANNOUNCED', {
        id: doc.id,
        streamName,
        actorName,
        source,
        appHost,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error('LINKS POLLER announce failed', {
        id: doc.id,
        streamName,
        actorName,
        source,
        appHost,
        error: lastError,
      });
    }
  }
}

async function runOnce() {
  try {
    await scanForUnannouncedLinks();
    lastError = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error('links-poller cycle failed:', err);
  }
}

async function main() {
  console.log(`🚀 links-poller started every ${POLL_INTERVAL_MS}ms`);
  await runOnce();
  setInterval(runOnce, POLL_INTERVAL_MS);
}

main().catch((err) => {
  lastError = err instanceof Error ? err.message : String(err);
  console.error('links-poller fatal error:', err);
  process.exit(1);
});
