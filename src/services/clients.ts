
'use server';
import { getDb } from '@/lib/firebase-admin';
import { handleActionError } from '@/lib/security-utils';
import { logEvent } from './logger';
import { prepareNewUser } from './users';
import { initializeStorageForClient } from './storage';
import { FieldValue } from 'firebase-admin/firestore';
import type { MultiviewSettings } from './users';
import { validateActionCaller, AuthContext } from './security';
import { sendVerificationEmail, sendApprovalAndSummaryEmail, sendBroadcastAccessEmail } from './email';

const getClientsCollection = () => getDb().collection('clients');
const getArchiveCollection = () => getDb().collection('deleted_archive');

export type ClientLink = { id: string; name: string; url: string; showToViewers: boolean; };
export type PushDestination = { id: string; name: string; rtmp_url: string; stream_key: string; };
export type TelegramChat = { id: string; name: string; };
export type NotificationSettings = { onStreamOnline?: { [streamName: string]: boolean }; onStreamOffline?: { [streamName: string]: boolean }; onSubscriptionEnding?: boolean; onNewStreamAdded?: boolean; onViewerRequest?: boolean; onPushStart?: boolean; };
export type WatermarkSettings = { url: string | null; position: { x: number; y: number }; size: number; opacity: number; displayMode: 'image' | 'lines'; };
export type ClientPermissions = { canCreateStreams: boolean; canDeleteStreams: boolean; canCreateViewers: boolean; canUseWebRTC: boolean; canCreateSecureLinks: boolean; hasAllStreamsAccess: boolean; maxPushDestinations: number; maxStreams: number; maxConcurrentBroadcasts: number; allowedStreams: { [streamName: string]: { canPush: boolean; canEditDetails: boolean; canViewStats: boolean; canManageDVR: boolean; canManageThumbnails: boolean; canManageProtocols: boolean; canBroadcastWebRTC?: boolean; canCreateSecureLink?: boolean; }; }; };
export type SocialTokens = { youtube?: { accessToken: string; refreshToken?: string; expiryDate?: number; scope?: string; channelId?: string; channelTitle?: string; }; facebook?: { accessToken: string; issuedAt?: string; }; };
export type Client = { id: string; instanceId?: string; firstName: string; lastName: string; nickname: string; phone: string; email: string; isManager?: boolean; idNumber?: string; otp: string; activeUntil: string | null; streams: number; status: 'פעיל' | 'לא פעיל' | 'בהמתנה'; permissions: ClientPermissions; notificationSettings?: NotificationSettings; links?: ClientLink[]; pushDestinations?: PushDestination[]; telegramPushDestinations?: PushDestination[]; createdAt: string; createdBy?: string; receiptUrl?: string; customLogoUrl?: string | null; customOfflineLogoUrl?: string | null; watermarkSettings?: WatermarkSettings | null; profileImageUrl?: string | null; socialTokens?: SocialTokens; telegramChats?: TelegramChat[]; telegramNotificationsEnabled?: boolean; activeSessionId?: string; multiviewSettings?: MultiviewSettings; webrtcUsername?: string; webrtcPassword?: string; broadcastSessionId?: string | string[]; portalOrigin?: 'uh' | 'standard'; };

const defaultPermissions: ClientPermissions = { canCreateStreams: false, canDeleteStreams: false, canCreateViewers: true, canUseWebRTC: false, canCreateSecureLinks: false, hasAllStreamsAccess: false, maxPushDestinations: 1, maxStreams: 1, maxConcurrentBroadcasts: 1, allowedStreams: {}, };

export async function checkAndDeactivateExpiredClients(): Promise<void> {
    const now = new Date().toISOString();
    try {
        const snapshot = await getClientsCollection().where('status', '==', 'פעיל').where('activeUntil', '<', now).get();
        if (snapshot.empty) return;
        const batch = getDb().batch();
        snapshot.docs.forEach(doc => batch.update(doc.ref, { status: 'לא פעיל' }));
        await batch.commit();
        await logEvent('EXPIRED_CLIENTS_DEACTIVATED', `Deactivated ${snapshot.size} clients.`);
    } catch (error: any) {
        console.warn("Non-critical error in checkAndDeactivateExpiredClients:", error.message);
    }
}

export async function getClients(auth: AuthContext, instanceId?: string): Promise<Client[]> {
    try {
        if (auth.userId !== 'system') {
            await validateActionCaller(auth, ['admin', 'super-admin', 'editor']);
        }
        checkAndDeactivateExpiredClients().catch(console.error);
        let query: any = getClientsCollection();
        if (instanceId) query = query.where('instanceId', '==', instanceId);
        const snapshot = await query.get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Client));
    } catch (error) {
        throw new Error(handleActionError(error));
    }
}

export async function getClientById(clientId: string): Promise<Client | null> {
    try {
        const doc = await getClientsCollection().doc(clientId.toLowerCase()).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Client;
    } catch (error) {
        return null;
    }
}

export async function addClient(clientData: any, adminUserId: string, instanceId?: string, portal: 'uh' | 'standard' = 'standard'): Promise<{ newClient: Client }> {
    try {
        const otpCode = await prepareNewUser(clientData.email, clientData.nickname, portal);
        const clientDocRef = getClientsCollection().doc(clientData.email.toLowerCase());
        const newClientData: Omit<Client, 'id'> = {
            ...clientData, instanceId: instanceId || 'default', email: clientData.email.toLowerCase(), otp: otpCode, activeUntil: null, status: 'פעיל', streams: 0, permissions: defaultPermissions, notificationSettings: {}, links: [], pushDestinations: [], telegramPushDestinations: [], createdAt: new Date().toISOString(), createdBy: adminUserId, socialTokens: {}, telegramChats: [], telegramNotificationsEnabled: true, portalOrigin: portal,
        };
        await clientDocRef.set(newClientData);
        await initializeStorageForClient(clientDocRef.id);
        await logEvent('CLIENT_CREATED', `Client "${newClientData.nickname}" created by admin ${adminUserId}`);
        return { newClient: { ...newClientData, id: clientDocRef.id } as Client };
    } catch (error) {
        throw new Error(handleActionError(error));
    }
}

export async function updateClientDetails(clientId: string, updates: Partial<Client>): Promise<Client> {
    try {
        const clientRef = getClientsCollection().doc(clientId.toLowerCase());
        const finalUpdates: any = { ...updates };
        ['customLogoUrl', 'customOfflineLogoUrl', 'profileImageUrl', 'watermarkSettings'].forEach(field => {
            if (updates[field as keyof Client] === null) finalUpdates[field] = FieldValue.delete();
        });
        await clientRef.update(finalUpdates);
        const updated = await clientRef.get();
        return { id: updated.id, ...updated.data() } as Client;
    } catch (error) {
        throw new Error(handleActionError(error));
    }
}

export async function deleteClient(auth: AuthContext, clientId: string): Promise<{ success: boolean }> {
    try {
        await validateActionCaller(auth, ['admin', 'super-admin']);
        const clientRef = getClientsCollection().doc(clientId);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists) return { success: false };
        const clientData = clientDoc.data() as Client;
        const batch = getDb().batch();
        batch.set(getArchiveCollection().doc(), { originalId: clientId, originalCollection: 'clients', deletedAt: new Date().toISOString(), data: clientData });
        batch.delete(clientRef);
        await batch.commit();
        await logEvent('CLIENT_DELETED', `Client ${clientData.nickname} archived by ${auth.userId}`);
        return { success: true };
    } catch (error) {
        throw new Error(handleActionError(error));
    }
}

export async function updateClientNotificationSettings(clientId: string, settings: NotificationSettings): Promise<{ success: boolean; error?: string }> {
    try {
        await getClientsCollection().doc(clientId.toLowerCase()).update({ notificationSettings: settings });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function updateClientPermissionsAndStatus(
    clientId: string, permissions: ClientPermissions, status: Client['status'], activeUntil: string | null, isManager: boolean, webrtcUsername?: string, webrtcPassword?: string
): Promise<{ success: boolean; updatedClient: Client; error?: string; }> {
    try {
        const clientRef = getClientsCollection().doc(clientId.toLowerCase());
        const currentDoc = await clientRef.get();
        if (!currentDoc.exists) throw new Error(`Client ${clientId} not found.`);
        const currentClientData = currentDoc.data() as Client;
        const finalPermissions = { ...permissions, maxStreams: permissions.maxStreams === -1 ? Infinity : permissions.maxStreams };
        const updateData: any = { permissions: finalPermissions, status, activeUntil, isManager: isManager || false, streams: finalPermissions.hasAllStreamsAccess ? Infinity : Object.keys(finalPermissions.allowedStreams || {}).length };
        if (webrtcUsername !== undefined) updateData.webrtcUsername = webrtcUsername || FieldValue.delete();
        if (webrtcPassword !== undefined) updateData.webrtcPassword = webrtcPassword || FieldValue.delete();
        await clientRef.update(updateData);
        const updatedClient = await getClientById(clientId);
        if (!updatedClient) throw new Error("Could not retrieve updated data.");
        if (!currentClientData.permissions?.canUseWebRTC && finalPermissions.canUseWebRTC && updatedClient.webrtcUsername) {
            await sendBroadcastAccessEmail(updatedClient);
        }
        return { success: true, updatedClient };
    } catch (error) {
        return { success: false, error: handleActionError(error), updatedClient: {} as Client };
    }
}

export async function updateClientsPermissions(auth: AuthContext, clientIds: string[], permissions: ClientPermissions): Promise<{ success: boolean; error?: string }> {
    try {
        await validateActionCaller(auth, ['admin', 'super-admin']);
        const batch = getDb().batch();
        clientIds.forEach(id => {
            batch.update(getClientsCollection().doc(id.toLowerCase()), { permissions });
        });
        await batch.commit();
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function updateClientLinks(clientId: string, links: ClientLink[]): Promise<{ success: boolean; updatedClient?: Client; error?: string }> {
    try {
        const clientRef = getClientsCollection().doc(clientId.toLowerCase());
        await clientRef.update({ links });
        const updated = await clientRef.get();
        return { success: true, updatedClient: { id: updated.id, ...updated.data() } as Client };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function updateTelegramChats(clientId: string, telegramChats: TelegramChat[]): Promise<{ success: boolean; error?: string }> {
    try {
        await getClientsCollection().doc(clientId.toLowerCase()).update({ telegramChats });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function deleteMultipleClients(auth: AuthContext, clientIds: string[]): Promise<void> {
    await validateActionCaller(auth, ['admin', 'super-admin']);
    for (const id of clientIds) {
        await deleteClient(auth, id);
    }
}

export async function resendVerificationEmail(auth: AuthContext, clientId: string): Promise<void> {
    await validateActionCaller(auth, ['admin', 'super-admin']);
    const client = await getClientById(clientId);
    if (!client) return;
    const portal = client.portalOrigin || 'standard';
    const emailResult = await sendVerificationEmail(client.email, client.firstName, portal);
    if (emailResult.otpCode) {
        await getClientsCollection().doc(clientId.toLowerCase()).update({ otp: emailResult.otpCode });
    }
}

export async function saveClientSocialTokens(clientId: string, tokens: SocialTokens): Promise<void> {
    await getClientsCollection().doc(clientId.toLowerCase()).update({ socialTokens: tokens });
}


export async function updateClientTelegramNotificationsEnabled(
  clientId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await getClientsCollection().doc(clientId.toLowerCase()).update({
      telegramNotificationsEnabled: enabled
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateClientTelegramConnection(
  clientId: string,
  data: {
    telegramChats: TelegramChat[];
    telegramNotificationsEnabled?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      telegramChats: data.telegramChats,
    };

    if (typeof data.telegramNotificationsEnabled === 'boolean') {
      payload.telegramNotificationsEnabled = data.telegramNotificationsEnabled;
    }

    await getClientsCollection().doc(clientId.toLowerCase()).update(payload);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
