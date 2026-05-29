import { NextResponse } from 'next/server';
import { getStreams } from '@/services/flussonic';
import { getDb } from '@/lib/firebase-admin';
import { notifyStreamOnline, notifyStreamOffline } from '@/services/notifications';
import { getMonitoredStreams } from '@/services/telegram-alerts';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const CACHE_DOC_REF = getDb().collection('system_status').doc('streams_pilot_cache');

const ONLINE_STABLE_MS = 30 * 1000;
const OFFLINE_STABLE_MS = 90 * 1000;
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

export const dynamic = 'force-dynamic';

type StreamMonitorCache = {
  rawStatuses?: Record<string, string>;
  stableStatuses?: Record<string, string>;
  pendingSince?: Record<string, string>;
  lastNotifiedAt?: Record<string, string>;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentStreams = await getStreams();

    if (!currentStreams || currentStreams.length === 0) {
      return NextResponse.json({ success: true, message: 'No streams to monitor.' });
    }

    const monitoredNamesForPilot = await getMonitoredStreams();

    const cacheDoc = await CACHE_DOC_REF.get();
    const cache = (cacheDoc.exists ? cacheDoc.data() : {}) as StreamMonitorCache;

    const previousRawStatuses = cache.rawStatuses || {};
    const stableStatuses = cache.stableStatuses || {};
    const pendingSince = cache.pendingSince || {};
    const lastNotifiedAt = cache.lastNotifiedAt || {};

    const updatedRawStatuses: Record<string, string> = {};
    const updatedStableStatuses: Record<string, string> = { ...stableStatuses };
    const updatedPendingSince: Record<string, string> = { ...pendingSince };
    const updatedLastNotifiedAt: Record<string, string> = { ...lastNotifiedAt };

    let detectedChangesCount = 0;
    let pendingChangesCount = 0;
    let suppressedByCooldownCount = 0;

    for (const stream of currentStreams) {
      const streamName = stream.name;
      const curr = stream.status;
      const prevRaw = previousRawStatuses[streamName];
      const stable = updatedStableStatuses[streamName];

      updatedRawStatuses[streamName] = curr;

      if (!monitoredNamesForPilot.includes(streamName)) {
        continue;
      }

      if (!stable) {
        if (curr === 'online') {
          updatedStableStatuses[streamName] = 'online';
          updatedLastNotifiedAt[streamName] = now.toISOString();
          detectedChangesCount++;
          await notifyStreamOnline(streamName, stream.comment);
        } else {
          updatedStableStatuses[streamName] = curr;
        }
        delete updatedPendingSince[streamName];
        continue;
      }

      if (curr === stable) {
        delete updatedPendingSince[streamName];
        continue;
      }

      if (prevRaw !== curr || !updatedPendingSince[streamName]) {
        updatedPendingSince[streamName] = now.toISOString();
        pendingChangesCount++;
        continue;
      }

      const startedAt = new Date(updatedPendingSince[streamName]).getTime();
      const stableForMs = now.getTime() - startedAt;
      const requiredStableMs = curr === 'online' ? ONLINE_STABLE_MS : OFFLINE_STABLE_MS;

      if (stableForMs < requiredStableMs) {
        pendingChangesCount++;
        continue;
      }

      const lastNotifyMs = updatedLastNotifiedAt[streamName]
        ? new Date(updatedLastNotifiedAt[streamName]).getTime()
        : 0;

      if (lastNotifyMs && now.getTime() - lastNotifyMs < NOTIFICATION_COOLDOWN_MS) {
        updatedStableStatuses[streamName] = curr;
        delete updatedPendingSince[streamName];
        updatedLastNotifiedAt[streamName] = now.toISOString();
        suppressedByCooldownCount++;
        continue;
      }

      updatedStableStatuses[streamName] = curr;
      delete updatedPendingSince[streamName];
      updatedLastNotifiedAt[streamName] = now.toISOString();
      detectedChangesCount++;

      if (curr === 'online') {
        await notifyStreamOnline(streamName, stream.comment);
      } else {
        await notifyStreamOffline(streamName, stream.comment);
      }
    }

    await CACHE_DOC_REF.set({
      rawStatuses: updatedRawStatuses,
      stableStatuses: updatedStableStatuses,
      pendingSince: updatedPendingSince,
      lastNotifiedAt: updatedLastNotifiedAt,
      lastUpdated: now.toISOString(),
      config: {
        onlineStableSeconds: ONLINE_STABLE_MS / 1000,
        offlineStableSeconds: OFFLINE_STABLE_MS / 1000,
        cooldownSeconds: NOTIFICATION_COOLDOWN_MS / 1000,
      },
    });

    if (detectedChangesCount > 0) {
      await logEvent(
        'MONITOR_CYCLE_COMPLETED',
        `Detected stable status changes for ${detectedChangesCount} monitored streams.`
      );
    }

    return NextResponse.json({
      success: true,
      detectedChanges: detectedChangesCount,
      pendingChanges: pendingChangesCount,
      suppressedByCooldown: suppressedByCooldownCount,
      processedCount: currentStreams.length,
      monitoredCount: monitoredNamesForPilot.length,
      stability: {
        onlineSeconds: ONLINE_STABLE_MS / 1000,
        offlineSeconds: OFFLINE_STABLE_MS / 1000,
        cooldownSeconds: NOTIFICATION_COOLDOWN_MS / 1000,
      },
    });
  } catch (error) {
    console.error('Error in stream monitor cron job:', error);
    await logEvent('MONITOR_CYCLE_ERROR', (error as Error).message);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
