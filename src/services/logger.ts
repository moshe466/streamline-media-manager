

'use server';

import { getDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

const getLogsCollection = () => getDb().collection('logs');

export type LogEntry = {
    id: string; // Add id to the type
    timestamp: string;
    type: string;
    details: string;
};

/**
 * Appends a new event to the activity log in Firestore.
 * @param type The type of event (e.g., 'LOGIN_SUCCESS', 'CLIENT_CREATED').
 * @param details A detailed message describing the event.
 */
export async function logEvent(type: string, details: string): Promise<void> {
    const timestamp = new Date().toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    
    const serverTimestamp = new Date().toISOString();

    const logEntry = {
        timestamp,
        serverTimestamp,
        type,
        details
    };

    try {
        await getLogsCollection().add(logEntry);
    } catch (error) {
        console.error('Failed to write to log collection in Firestore:', error);
    }
}

/**
 * Retrieves all log entries from the activity log.
 * @returns A promise that resolves to an array of LogEntry objects.
 */
export async function getLogs(): Promise<LogEntry[]> {
    try {
        const snapshot = await getLogsCollection().orderBy('serverTimestamp', 'desc').limit(200).get();
        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<LogEntry, 'id'>),
        }));
        revalidatePath('/admin/logs');
        return logs;
    } catch (error) {
        console.error('Failed to read log collection:', error);
        return [];
    }
}
