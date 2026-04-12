
'use server';

import { getDb } from '@/lib/firebase-admin';
import { sendVerificationEmail } from './email';
import { prepareNewUser } from './users';
import { notifyAdminOnViewerCreated } from './notifications';
import { getClientById } from './clients';

const getViewersCollection = () => getDb().collection('viewers');
const getArchiveCollection = () => getDb().collection('deleted_archive');

export type ViewerPermissions = {
    [streamName: string]: {
        canWatchLive: boolean;
        canWatchDVR: boolean;
        canWatchMCR: boolean;
    };
};

export type Viewer = {
  id: string;
  clientId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  email: string;
  otp: string;
  permissions?: ViewerPermissions;
  expiresAt: string | null; // ISO string
  profileImageUrl?: string | null; // URL for viewer's profile picture
  activeSessionId?: string; // For single-session enforcement
  portalOrigin?: 'uh' | 'standard'; // Track which portal created this viewer
};

export type NewViewerData = Omit<Viewer, 'id' | 'otp' | 'permissions'> & { portalOrigin?: 'uh' | 'standard' };
export type ViewerDetailsUpdate = Partial<Pick<Viewer, 'firstName' | 'lastName' | 'nickname' | 'phone' | 'expiresAt' | 'profileImageUrl'>>;

export async function getAllViewers(): Promise<Viewer[]> {
    try {
        const snapshot = await getViewersCollection().get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Viewer));
    } catch (error: any) {
        if (error.code === 5) { return []; }
        throw error;
    }
}

export async function getViewersByClientId(clientId: string): Promise<Viewer[]> {
    try {
        const snapshot = await getViewersCollection().where('clientId', '==', clientId).get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Viewer));
    } catch (error: any) {
        if (error.code === 5) { // Can happen if index is not ready
            console.warn("Could not query viewers by clientId, likely due to a missing Firestore index. Please check Firestore console for index creation links. Proceeding without deactivation check.");
            return [];
        }
        throw error;
    }
}

export async function addViewer(viewerData: NewViewerData): Promise<Viewer> {
    const portal = viewerData.portalOrigin || 'standard';
    const otpCode = await prepareNewUser(viewerData.email, viewerData.firstName, portal);
    
    const viewersRef = getViewersCollection();
    const viewerDocRef = viewersRef.doc(viewerData.email.toLowerCase());
    
    const newViewerData: Omit<Viewer, 'id'> = {
        ...viewerData,
        email: viewerData.email.toLowerCase(),
        otp: otpCode,
        permissions: {},
        expiresAt: viewerData.expiresAt, // This will be passed from the form
        portalOrigin: portal,
    };

    await viewerDocRef.set(newViewerData);

    // Fetch client to get their name for the notification
    const client = await getClientById(viewerData.clientId);
    if(client) {
        await notifyAdminOnViewerCreated(client.nickname, viewerData.nickname);
    }
    
    return { ...newViewerData, id: viewerDocRef.id } as Viewer;
}

export async function bulkAddViewers(viewersData: NewViewerData[]): Promise<{ successCount: number; failureCount: number; }> {
    let successCount = 0;
    let failureCount = 0;
    const viewersRef = getViewersCollection();
    
    const client = viewersData.length > 0 ? await getClientById(viewersData[0].clientId) : null;
    const clientNickname = client ? client.nickname : 'לא ידוע';

    for (const viewerData of viewersData) {
        try {
            const portal = viewerData.portalOrigin || 'standard';
            const otpCode = await prepareNewUser(viewerData.email, viewerData.firstName, portal);
            
            const viewerDocRef = viewersRef.doc(viewerData.email.toLowerCase());
            
            const newViewer: Omit<Viewer, 'id'> = {
                ...viewerData,
                email: viewerData.email.toLowerCase(),
                otp: otpCode,
                permissions: {},
                // Bulk uploaded viewers get a default 24h expiration
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                portalOrigin: portal,
            };
            await viewerDocRef.set(newViewer);
            await notifyAdminOnViewerCreated(clientNickname, newViewer.nickname);
            successCount++;
        } catch (error) {
            console.error(`Failed to add viewer ${viewerData.email} in bulk:`, error);
            failureCount++;
        }
    }
    return { successCount, failureCount };
}

export async function updateViewer(viewerId: string, updates: ViewerDetailsUpdate): Promise<Viewer> {
    const viewerRef = getViewersCollection().doc(viewerId.toLowerCase());
    await viewerRef.update(updates);
    const updatedDoc = await viewerRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Viewer;
}

export async function deleteViewer(viewerId: string): Promise<{ success: boolean }> {
    const viewerRef = getViewersCollection().doc(viewerId);
    const viewerDoc = await viewerRef.get();

    if (!viewerDoc.exists) {
        console.warn(`Viewer with ID ${viewerId} not found for deletion.`);
        return { success: false };
    }

    const viewerData = viewerDoc.data() as Viewer;

    const archiveRef = getArchiveCollection().doc();
    const archiveData = {
        originalId: viewerId,
        originalCollection: 'viewers',
        deletedAt: new Date().toISOString(),
        data: viewerData,
    };

    const batch = getDb().batch();
    batch.set(archiveRef, archiveData);
    batch.delete(viewerRef);
    
    await batch.commit();

    return { success: true };
}

export async function deleteMultipleViewers(viewerIds: string[]): Promise<{ success: boolean }> {
    const batch = getDb().batch();
    const viewersRef = getViewersCollection();
    const archiveRef = getArchiveCollection();

    for (const id of viewerIds) {
        const docRef = viewersRef.doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            const docData = doc.data();
            const newArchiveRef = archiveRef.doc();
            batch.set(newArchiveRef, {
                originalId: id,
                originalCollection: 'viewers',
                deletedAt: new Date().toISOString(),
                data: docData,
            });
            batch.delete(docRef);
        }
    }
    
    await batch.commit();
    return { success: true };
}

export async function resendViewerVerificationEmail(viewerId: string): Promise<{ success: boolean }> {
    const viewerRef = getViewersCollection().doc(viewerId);
    const doc = await viewerRef.get();
    if (!doc.exists) {
        throw new Error('Viewer not found.');
    }
    const viewer = doc.data() as Viewer;
    const portal = viewer.portalOrigin || 'standard';

    const emailResult = await sendVerificationEmail(viewer.email, viewer.firstName, portal);
    if (!emailResult.otpCode) {
        throw new Error(emailResult.error || 'Failed to generate new OTP for viewer.');
    }

    await viewerRef.update({ otp: emailResult.otpCode });
    return { success: true };
}

export async function updateViewersPermissions(viewerIds: string[], permissions: ViewerPermissions): Promise<{ success: boolean }> {
    const batch = getDb().batch();
    viewerIds.forEach(id => {
        const docRef = getViewersCollection().doc(id);
        batch.update(docRef, { permissions });
    });
    await batch.commit();
    return { success: true };
}

export async function getTotalRegisteredViewers(): Promise<number> {
    try {
        const snapshot = await getViewersCollection().count().get();
        return snapshot.data().count;
    } catch (error: any) {
        if (error.code === 5) { return 0; }
        console.error("Error getting total viewers count:", error);
        return 0;
    }
}

export async function handleStreamRenameInViewers(oldName: string, newName: string): Promise<void> {
    const viewersRef = getViewersCollection();
    const snapshot = await viewersRef.get();
    
    const batch = getDb().batch();
    snapshot.docs.forEach(doc => {
        const viewer = doc.data() as Viewer;
        if (viewer.permissions && viewer.permissions[oldName]) {
            const newPermissions = { ...viewer.permissions };
            newPermissions[newName] = newPermissions[oldName];
            delete newPermissions[oldName];
            batch.update(doc.ref, { permissions: newPermissions });
        }
    });

    await batch.commit();
}
