
'use server';

import { getStorage } from 'firebase-admin/storage';
import { logEvent } from '@/services/logger';
import { getDb } from '@/lib/firebase-admin';
const bucket = getStorage().bucket('streamline-media-manager.firebasestorage.app');

/**
 * Tests the connection to Firebase Storage by writing, reading, and deleting a file.
 * This is a server action intended for admin debugging purposes.
 */
export async function testStorageConnectionAction(): Promise<{ success: boolean; error?: string; details?: string; resolution?: string; }> {
  const testFilePath = 'debug/storage-connection-test.txt';
  const testFile = bucket.file(testFilePath);
  const testContent = `Storage connection test successful at ${new Date().toISOString()}`;

  try {
    // 1. Write the file
    await testFile.save(testContent, {
      contentType: 'text/plain',
    });

    // 2. Read the file back
    const [content] = await testFile.download();
    if (content.toString() !== testContent) {
      throw new Error("Content mismatch between written and read file.");
    }

    // 3. Delete the file
    await testFile.delete();
    
    console.log('✅ Firebase Storage connection test successful!');
    return {
      success: true,
      details: 'Successfully wrote, read, and deleted a test file in the "debug/" directory of your Storage bucket.',
    };
  } catch (error: any) {
    console.error('❌ Firebase Storage connection test failed:', error);
    
    // Provide a more helpful error message for common issues
    if (error.code === 403 || (error.message && error.message.includes('permission'))) {
        return {
            success: false,
            error: 'Permission Denied',
            details: 'The server does not have permission to write to your Firebase Storage bucket. This usually happens when the Service Account used by the server lacks the "Storage Object Admin" (roles/storage.objectAdmin) role in Google Cloud IAM.',
            resolution: 'Go to the Google Cloud Console -> IAM & Admin -> IAM. Find the service account (ending in @streamline-media-manager.iam.gserviceaccount.com) and grant it the "Storage Object Admin" role.'
        };
    }
    
    if (error.code === 404 || error.message?.includes('does not exist')) {
        return {
            success: false,
            error: 'Bucket Not Found',
            details: `The specified bucket was not found. Please ensure a Cloud Storage bucket named "streamline-media-manager.firebasestorage.app" exists in your Firebase project.`,
            resolution: 'Go to the Firebase Console, navigate to Storage, and make sure the bucket is created and the name matches exactly.'
        }
    }


    return {
      success: false,
      error: 'Failed to connect to Firebase Storage.',
      details: error.message || 'An unknown error occurred.',
      resolution: 'Check your server logs and Firebase project configuration.'
    };
  }
}

/**
 * Ensures a directory exists by creating a .placeholder file inside it.
 * @param dir The directory path to check/create.
 */
async function ensureDirectoryExists(dir: string): Promise<void> {
    const placeholderContent = 'This file ensures the directory exists.';
    const filePath = `${dir}/.placeholder`;
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
        await file.save(placeholderContent, { contentType: 'text/plain' });
        console.log(`Created placeholder for directory: ${dir}`);
        await logEvent('STORAGE_INIT', `Directory "${dir}" was created in Storage.`);
    }
}


/**
 * Ensures the base directories exist for all clients in the Storage bucket.
 */
export async function initializeStorageAction(): Promise<{ success: boolean; error?: string; }> {
    try {
        const snapshot = await getDb().collection('clients').get();
        const clients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (clients.length === 0) {
            console.log("No clients found, skipping per-client folder creation.");
        }

        for (const client of clients) {
            await ensureDirectoryExists(`receipts/${client.id}`);
            await ensureDirectoryExists(`client-documents/${client.id}`);
        }
        
        // Also ensure the root folders exist even if there are no clients
        await ensureDirectoryExists('receipts');
        await ensureDirectoryExists('client-documents');


        return { success: true };
    } catch (error: any) {
         console.error('❌ Firebase Storage initialization failed:', error);
         return { success: false, error: error.message || 'An unknown error occurred during initialization.' };
    }
}
