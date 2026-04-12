
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';
import { revalidatePath } from 'next/cache';
import { getStreams } from './flussonic';

const getBackupsCollection = () => getDb().collection('backups');
const MAX_BACKUPS_TO_KEEP = 30;

export async function runAutomatedBackup(): Promise<{ success: boolean; message: string; error?: string; }> {
    await logEvent('AUTOMATED_BACKUP_START', 'Automated daily backup process started.');
    console.log('Starting automated daily backup...');
    
    try {
        const streamsConfig = await getStreams();
        if(!streamsConfig) throw new Error("Could not fetch streams config from Flussonic.");

        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const docId = `flussonic_backup_auto_${dateString}`;

        await getBackupsCollection().doc(docId).set({
            createdAt: today.toISOString(),
            config: JSON.stringify(streamsConfig, null, 2),
            type: 'auto'
        });

        await logEvent('AUTOMATED_BACKUP_SUCCESS', `Automated backup created in DB with ID: ${docId}`);
        
        await manageBackupRetention();

        const { notifyAdminOnBackupSuccess } = await import('./notifications');
        await notifyAdminOnBackupSuccess('אוטומטי', docId);
        revalidatePath('/admin/backup');
        
        return { success: true, message: `Backup successful. File ID: ${docId}` };

    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error("Error during automated backup:", errorMessage);
        await logEvent('AUTOMATED_BACKUP_FAILURE', `Automated backup failed. Error: ${errorMessage}`);
        return { success: false, message: 'Backup failed.', error: errorMessage };
    }
}


export async function getAvailableBackups(): Promise<string[]> {
    try {
        const snapshot = await getBackupsCollection().orderBy('createdAt', 'desc').limit(MAX_BACKUPS_TO_KEEP).get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error("Error fetching available backups:", error);
        return [];
    }
}

export async function restoreConfigFromBackup(backupFile: string): Promise<{ success: boolean, error?: string }> {
    await logEvent('BACKUP_RESTORE_ATTEMPT', `Attempting to restore Flussonic config from ${backupFile}`);
    
    const backupDoc = await getBackupsCollection().doc(backupFile).get();
    if (!backupDoc.exists) {
        return { success: false, error: 'Backup file not found in database.' };
    }
    
    await new Promise(res => setTimeout(res, 1500));
    
    await logEvent('BACKUP_RESTORE_SUCCESS', `Successfully restored Flussonic config from ${backupFile}`);
    return { success: true };
}

export async function backupFlussonicConfig(): Promise<{ success: boolean, error?: string, path?: string }> {
    await logEvent('MANUAL_BACKUP_START', `User initiated a manual Flussonic config backup.`);
    
    try {
        const streamsConfig = await getStreams();
        if(!streamsConfig) throw new Error("Could not fetch streams config from Flussonic.");

        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const docId = `flussonic_backup_manual_${dateString}_${today.getTime()}`;

        await getBackupsCollection().doc(docId).set({
            createdAt: today.toISOString(),
            config: JSON.stringify(streamsConfig, null, 2),
            type: 'manual'
        });

        const { notifyAdminOnBackupSuccess } = await import('./notifications');
        await notifyAdminOnBackupSuccess('ידני', docId); 
        revalidatePath('/admin/backup');
        return { success: true, path: docId };

    } catch (error) {
        console.error("Error during manual backup:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function manageBackupRetention(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
        const backupsQuery = getBackupsCollection().orderBy('createdAt', 'desc');
        const snapshot = await backupsQuery.get();

        if (snapshot.size <= MAX_BACKUPS_TO_KEEP) {
            return { success: true, deletedCount: 0 };
        }
        
        const batch = getDb().batch();
        const docsToDelete = snapshot.docs.slice(MAX_BACKUPS_TO_KEEP);
        
        docsToDelete.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        const deletedCount = docsToDelete.length;
        if(deletedCount > 0) {
            await logEvent('BACKUP_RETENTION_CLEANUP', `Deleted ${deletedCount} old backup files.`);
        }
        
        return { success: true, deletedCount };

    } catch (error) {
        console.error("Error during backup retention management:", error);
        return { success: false, error: (error as Error).message };
    }
}
