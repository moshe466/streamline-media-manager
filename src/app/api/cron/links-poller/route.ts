import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { notifyAdminOnSecureLinkCreated } from '@/services/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET || '';
    const auth = request.headers.get('authorization') || '';

    if (expectedSecret && auth !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    const snapshot = await db
      .collection('secure_links')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    let checkedCount = 0;
    let announcedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const doc of snapshot.docs) {
      checkedCount++;

      const data = doc.data() as SecureLinkDoc;

      if (data.announcedToTelegramAt) {
        skippedCount++;
        continue;
      }

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
          skippedCount++;
          continue;
        }
      } catch (e) {
        console.error('links cron expiry parse error', doc.id, e);
      }

      const streamName = data.streamName || 'לא ידוע';
      const actorName = data.createdBy || 'לא ידוע';
      const appHost = data.appHost || 'mcr.uhdrones.org.il';
      const source = data.createdVia === 'bot' ? 'bot' : 'app';

      try {
        await notifyAdminOnSecureLinkCreated(streamName, actorName, doc.id, appHost, source);

        await doc.ref.set({
          announcedToTelegramAt: new Date(),
          announcedToTelegramSource: `cron_${source}`,
        }, { merge: true });

        announcedCount++;
      } catch (error) {
        failedCount++;
        console.error('links cron announce failed', {
          id: doc.id,
          streamName,
          actorName,
          source,
          appHost,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      checkedCount,
      announcedCount,
      skippedCount,
      failedCount,
    });
  } catch (error) {
    console.error('links poller cron failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
