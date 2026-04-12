'use server';

import { getDb } from '@/lib/firebase-admin';
import * as crypto from 'crypto';
import { logEvent } from './logger';
import { notifyAdminOnSecureLinkDeleted } from './notifications';

const getLinksCollection = () => getDb().collection('secure_links');

export type SecureLink = {
    id: string;
    streamName: string;
    instanceId: string;
    expiresAt: Date;
    createdAt: Date;
    appHost?: string;
};

/**
 * Creates a secure link document in Firestore with a 5-hour expiration.
 */
export async function createSecureLink(
    streamName: string, 
    instanceId: string = 'default',
    actorName: string = 'לא ידוע',
    appHost?: string,
    source: 'app' | 'bot' = 'app'
): Promise<{ success: boolean, id?: string, error?: string }> {
    try {
        const id = crypto.randomBytes(12).toString('hex'); 
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); 

        const linkData: any = {
            streamName,
            instanceId,
            createdAt: now,
            expiresAt,
            createdBy: actorName,
        };

        if (appHost) {
            linkData.appHost = appHost;
        }

        linkData.createdVia = source;

        await getLinksCollection().doc(id).set(linkData);

        await logEvent('SECURE_LINK_CREATED', `משתמש ${actorName} יצר קישור צפייה חדש לשידור: ${streamName}`);

        // Telegram announcement is handled only by links-poller
        // This prevents duplicate announcements when a link is created.
        return { success: true, id };
    } catch (error) {
        console.error("Error creating secure link:", error);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Retrieves the stream data for a given link ID, if the link is valid and not expired.
 */
export async function getAndViewSecureLink(linkId: string): Promise<{ streamName?: string; instanceId?: string; error?: string }> {
    try {
        const docRef = getLinksCollection().doc(linkId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { error: 'הקישור אינו תקין או שפג תוקפו.' };
        }

        const data = doc.data() as any;
        const expiresAt = data.expiresAt.toDate();

        if (expiresAt < new Date()) {
            await docRef.delete();
            return { error: 'הקישור פג תוקף.' };
        }

        return { 
            streamName: data.streamName,
            instanceId: data.instanceId || 'default'
        };

    } catch (error) {
        console.error(`Error retrieving secure link ${linkId}:`, error);
        return { error: 'שגיאה באימות הקישור.' };
    }
}


/**
 * A cron job function to clean up expired links from the database.
 */
export async function cleanupExpiredSecureLinks(): Promise<{ deletedCount: number }> {
    const now = new Date();
    const query = getLinksCollection().where('expiresAt', '<', now);
    
    try {
        const snapshot = await query.get();
        if (snapshot.empty) {
            return { deletedCount: 0 };
        }

        const batch = getDb().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        return { deletedCount: snapshot.size };

    } catch (error) {
        console.error("Error during secure link cleanup:", error);
        return { deletedCount: 0 };
    }
}

/**
 * Gets all active (non-expired) secure links for a specific stream.
 */
export async function getActiveLinksForStream(streamName: string): Promise<SecureLink[]> {
  try {
    const now = new Date();
    const snapshot = await getLinksCollection()
      .where('streamName', '==', streamName)
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'desc')
      .get();
    
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            streamName: data.streamName,
            instanceId: data.instanceId,
            expiresAt: (data.expiresAt as any).toDate(),
            createdAt: (data.createdAt as any).toDate(),
            appHost: data.appHost,
        } as SecureLink;
    });

  } catch (error) {
    console.error(`Error fetching active links for stream ${streamName}:`, error);
    return [];
  }
}

/**
 * Deletes a secure link by its ID and notifies admins.
 */
export async function deleteSecureLink(linkId: string, actorName: string = 'לא ידוע'): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = getLinksCollection().doc(linkId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return { success: true };
        }

        const data = doc.data();
        await docRef.delete();

        if (data && actorName !== 'SYSTEM_CLEANUP') {
            await notifyAdminOnSecureLinkDeleted(data.streamName, actorName);
            await logEvent('SECURE_LINK_DELETED', `משתמש ${actorName} מחק קישור צפייה לשידור: ${data.streamName}`);
        }

        return { success: true };
    } catch (error) {
        console.error(`Error deleting secure link ${linkId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}