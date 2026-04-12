import { NextResponse } from 'next/server';
import { getStreams } from '@/services/flussonic';
import { getDb } from '@/lib/firebase-admin';
import { notifyStreamOnline, notifyStreamOffline } from '@/services/notifications';
import { getMonitoredStreams } from '@/services/telegram-alerts';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const CACHE_DOC_REF = getDb().collection('system_status').doc('streams_pilot_cache');

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const currentStreams = await getStreams();
        if (!currentStreams || currentStreams.length === 0) {
            return NextResponse.json({ success: true, message: 'No streams to monitor.' });
        }

        const monitoredNamesForPilot = await getMonitoredStreams();

        const cacheDoc = await CACHE_DOC_REF.get();
        const previousStatus: Record<string, string> = cacheDoc.exists ? cacheDoc.data()?.statuses || {} : {};

        const updatedStatus: Record<string, string> = {};
        let detectedChangesCount = 0;

        for (const stream of currentStreams) {
            updatedStatus[stream.name] = stream.status;
            const prev = previousStatus[stream.name];
            const curr = stream.status;

            if ((prev && prev !== curr) || (!prev && curr === 'online')) {
                const isOnline = curr === 'online';
                const isMonitored = monitoredNamesForPilot.includes(stream.name);

                if (isMonitored) {
                    detectedChangesCount++;

                    if (isOnline) {
                        await notifyStreamOnline(stream.name, stream.comment);
                    } else {
                        await notifyStreamOffline(stream.name, stream.comment);
                    }
                }
            }
        }

        await CACHE_DOC_REF.set({
            statuses: updatedStatus,
            lastUpdated: new Date().toISOString()
        });

        if (detectedChangesCount > 0) {
            await logEvent('MONITOR_CYCLE_COMPLETED', `Detected status changes for ${detectedChangesCount} monitored streams. Notifications processed.`);
        }

        return NextResponse.json({
            success: true,
            detectedChanges: detectedChangesCount,
            processedCount: currentStreams.length,
            monitoredCount: monitoredNamesForPilot.length
        });

    } catch (error) {
        console.error('Error in stream monitor cron job:', error);
        await logEvent('MONITOR_CYCLE_ERROR', (error as Error).message);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
