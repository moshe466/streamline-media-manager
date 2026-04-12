

'use server';

import { google } from 'googleapis';
import { getSystemCredentials, saveSystemCredentials } from './users';
import { getClientById, saveClientSocialTokens } from './clients'; // Corrected import path
import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';

export type YouTubeChannel = {
    id: string;
    title: string;
};

const REDIRECT_URI = 'https://app.mizrachitv.co.il/auth/callback';

async function getYouTubeClient(clientId?: string) {
    const credentials = await getSystemCredentials();
    const googleClientId = credentials.googleClientId || credentials.youtubeClientId;
    const googleClientSecret = credentials.googleClientSecret || credentials.youtubeClientSecret;

    if (!googleClientId || !googleClientSecret) {
        throw new Error('Google Client ID or Secret is not configured in settings.');
    }

    const oauth2Client = new google.auth.OAuth2(googleClientId, googleClientSecret, REDIRECT_URI);
    
    let tokens: any;
    if (clientId) {
        const client = await getClientById(clientId);
        tokens = client?.socialTokens?.youtube;
    } else {
        // Admin flow
        const tokenDoc = await getDb().collection('settings').doc('youtube_tokens').get();
        if (tokenDoc.exists) {
            tokens = tokenDoc.data();
        }
    }

    if (!tokens?.accessToken) {
         if (clientId) {
            console.log(`No YouTube tokens found for client ${clientId}. Returning unauthenticated client.`);
         }
         return oauth2Client; // Return client without tokens for the initial auth step
    }

    oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiryDate,
    });
    
    // Set up a token refresh listener
    oauth2Client.on('tokens', async (newTokens) => {
        console.log(`YouTube token was refreshed for ${clientId || 'admin'}.`);
        const updatedTokens = { 
             accessToken: newTokens.access_token ?? '',
             refreshToken: newTokens.refresh_token ?? tokens.refreshToken ?? undefined, // Keep old refresh token if new one isn't provided
             expiryDate: newTokens.expiry_date ?? undefined,
             scope: newTokens.scope ?? undefined,
        };
        
        if (clientId) {
            await saveClientSocialTokens(clientId, { youtube: updatedTokens });
        } else {
            await getDb().collection('settings').doc('youtube_tokens').set(updatedTokens, { merge: true });
        }
    });

    return oauth2Client;
}


export async function exchangeCodeForToken(code: string, redirectUri: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const oauth2Client = await getYouTubeClient(userId); // Get client without tokens initially
        const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });

        if (!tokens.access_token) {
            throw new Error("Failed to retrieve access token from Google.");
        }
        
        const dataToSave = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token ?? undefined,
            expiryDate: tokens.expiry_date ?? undefined,
            scope: tokens.scope ?? undefined,
        };

        if (userId) {
            await saveClientSocialTokens(userId, { youtube: dataToSave });
        } else {
            await getDb().collection('settings').doc('youtube_tokens').set(dataToSave, { merge: true });
        }

        await logEvent('YOUTUBE_AUTH_SUCCESS', `Successfully exchanged code for YouTube API tokens for user: ${userId || 'admin'}.`);
        return { success: true };
    } catch (error) {
        console.error("Error exchanging code for token:", error);
        await logEvent('YOUTUBE_AUTH_FAILURE', `Failed to exchange code for token for ${userId || 'admin'}. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}

export async function exchangeGoogleCodeForProfile(code: string): Promise<{ success: boolean; error?: string; profile?: { email: string, firstName: string, lastName: string } }> {
    try {
        const oauth2Client = await getYouTubeClient(); // Use admin client for this
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        
        if (userInfo.data.email && userInfo.data.given_name && userInfo.data.family_name) {
             return {
                success: true,
                profile: {
                    email: userInfo.data.email,
                    firstName: userInfo.data.given_name,
                    lastName: userInfo.data.family_name
                }
            };
        } else {
            throw new Error("Could not retrieve full profile information from Google.");
        }
    } catch (error) {
        console.error("Error exchanging Google code for profile:", error);
        return { success: false, error: (error as Error).message };
    }
}


export async function listChannels(clientId?: string): Promise<YouTubeChannel[]> {
    try {
        const oauth2Client = await getYouTubeClient(clientId);
        
        // If the client has no access token, we can't fetch channels
        if (!oauth2Client.credentials.access_token) {
            console.log(`Cannot list channels for ${clientId || 'admin'}: No access token available.`);
            return [];
        }

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        
        const response = await youtube.channels.list({
            part: ['snippet', 'id'],
            mine: true,
        });

        if (!response.data.items) {
            return [];
        }

        return response.data.items.map(item => ({
            id: item.id!,
            title: item.snippet!.title!,
        }));

    } catch (error) {
        console.error(`Error listing YouTube channels for ${clientId || 'admin'}:`, error);
        // Don't throw, just return empty array so the UI doesn't crash
        return [];
    }
}

export async function saveSelectedChannel(channelId: string, clientId?: string): Promise<void> {
    const dataToSave: { youtubeSelectedChannelId?: string; socialTokens?: any } = {};

    if (clientId) {
        const client = await getClientById(clientId);
        const currentTokens = client?.socialTokens?.youtube || {};
        dataToSave.socialTokens = { youtube: { ...currentTokens, channelId } };
        await saveClientSocialTokens(clientId, dataToSave.socialTokens);
    } else {
        dataToSave.youtubeSelectedChannelId = channelId;
        await saveSystemCredentials(dataToSave);
    }
}


export async function createYouTubeBroadcast(
    title: string, 
    description: string, 
    privacyStatus: 'public' | 'private' | 'unlisted',
    options: { enableAutoStart?: boolean; enableAutoStop?: boolean; enableDvr?: boolean; },
    clientId?: string
): Promise<{ success: boolean; rtmpUrl?: string; streamKey?: string; broadcastId?: string, error?: string }> {
    try {
        const oauth2Client = await getYouTubeClient(clientId);
        if (!oauth2Client.credentials.access_token) {
            throw new Error('User is not authenticated with YouTube.');
        }

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        
        let selectedChannelId: string | undefined;
        if(clientId) {
            const client = await getClientById(clientId);
            selectedChannelId = client?.socialTokens?.youtube?.channelId;
        } else {
            const credentials = await getSystemCredentials();
            selectedChannelId = credentials.youtubeSelectedChannelId;
        }

        if (!selectedChannelId) {
            throw new Error('No YouTube channel has been selected. Please select a default channel in the settings.');
        }

        const streamInsertResponse = await youtube.liveStreams.insert({
            part: ['snippet', 'cdn', 'status'],
            requestBody: {
                snippet: {
                    title: title,
                    description: 'MizrachiTV Stream',
                },
                cdn: {
                    frameRate: '30fps',
                    ingestionType: 'rtmp',
                    resolution: '1080p',
                },
            },
        });

        const liveStream = streamInsertResponse.data;
        if (!liveStream.id || !liveStream.cdn?.ingestionInfo?.ingestionAddress || !liveStream.cdn?.ingestionInfo?.streamName) {
            throw new Error('Failed to create YouTube live stream resource or ingestion info is missing.');
        }

        const broadcastInsertResponse: any = await youtube.liveBroadcasts.insert({
            part: ['snippet', 'contentDetails', 'status'],
            requestBody: {
                snippet: {
                    title: title,
                    description: description,
                    scheduledStartTime: new Date().toISOString(),
                    channelId: selectedChannelId,
                },
                contentDetails: {
                    enableAutoStart: options.enableAutoStart,
                    enableAutoStop: options.enableAutoStop,
                    enableDvr: options.enableDvr,
                },
                status: {
                    privacyStatus: privacyStatus,
                    selfDeclaredMadeForKids: false,
                },
            },
        });

        const broadcast = broadcastInsertResponse.data;
        if (!broadcast.id) {
            throw new Error('Failed to create YouTube live broadcast resource.');
        }

        await youtube.liveBroadcasts.bind({
            part: ['id', 'contentDetails'],
            id: broadcast.id,
            streamId: liveStream.id,
        });

        const rtmpUrl = liveStream.cdn.ingestionInfo.ingestionAddress;
        const streamKey = liveStream.cdn.ingestionInfo.streamName;
        
        await logEvent('YOUTUBE_BROADCAST_CREATED', `Successfully created YouTube broadcast "${title}" (ID: ${broadcast.id}) for user ${clientId || 'admin'}.`);

        return { success: true, rtmpUrl, streamKey, broadcastId: broadcast.id };

    } catch (error) {
        console.error("Error creating YouTube broadcast:", error);
        await logEvent('YOUTUBE_BROADCAST_FAILURE', `Failed to create broadcast for ${clientId || 'admin'}. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}


export async function endYouTubeBroadcast(broadcastId: string, clientId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const oauth2Client = await getYouTubeClient(clientId);
        if (!oauth2Client.credentials.access_token) {
            throw new Error('User is not authenticated with YouTube.');
        }

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        const transitionResponse = await youtube.liveBroadcasts.transition({
            part: ['id', 'status'],
            id: broadcastId,
            broadcastStatus: 'complete',
        });
        
        if (transitionResponse.status === 200 && transitionResponse.data.status?.lifeCycleStatus === 'complete') {
            await logEvent('YOUTUBE_BROADCAST_ENDED', `Successfully ended YouTube broadcast ID: ${broadcastId} for user ${clientId || 'admin'}.`);
            return { success: true };
        } else {
            throw new Error(`Failed to transition broadcast status. API responded with status: ${transitionResponse.status}`);
        }
    } catch (error) {
        console.error(`Error ending YouTube broadcast ${broadcastId}:`, error);
        await logEvent('YOUTUBE_BROADCAST_END_FAILURE', `Failed to end broadcast ${broadcastId} for user ${clientId || 'admin'}. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}
