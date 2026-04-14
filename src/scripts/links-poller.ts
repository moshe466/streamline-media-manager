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

const POLL_INTERVAL_MS = 5000;

async function scanForUnannouncedLinks() {
  const db = getDb();

  const snapshot = await db
    .collection('secure_links')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  if (snapshot.empty) return;

  for (const doc of snapshot.docs) {
    const data = doc.data() as SecureLinkDoc;

    // כבר הוכרז
    if (data.announcedToTelegramAt) continue;

    // אם פג תוקף, לא צריך להכריז
    try {
      const expiresAt =
        typeof data.expiresAt?.toDate === 'function'
          ? data.expiresAt.toDate()
          : data.expiresAt
          ? new Date(data.expiresAt)
          : null;

      if (expiresAt && expiresAt < new Date()) {
        await doc.ref.set(
          {
            announcedToTelegramAt: new Date(),
            announcedToTelegramSource: 'expired_skip',
          },
          { merge: true }
        );
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

      await doc.ref.set(
        {
          announcedToTelegramAt: new Date(),
          announcedToTelegramSource: `poller_${source}`,
        },
        { merge: true }
      );

      console.log('LINK ANNOUNCED', {
        id: doc.id,
        streamName,
        actorName,
        source,
        appHost,
      });
    } catch (err) {
      console.error('LINKS POLLER announce failed', {
        id: doc.id,
        streamName,
        actorName,
        source,
        appHost,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function main() {
  console.log('🚀 links-poller started (5s)');
  await scanForUnannouncedLinks();

  setInterval(async () => {
    try {
      await scanForUnannouncedLinks();
    } catch (err) {
      console.error('links-poller cycle failed:', err);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error('links-poller fatal error:', err);
  process.exit(1);
});
