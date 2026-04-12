

'use server';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';

export type VersionUpdate = {
  id: string;
  version: string;
  title: string;
  content: string;
  createdAt: string; // ISO String
};

const getVersionUpdatesCollection = () => getDb().collection('version_updates');
const getSettingsCollection = () => getDb().collection('settings');
const VERSION_DOC_ID = 'app_version';
const FALLBACK_VERSION = '1.4.2';

/**
 * Gets the document reference for app version settings.
 */
const getAppVersionSettingsRef = () => getSettingsCollection().doc(VERSION_DOC_ID);

/**
 * Fetches the current application version from Firestore.
 * If it doesn't exist, it initializes it with a fallback version.
 * @returns The current application version string.
 */
export async function getCurrentAppVersion(): Promise<string> {
    try {
        const docRef = getAppVersionSettingsRef();
        const doc = await docRef.get();
        if (doc.exists && doc.data()?.current) {
            return doc.data()?.current;
        } else {
            // Initialize the document if it doesn't exist
            await docRef.set({ current: FALLBACK_VERSION });
            return FALLBACK_VERSION;
        }
    } catch (error) {
        console.error("Error fetching current app version from Firestore:", error);
        return FALLBACK_VERSION; // Return fallback on error
    }
}

/**
 * Updates the current application version in Firestore.
 * @param newVersion - The new version string to set.
 */
async function updateCurrentAppVersion(newVersion: string): Promise<void> {
    const docRef = getAppVersionSettingsRef();
    await docRef.set({ current: newVersion }, { merge: true });
}

/**
 * Calculates the next patch version from a semantic version string.
 * @param currentVersion - e.g., "1.4.3"
 * @returns The next patch version string, e.g., "1.4.4"
 */
function getNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        console.warn(`Cannot increment non-standard version: ${currentVersion}. Appending '-next'.`);
        return `${currentVersion}-next`;
    }
    parts[2]++; // Increment patch number
    return parts.join('.');
}

/**
 * Adds a new version update to Firestore with an automatically incremented version number.
 * @param title - The title of the update.
 * @param content - The detailed content of the update.
 * @returns The newly created VersionUpdate object.
 */
export async function addVersionUpdate(title: string, content: string): Promise<VersionUpdate> {
  const currentVersion = await getCurrentAppVersion();
  const newVersion = getNextVersion(currentVersion);

  const newUpdateData = {
    version: newVersion,
    title,
    content,
    createdAt: new Date().toISOString(),
  };

  const docRef = await getVersionUpdatesCollection().add(newUpdateData);
  
  // After successfully adding the update, update the global version number
  await updateCurrentAppVersion(newVersion);

  // Revalidate paths so clients see the new update
  revalidatePath('/admin/whats-new', 'page');
  revalidatePath('/client', 'layout'); // Revalidate all client pages to get new version dialog
  revalidatePath('/admin', 'layout'); // Revalidate all admin pages to update footer

  return { id: docRef.id, ...newUpdateData };
}

/**
 * Deletes a version update document from Firestore.
 * @param updateId - The ID of the document to delete.
 */
export async function deleteVersionUpdate(updateId: string): Promise<void> {
    try {
        await getVersionUpdatesCollection().doc(updateId).delete();
        revalidatePath('/admin/whats-new'); // Revalidate the page to reflect the deletion
    } catch (error) {
        console.error(`Error deleting version update ${updateId}:`, error);
        throw new Error('Failed to delete version update.');
    }
}


/**
 * Fetches all version updates, sorted from newest to oldest.
 * @returns A promise that resolves to an array of VersionUpdate objects.
 */
export async function getVersionUpdates(): Promise<VersionUpdate[]> {
    try {
        const snapshot = await getVersionUpdatesCollection().orderBy('createdAt', 'desc').get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VersionUpdate));
    } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND when collection doesn't exist
            return [];
        }
        console.error("Error fetching version updates:", error);
        return [];
    }
}

/**
 * Fetches recent version updates (last 30 days).
 * @returns A promise that resolves to an array of recent VersionUpdate objects.
 */
export async function getRecentVersionUpdates(): Promise<VersionUpdate[]> {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const snapshot = await getVersionUpdatesCollection()
            .where('createdAt', '>=', thirtyDaysAgo.toISOString())
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VersionUpdate));

    } catch (error: any) {
         if (error.code === 5) { // NOT_FOUND
            return [];
        }
        console.error("Error fetching recent version updates:", error);
        return [];
    }
}
