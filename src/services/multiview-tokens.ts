

'use server';

import { getDb } from '@/lib/firebase-admin';
import type { MultiviewSettings } from './users';

// This collection will store the settings for a pending multiview session.
const getRequestsCollection = () => getDb().collection('multiview_requests');

/**
 * Creates a request document containing the settings for a multiview session,
 * identified by a unique requestId. This document will be polled by the player window.
 * @param requestId A unique identifier for the session request.
 * @param settings The multiview settings (streams and grid layout).
 * @returns A promise that resolves when the document is created.
 */
export async function createMultiviewRequest(requestId: string, settings: MultiviewSettings): Promise<{ success: boolean; error?: string; }> {
    try {
        const requestRef = getRequestsCollection().doc(requestId);
        await requestRef.set({
            ...settings,
            createdAt: new Date().toISOString(),
        });
        console.log(`Created multiview request with ID: ${requestId}`);
        return { success: true };
    } catch (error) {
        console.error("Error creating multiview request:", error);
        return { success: false, error: (error as Error).message };
    }
}


/**
 * Fetches the settings for a given request ID and immediately consumes (deletes)
 * the request document to ensure it's used only once.
 * @param requestId The unique identifier for the session request.
 * @returns The multiview settings if found, otherwise null.
 */
export async function getAndConsumeMultiviewSettings(requestId: string): Promise<MultiviewSettings | null> {
    const requestRef = getRequestsCollection().doc(requestId);
    try {
        const doc = await requestRef.get();
        if (!doc.exists) {
            // It's normal for this to not exist on the first few polls.
            return null;
        }

        const settings = doc.data() as MultiviewSettings;
        
        // Consume the request by deleting it
        await requestRef.delete();
        console.log(`Consumed multiview request with ID: ${requestId}`);
        
        return settings;
    } catch (error) {
        console.error(`Error verifying and consuming multiview request ${requestId}:`, error);
        return null;
    }
}
