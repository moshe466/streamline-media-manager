

'use server';

import { getSystemCredentials } from './users';
import { getClientById, saveClientSocialTokens } from './clients'; // Corrected import path
import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';

export type FacebookAccount = {
    id: string;
    name: string;
    accessToken: string; // Page-specific access token
    category: string;
};

const getFacebookClientConfig = async () => {
    const credentials = await getSystemCredentials();
    const clientId = credentials.facebookClientId;
    const clientSecret = credentials.facebookClientSecret;

    if (!clientId || !clientSecret) {
        throw new Error('Facebook Client ID or Secret is not configured in settings.');
    }
    return { clientId, clientSecret };
}

export async function exchangeCodeForToken(code: string, redirectUri: string, userId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { clientId, clientSecret } = await getFacebookClientConfig();
        
        const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        tokenUrl.searchParams.set('client_id', clientId);
        tokenUrl.searchParams.set('redirect_uri', redirectUri);
        tokenUrl.searchParams.set('client_secret', clientSecret);
        tokenUrl.searchParams.set('code', code);

        const tokenResponse = await fetch(tokenUrl.toString());
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(tokenData.error?.message || 'Failed to exchange code for token.');
        }

        const shortLivedToken = tokenData.access_token;
        if (!shortLivedToken) {
             throw new Error('Access token not found in Facebook response.');
        }

        // Exchange short-lived token for a long-lived one
        const longLivedUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longLivedUrl.searchParams.set('client_id', clientId);
        longLivedUrl.searchParams.set('client_secret', clientSecret);
        longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

        const longLivedResponse = await fetch(longLivedUrl.toString());
        const longLivedData = await longLivedResponse.json();

        if (!longLivedResponse.ok) {
            throw new Error(longLivedData.error?.message || 'Failed to exchange for long-lived token.');
        }

        const longLivedToken = longLivedData.access_token;
        
        const dataToSave = { facebook: { accessToken: longLivedToken, issuedAt: new Date().toISOString() } };

        if (userId) {
            await saveClientSocialTokens(userId, dataToSave);
        } else {
             await getDb().collection('settings').doc('facebook_tokens').set(dataToSave.facebook, { merge: true });
        }


        await logEvent('FACEBOOK_AUTH_SUCCESS', `Successfully exchanged code for Facebook API token for user: ${userId || 'admin'}.`);
        return { success: true };
        
    } catch (error) {
        console.error("Error exchanging code for Facebook token:", error);
        await logEvent('FACEBOOK_AUTH_FAILURE', `Failed to exchange code for token. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}


export async function getFacebookAccounts(clientId?: string): Promise<FacebookAccount[]> {
    try {
        let userAccessToken: string | undefined;
        if (clientId) {
            const client = await getClientById(clientId);
            userAccessToken = client?.socialTokens?.facebook?.accessToken;
        } else {
            const tokenDoc = await getDb().collection('settings').doc('facebook_tokens').get();
            if (tokenDoc.exists) {
                userAccessToken = tokenDoc.data()?.accessToken;
            }
        }
        
        if (!userAccessToken) throw new Error('Facebook access token not found. Please re-authenticate.');

        const response = await fetch(`https://graph.facebook.com/me/accounts?access_token=${userAccessToken}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);
        
        return data.data.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            accessToken: acc.access_token,
            category: acc.category,
        }));
    } catch (error) {
        console.error("Error fetching Facebook accounts:", error);
        await logEvent('FACEBOOK_ACCOUNTS_FETCH_FAILURE', `Failed to fetch accounts for ${clientId || 'admin'}. Error: ${(error as Error).message}`);
        return [];
    }
}

type FacebookBroadcastOptions = {
    privacy: 'EVERYONE' | 'ALL_FRIENDS' | 'SELF';
    usePersistentKey: boolean;
    shareToStory: boolean;
};

export async function createFacebookLiveVideo(
    targetId: string, // 'me' or page/group ID
    title: string,
    description: string,
    options: FacebookBroadcastOptions,
    clientId?: string
): Promise<{ success: boolean; rtmpUrl?: string; error?: string; broadcastId?: string, watchUrl?: string }> {
    try {
         let accessToken: string | undefined;
        if (clientId) {
            const client = await getClientById(clientId);
            accessToken = client?.socialTokens?.facebook?.accessToken;
        } else {
            const tokenDoc = await getDb().collection('settings').doc('facebook_tokens').get();
            if (tokenDoc.exists) {
                accessToken = tokenDoc.data()?.accessToken;
            }
        }
        
        if (!accessToken) throw new Error('Facebook access token not found. Please re-authenticate.');

        if (targetId !== 'me') {
            const accounts = await getFacebookAccounts(clientId);
            const targetAccount = accounts.find(acc => acc.id === targetId);
            if (targetAccount?.accessToken) {
                accessToken = targetAccount.accessToken;
            }
        }

        const liveVideoUrl = `https://graph.facebook.com/v19.0/${targetId}/live_videos`;
        
        const requestBody: any = {
            title: title,
            description: description,
            status: 'LIVE_NOW',
            access_token: accessToken,
            stream_type: options.usePersistentKey ? 'AMBIENT' : 'REGULAR',
            content_tags: options.shareToStory ? ['story_share'] : [],
        };
        
        if (options.privacy) {
            requestBody.privacy = JSON.stringify({ value: options.privacy });
        }

        const response = await fetch(liveVideoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to create live video on Facebook.');
        }

        const rtmpUrl = options.usePersistentKey ? data.secure_stream_url.replace('rtmps://', 'rtmp://') : data.secure_stream_url;
        const broadcastId = data.id;

        if (!rtmpUrl) {
            throw new Error('RTMP URL not found in Facebook response.');
        }

        const watchUrl = targetId === 'me'
            ? `https://www.facebook.com/watch/live/?v=${broadcastId}`
            : `https://www.facebook.com/${targetId}/videos/${broadcastId}`;

        await logEvent('FACEBOOK_BROADCAST_CREATED', `Successfully created Facebook live video for target ${targetId}.`);
        return { success: true, rtmpUrl, broadcastId, watchUrl };

    } catch (error) {
        console.error("Error creating Facebook live video:", error);
        await logEvent('FACEBOOK_BROADCAST_FAILURE', `Failed to create live video. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}
