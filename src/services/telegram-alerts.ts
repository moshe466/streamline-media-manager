
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';

const getAlertsSettingsRef = () => getDb().collection('settings').doc('telegram_pilot_alerts');

export type PilotAlertSettings = {
    monitoredStreams: string[];
};

/**
 * Retrieves the list of stream names that should trigger a pilot alert.
 */
export async function getMonitoredStreams(): Promise<string[]> {
    try {
        const doc = await getAlertsSettingsRef().get();
        if (doc.exists) {
            return doc.data()?.monitoredStreams || [];
        }
        return [];
    } catch (error) {
        console.error("Error fetching monitored streams:", error);
        return [];
    }
}

/**
 * Saves the list of monitored stream names.
 */
export async function saveMonitoredStreams(streams: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await getAlertsSettingsRef().set({
            monitoredStreams: streams,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        await logEvent('PILOT_ALERTS_CONFIG_UPDATE', `Updated monitored streams list: ${streams.join(', ')}`);
        return { success: true };
    } catch (error) {
        console.error("Error saving monitored streams:", error);
        return { success: false, error: (error as Error).message };
    }
}
