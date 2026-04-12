
'use server';
import { revalidatePath } from 'next/cache';
import { logEvent } from './logger';
import { handleActionError } from '@/lib/security-utils';
import { getSystemCredentials } from './users';
import type { FlussonicStream, StreamDetails, DvrConfig, Logo, StreamPush } from './flussonic-types';
export type { FlussonicStream, StreamDetails, DvrConfig, Logo, StreamPush, ProtocolOptions } from './flussonic-types';
import { FlussonicApiResponseSchema, StreamDetailsSchema, DvrConfigsApiResponseSchema, LogoApiResponseSchema } from './flussonic-types';
import { getClientById, type Client } from './clients';
import { getDb } from '@/lib/firebase-admin';
import { createSecureLink } from './secure-links';
import { headers } from 'next/headers';
import { validateActionCaller, AuthContext } from './security';

/**
 * Break circular dependency with telegram/notifications by using dynamic imports inside functions.
 */

export async function getFlussonicConnectionDetails(instanceId?: string): Promise<{ apiUrl: string; authHeader: string; publicHost: string; ingestHost: string; }> {
    const creds = await getSystemCredentials();
    const flussonicHost = creds.flussonicHost || 'http://146.19.143.118';
    const flussonicUsername = creds.flussonicUsername || 'admin';
    const flussonicPassword = creds.flussonicPassword || '';
    
    let publicHost = 'ingest.mizrachitv.co.il';
    let ingestHost = creds.flussonicPublicHost || 'ingest.mizrachitv.co.il';
    
    if (instanceId === 'uh') {
        publicHost = 'ingest.uhdrones.org.il';
        ingestHost = 'ingest.uhdrones.org.il';
    } else {
        try {
            const hostHeader = headers().get('host') || '';
            if (hostHeader.includes('uhdrones') || hostHeader.includes('/uh')) {
                publicHost = 'ingest.uhdrones.org.il';
                ingestHost = 'ingest.uhdrones.org.il';
            }
        } catch (e) {}
    }
    
    let cleanHost = flussonicHost.endsWith('/') ? flussonicHost.slice(0, -1) : flussonicHost;
    if (!cleanHost.startsWith('http')) cleanHost = 'http://' + cleanHost;
    
    return {
        apiUrl: `${cleanHost}/streamer/api/v3`,
        authHeader: 'Basic ' + Buffer.from(`${flussonicUsername}:${flussonicPassword}`).toString('base64'),
        publicHost,
        ingestHost,
    };
}

export async function getStreams(instanceId?: string): Promise<FlussonicStream[]> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(apiUrl + '/streams', { 
            headers: { 'Authorization': authHeader }, 
            cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`Origin error: ${response.status}`);
        const data = await response.json();
        const parsed = FlussonicApiResponseSchema.safeParse(data);
        if (!parsed.success) throw new Error(`Invalid schema from Flussonic API`);
        return parsed.data.streams.map(stream => ({ 
            name: stream.name, 
            status: stream.stats?.alive ? 'online' : 'offline', 
            comment: stream.comment, 
            title: stream.title 
        }));
    } catch (error) {
        console.error("Fetch streams error:", error);
        return [];
    }
}

export async function createStream(auth: AuthContext, streamName: string, sourceUrl?: string, title?: string, creatorId?: string, instanceId?: string): Promise<{ success: boolean; error?: string; updatedClient?: Client | null; }> {
    try {
        await validateActionCaller(auth);
        const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
        const inputUrl = sourceUrl && sourceUrl.trim() !== '' ? sourceUrl : 'publish://';
        
        let creatorName = 'מערכת';
        let client: Client | null = null;
        if(creatorId) {
            client = await getClientById(creatorId);
            if (client) creatorName = client.nickname;
        }

        const response = await fetch(`${apiUrl}/streams/${streamName}`, {
            method: 'PUT',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                inputs: [{ url: inputUrl }], 
                static: true, 
                publish_enabled: true, 
                thumbnails: { enabled: true }, 
                comment: creatorName, 
                title: title || undefined 
            }),
        });

        if (!response.ok) throw new Error('Failed to create stream on origin');
        
        let updatedClient: Client | null = null;
        const { notifyNewStreamAdded, notifyAdminOnNewStream } = await import('./notifications');

        if (client) {
            await grantClientStreamAccess(client.id, streamName);
            updatedClient = await getClientById(client.id);
            await notifyNewStreamAdded(client.id, streamName);
        }
        
        await notifyAdminOnNewStream(streamName, creatorName);
        await logEvent('STREAM_CREATED', `Stream ${streamName} was created by ${creatorName}`);
        
        revalidatePath('/admin/streams', 'layout');
        return { success: true, updatedClient };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function deleteStream(auth: AuthContext, streamName: string, clientId?: string, instanceId?: string): Promise<{ success: boolean; error?: string, updatedClient?: Client | null }> {
    try {
        const caller = await validateActionCaller(auth);
        if (caller.role === 'client' && !caller.permissions?.canDeleteStreams) {
            throw new Error('אין לך הרשאה למחוק שידורים.');
        }

        const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
        const response = await fetch(`${apiUrl}/streams/${streamName}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': authHeader } 
        });

        if (!response.ok) throw new Error('Failed to delete on origin');
        
        let updatedClient: Client | null = null;
        if (clientId) {
            const client = await getClientById(clientId);
            if (client) {
                const newPermissions = { ...client.permissions };
                delete newPermissions.allowedStreams[streamName];
                await getDb().collection('clients').doc(clientId).update({ 
                    permissions: newPermissions, 
                    streams: Object.keys(newPermissions.allowedStreams).length 
                });
                updatedClient = await getClientById(client.id);
                const { notifyAdminOnStreamDelete } = await import('./notifications');
                await notifyAdminOnStreamDelete(streamName, client.nickname);
            }
        }
        await logEvent('STREAM_DELETED', `Stream ${streamName} was deleted by ${caller.nickname}`);
        return { success: true, updatedClient };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function getStreamDetails(streamName: string, instanceId?: string): Promise<StreamDetails | null> {
    try {
        const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
        const response = await fetch(`${apiUrl}/streams/${streamName}`, { 
            headers: { 'Authorization': authHeader }, 
            cache: 'no-store' 
        });
        if (!response.ok) return null;
        const data = await response.json();
        const streamData = Array.isArray(data?.streams) ? data.streams[0] : data;
        const parsed = StreamDetailsSchema.safeParse(streamData);
        return parsed.success ? parsed.data : null;
    } catch (error) {
        return null;
    }
}

export async function updateStream(auth: AuthContext, streamName: string, config: Partial<StreamDetails>, actorId?: string, instanceId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const caller = await validateActionCaller(auth);
        const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
        
        const response = await fetch(`${apiUrl}/streams/${streamName}`, {
            method: 'PUT',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });

        if (!response.ok) throw new Error('Failed to update origin');
        
        // Log push updates specifically as requested
        if (config.pushes) {
            await logEvent('STREAM_PUSH_UPDATE', `User ${caller.nickname} updated pushes for stream ${streamName}. Total pushes: ${config.pushes.length}`);
        }

        // Save the config to disk on Flussonic
        await fetch(`${apiUrl}/streams/${streamName}/save`, { 
            method: 'POST', 
            headers: { 'Authorization': authHeader } 
        });

        revalidatePath(`/admin/streams/${streamName}`, 'page');
        revalidatePath(`/client`, 'layout');
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function generateSecureStreamLink(auth: AuthContext, streamName: string, instanceId: string = 'default'): Promise<{ success: boolean, id?: string, error?: string }> {
    try {
        const caller = await validateActionCaller(auth);
        
        const hasAccess = (caller.role === 'admin' || caller.role === 'super-admin') || 
                          (caller.permissions?.hasAllStreamsAccess && caller.permissions?.canCreateSecureLinks) || 
                          (caller.permissions?.allowedStreams?.[streamName]?.canCreateSecureLink);
        
        if (!hasAccess) {
            throw new Error('אין לך הרשאה ליצירת קישורים עבור שידור זה.');
        }
        
        const currentHost = headers().get("host") || "";
        const appHost = currentHost.includes("uhdrones.org.il")
            ? "mcr.uhdrones.org.il"
            : (currentHost.includes("mizrachitv.co.il") ? currentHost : (instanceId === "uh" ? "mcr.uhdrones.org.il" : "app.mizrachitv.co.il"));
        return createSecureLink(streamName, instanceId, caller.nickname, appHost);
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function getDvrConfigs(instanceId?: string): Promise<DvrConfig[]> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(`${apiUrl}/dvrs`, { 
            headers: { 'Authorization': authHeader }, 
            cache: 'no-store' 
        });
        if (!response.ok) return [];
        const data = await response.json();
        const parsed = DvrConfigsApiResponseSchema.safeParse(data);
        return parsed.success ? parsed.data.dvrs : [];
    } catch (error) {
        return [];
    }
}

export async function updateStreamMetadata(auth: AuthContext, streamName: string, newName: string, sourceUrl: string, clientId?: string, instanceId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const caller = await validateActionCaller(auth);
        const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
        const response = await fetch(`${apiUrl}/streams/${streamName}`, {
            method: 'PUT',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, inputs: [{ url: sourceUrl }] }),
        });
        if (!response.ok) throw new Error('Failed to update metadata on origin');
        await logEvent('STREAM_METADATA_UPDATE', `Metadata for ${streamName} updated by ${caller.nickname}. Source: ${sourceUrl}`);
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function checkFlussonicStatus(instanceId?: string): Promise<{ success: boolean; error?: string; active_streams?: number }> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(apiUrl + '/streams', { 
            headers: { 'Authorization': authHeader }, 
            cache: 'no-store', 
            signal: AbortSignal.timeout(5000) 
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { 
            success: true, 
            active_streams: data.streams?.filter((s: any) => s.stats?.alive).length || 0 
        };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

export async function getLogos(instanceId?: string): Promise<Logo[]> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(apiUrl + '/logos', { 
            headers: { 'Authorization': authHeader }, 
            cache: 'no-store' 
        });
        if (!response.ok) return [];
        const data = await response.json();
        const parsed = LogoApiResponseSchema.safeParse(data);
        return parsed.success ? parsed.data.logos : [];
    } catch (error) {
        return [];
    }
}

export async function addLogo(name: string, base64Content: string, contentType: string, instanceId?: string): Promise<{ success: boolean; error?: string }> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(`${apiUrl}/logos/${name}`, {
            method: 'PUT',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: base64Content, content_type: contentType }),
        });
        if (!response.ok) throw new Error('Failed to add logo to origin');
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function deleteLogo(name: string, instanceId?: string): Promise<{ success: boolean; error?: string }> {
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails(instanceId);
    try {
        const response = await fetch(`${apiUrl}/logos/${name}`, { 
            method: 'DELETE', 
            headers: { 'Authorization': authHeader } 
        });
        if (!response.ok) throw new Error('Failed to delete logo on origin');
        return { success: true };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function grantClientStreamAccess(clientId: string, streamName: string): Promise<void> {
    const clientRef = getDb().collection('clients').doc(clientId.toLowerCase());
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) return;
    
    const data = clientDoc.data() as Client;
    const permissions = data.permissions;
    const allowedStreams = permissions.allowedStreams || {};
    
    allowedStreams[streamName] = { 
        canPush: true, 
        canEditDetails: true, 
        canViewStats: true, 
        canManageDVR: true, 
        canManageThumbnails: true, 
        canManageProtocols: true, 
        canBroadcastWebRTC: false, 
        canCreateSecureLink: true 
    };
    
    await clientRef.update({ 
        'permissions.allowedStreams': allowedStreams, 
        streams: Object.keys(allowedStreams).length 
    });
}
