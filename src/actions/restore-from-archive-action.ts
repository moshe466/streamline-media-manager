
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from '@/services/logger';

const getArchiveCollection = () => getDb().collection('deleted_archive');

export async function restoreFromArchive(): Promise<{ success: boolean; restoredCount: number; error?: string; logs: string[] }> {
    const logs: string[] = [];
    logs.push('Starting restoration process...');
    await logEvent('RESTORE_FROM_ARCHIVE_START', 'User initiated a restore from archive.');

    try {
        const archiveSnapshot = await getArchiveCollection().get();
        
        if (archiveSnapshot.empty) {
            logs.push('Archive collection is empty. Nothing to restore.');
            return { success: true, restoredCount: 0, logs };
        }

        logs.push(`Found ${archiveSnapshot.size} documents in archive.`);
        
        const batch = getDb().batch();
        let restoredCount = 0;
        let errorCount = 0;

        for (const doc of archiveSnapshot.docs) {
            const archivedData = doc.data();
            const { originalId, originalCollection, data } = archivedData;

            if (!originalId || !originalCollection || !data) {
                logs.push(`ERROR: Document ${doc.id} is malformed. Missing originalId or originalCollection or data.`);
                errorCount++;
                continue;
            }

            try {
                // The original document ID is stored in the 'originalId' field.
                const targetRef = getDb().collection(originalCollection).doc(originalId);
                
                // We use set() here to ensure we overwrite any potentially new data with the same ID.
                batch.set(targetRef, data);

                // We also delete the document from the archive collection in the same batch
                batch.delete(doc.ref);
                
                logs.push(`SUCCESS: Restoring ${originalId} to ${originalCollection}.`);
                restoredCount++;

            } catch (innerError: any) {
                 logs.push(`ERROR: Failed to process document ${doc.id}. Reason: ${innerError.message}`);
                 errorCount++;
            }
        }
        
        logs.push(`Committing ${restoredCount} restorations and ${restoredCount} deletions to the database...`);
        await batch.commit();

        if(errorCount > 0) {
             throw new Error(`Restoration completed with ${errorCount} errors. See log for details.`);
        }

        await logEvent('RESTORE_FROM_ARCHIVE_SUCCESS', `Successfully restored ${restoredCount} documents.`);
        logs.push('Restoration process finished successfully.');

        return { success: true, restoredCount, logs };

    } catch (error: any) {
        console.error("Critical error during restoration:", error);
        logs.push(`CRITICAL ERROR: ${error.message}`);
        await logEvent('RESTORE_FROM_ARCHIVE_FAILURE', `Critical failure during restoration. Error: ${error.message}`);
        return { success: false, restoredCount: 0, error: error.message, logs };
    }
}
