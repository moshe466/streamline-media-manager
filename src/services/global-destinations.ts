
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';
import { FieldValue } from 'firebase-admin/firestore';

export type GlobalPushDestination = {
    id: string;
    name: string;
    rtmp_url: string;
    stream_key: string;
};

const getGlobalConfigsRef = () => getDb().collection('settings').doc('global_configs');

/**
 * Retrieves all global push destinations.
 */
export async function getGlobalDestinations(): Promise<GlobalPushDestination[]> {
    try {
        const doc = await getGlobalConfigsRef().get();
        if (doc.exists) {
            return doc.data()?.destinations || [];
        }
        return [];
    } catch (error) {
        console.error("Error fetching global destinations:", error);
        return [];
    }
}

/**
 * Saves or updates global destinations.
 */
export async function saveGlobalDestinations(destinations: GlobalPushDestination[]): Promise<{ success: boolean; error?: string }> {
    try {
        await getGlobalConfigsRef().set({
            destinations,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        await logEvent('GLOBAL_DESTINATIONS_UPDATE', `Updated global destinations bank. Total: ${destinations.length}`);
        return { success: true };
    } catch (error) {
        console.error("Error saving global destinations:", error);
        return { success: false, error: (error as Error).message };
    }
}
