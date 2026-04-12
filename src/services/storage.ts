

'use server';

import { getAdminStorage, getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';
import { updateClientDetails } from './clients';
import { updateViewer } from './viewers';
import * as fs from 'fs/promises';
import * as path from 'path';

const getTourSettingsRef = () => getDb().collection('settings').doc('virtual_tour');
const bucketName = 'streamline-media-manager.firebasestorage.app';

export type TourStep = {
    id: string;
    image: string | null;
    title: string;
    intro: string;
};

export type TourData = {
    steps: TourStep[];
    musicUrl: string | null;
    isEnabled: boolean;
};

// Default steps if none are configured in Firestore
const MOCK_TOUR_STEPS: TourStep[] = [
    { id: '1', image: 'https://placehold.co/800x450.png', title: 'ברוכים הבאים לסיור', intro: 'זהו סיור קצר שיכיר לכם את היכולות המרכזיות של המערכת. לחצו "הבא" כדי להתחיל.' },
    { id: '2', image: 'https://placehold.co/800x450.png', title: 'דף הבית', intro: 'דף הבית מרכז עבורכם את כל המידע החשוב במקום אחד: סטטוס החשבון, ניהול שידורים, צופים ועוד.' },
    { id: '3', image: 'https://placehold.co/800x450.png', title: 'ניהול שידורים', intro: 'כאן תוכלו ליצור שידורים חדשים, לנהל שידורים קיימים, לצפות בסטטיסטיקות בזמן אמת ולהגדיר הקלטות.' },
    { id: '4', image: 'https://placehold.co/800x450.png', title: 'ניהול צופים', intro: 'אזור ניהול הצופים מאפשר לכם להוסיף צופים חדשים, לערוך את פרטיהם, ולהגדיר הרשאות צפייה פרטניות לכל שידור.' },
];




export async function saveTourData(data: Partial<TourData>): Promise<{success: boolean}> {
    try {
        await getTourSettingsRef().set(data, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving tour data to Firestore:", error);
        return { success: false };
    }
}

export async function getTourData(): Promise<TourData> {
    try {
        const doc = await getTourSettingsRef().get();
        if (doc.exists) {
            const data = doc.data();
            const steps = data?.steps && Array.isArray(data.steps) ? data.steps : MOCK_TOUR_STEPS;
            return {
                steps: steps,
                musicUrl: data?.musicUrl || null,
                isEnabled: data?.isEnabled ?? true, // Default to true if not set
            };
        }
        // Default values if the document doesn't exist
        return { steps: MOCK_TOUR_STEPS, musicUrl: null, isEnabled: true };
    } catch (error) {
        console.error("Error fetching tour data from Firestore:", error);
        return { steps: MOCK_TOUR_STEPS, musicUrl: null, isEnabled: true };
    }
}


/**
 * Uploads a file buffer to GCS and returns its public URL.
 * @param buffer The file content as a Buffer.
 * @param destination The path in the storage bucket.
 * @param contentType The MIME type of the file.
 * @returns The public URL of the uploaded file.
 */
async function uploadAndMakePublic(buffer: Buffer, destination: string, contentType: string): Promise<string> {
    const bucket = getAdminStorage().bucket(bucketName);
    const file = bucket.file(destination);
    
    await file.save(buffer, {
        metadata: { contentType },
        public: true, // Make the file publicly readable
    });

    return file.publicUrl(); // Return the public URL
}


/**
 * Deletes a file from Firebase Cloud Storage.
 * @param fullPath The full path to the file in the bucket.
 */
export async function deleteFileAction(fullPath: string): Promise<{ success: boolean; error?: string }> {
    try {
        await getAdminStorage().bucket(bucketName).file(fullPath).delete();
        await logEvent('FILE_DELETE_SUCCESS', `File deleted from ${fullPath}.`);
        return { success: true };
    } catch (error) {
        console.error(`Error deleting file from ${fullPath}:`, error);
        await logEvent('FILE_DELETE_FAILURE', `Failed to delete ${fullPath}. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Handles the server-side upload of a tour asset (like music).
 */
export async function uploadTourAssetAction(formData: FormData): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
    const file = formData.get('assetFile') as File | null;
    const assetType = formData.get('assetType') as 'music' | 'image' | 'video';

    if (!file || !assetType) {
        return { success: false, error: 'Missing file or asset type.' };
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const destination = `tour-assets/${assetType}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        
        const publicUrl = await uploadAndMakePublic(buffer, destination, file.type);

        await logEvent('TOUR_ASSET_UPLOADED', `Tour asset ${assetType} uploaded to ${publicUrl}`);

        return { success: true, publicUrl };

    } catch (error) {
        console.error("Error in uploadTourAssetAction:", error);
        return { success: false, error: (error as Error).message };
    }
}


/**
 * Handles the server-side upload of a client's custom logo or profile picture.
 */
export async function uploadUserAssetAction(formData: FormData): Promise<{ success: boolean; error?: string; publicUrl?: string; updatedClient?: any; updatedViewer?: any; }> {
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const fileType = formData.get('fileType') as 'logo' | 'offline_logo' | 'profile' | 'watermark' | null;

    if (!file || !userId || !fileType) {
        return { success: false, error: 'Missing file, user ID, or file type.' };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        let destination = '';
        if (fileType === 'logo') {
             destination = `client-logos/${userId}/logo-${Date.now()}`;
        } else if (fileType === 'offline_logo') {
             destination = `client-logos/${userId}/offline_logo-${Date.now()}`;
        } else if (fileType === 'watermark') {
             destination = `watermarks/${userId}/watermark-${Date.now()}`;
        } else if (fileType === 'profile') {
            destination = `profile-pictures/${userId}/profile-${Date.now()}`;
        } else {
             return { success: false, error: 'Invalid file type.' };
        }
        
        const publicUrl = await uploadAndMakePublic(buffer, destination, file.type);
        
        // After uploading, update the correct Firestore document
        if (fileType === 'logo') {
             const updatedClient = await updateClientDetails(userId, { customLogoUrl: publicUrl });
             return { success: true, publicUrl, updatedClient };
        } else if (fileType === 'offline_logo') {
            const updatedClient = await updateClientDetails(userId, { customOfflineLogoUrl: publicUrl });
            return { success: true, publicUrl, updatedClient };
        } else if (fileType === 'watermark') {
            // Watermark just returns the URL, the client-side editor handles saving the settings object
            return { success: true, publicUrl };
        } else if (fileType === 'profile') {
            const db = getDb();
            const clientRef = db.collection('clients').doc(userId.toLowerCase());
            const viewerRef = db.collection('viewers').doc(userId.toLowerCase());
            
            const clientDoc = await clientRef.get();
            if (clientDoc.exists) {
                const updatedClient = await updateClientDetails(userId, { profileImageUrl: publicUrl });
                return { success: true, publicUrl, updatedClient };
            }
            
            const viewerDoc = await viewerRef.get();
            if (viewerDoc.exists) {
                const updatedViewer = await updateViewer(userId, { profileImageUrl: publicUrl });
                return { success: true, publicUrl, updatedViewer };
            }
        }
        
        return { success: true, publicUrl };

    } catch (error) {
        console.error("Error in upload action:", error);
        return { success: false, error: (error as Error).message };
    }
}


/**
 * Handles the upload of a client's payment receipt.
 */
export async function uploadReceiptAction(formData: FormData): Promise<{ success: boolean; error?: string; updatedClient?: any; }> {
    const file = formData.get('receiptFile') as File | null;
    const clientId = formData.get('clientId') as string | null;

    if (!file || !clientId) {
        return { success: false, error: 'Missing file or client ID.' };
    }
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const destination = `receipts/${clientId}/${Date.now()}-${file.name}`;
        
        const publicUrl = await uploadAndMakePublic(buffer, destination, file.type);
        
        // Save the public URL
        const updatedClient = await updateClientDetails(clientId, { receiptUrl: publicUrl });

        return { success: true, updatedClient };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Handles the upload of a generic document for a client.
 */
export async function uploadClientDocumentAction(formData: FormData): Promise<{ success: boolean; error?: string; fileUrl?: string; }> {
    const file = formData.get('documentFile') as File | null;
    const clientId = formData.get('clientId') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;


    if (!file || !clientId) {
        return { success: false, error: 'Missing file or client ID.' };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const destination = `client-documents/${clientId}/${Date.now()}-${file.name}`;

        const publicUrl = await uploadAndMakePublic(buffer, destination, file.type);
        
        await logEvent('CLIENT_DOCUMENT_UPLOADED', `User (${uploadedBy}) uploaded file ${file.name} for client ${clientId}.`);

        return { success: true, fileUrl: publicUrl };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Lists all documents for a given client, including creation time.
 */
export async function listClientDocuments(clientId: string): Promise<{ name: string; url: string; timeCreated: string, fullPath: string; }[]> {
    const bucket = getAdminStorage().bucket(bucketName);
    try {
        const prefix = `client-documents/${clientId}/`;
        const [files] = await bucket.getFiles({ prefix });

        const filesWithMetadata = files.map(file => {
            return {
                name: file.name.replace(prefix, ''),
                url: file.publicUrl(), // Use publicUrl() directly
                timeCreated: file.metadata.timeCreated ?? '',
                fullPath: file.name,
            };
        });
        
        return filesWithMetadata;

    } catch (error) {
        console.error(`Error listing files for client ${clientId}:`, error);
        return [];
    }
}

/**
 * Deletes a document from a client's folder.
 */
export async function deleteClientDocument(fullPath: string): Promise<{ success: boolean, error?: string}> {
    return deleteFileAction(fullPath);
}

/**
 * Initializes the default storage folders for a new client.
 */
export async function initializeStorageForClient(clientId: string): Promise<void> {
    const bucket = getAdminStorage().bucket(bucketName);
    try {
        // Create a .placeholder file in each directory to ensure they exist.
        const receiptsPlaceholder = `receipts/${clientId}/.placeholder`;
        const docsPlaceholder = `client-documents/${clientId}/.placeholder`;

        await bucket.file(receiptsPlaceholder).save('placeholder');
        await bucket.file(docsPlaceholder).save('placeholder');

        console.log(`Initialized storage folders for client ${clientId}.`);
    } catch (error) {
        console.error(`Failed to initialize storage folders for client ${clientId}:`, error);
        // We don't throw an error here as it's not a critical failure for client creation.
    }
}

/**
 * Handles the server-side upload of a default system logo.
 */
export async function uploadDefaultLogoAction(formData: FormData): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
    const file = formData.get('logoFile') as File | null;
    const logoType = formData.get('logoType') as 'system' | 'offline' | null;

    if (!file || !logoType) {
        return { success: false, error: 'Missing logo file or logo type.' };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const destination = `default-logos/${logoType}_logo.png`; // A consistent path
        
        const publicUrl = await uploadAndMakePublic(buffer, destination, file.type);
        
        console.log(`Default logo '${logoType}' updated. New URL: ${publicUrl}`);
        
        await logEvent('DEFAULT_LOGO_UPDATED', `Default logo for '${logoType}' was updated.`);

        return { success: true, publicUrl };

    } catch (error) {
        console.error(`Error in uploadDefaultLogoAction for type ${logoType}:`, error);
        return { success: false, error: (error as Error).message };
    }
}
