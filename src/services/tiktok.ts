

'use server';

import { getSystemCredentials, saveSystemCredentials } from './users';
import { logEvent } from './logger';
import { URLSearchParams } from 'url';
import { getDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { getRedirectUri } from './social.config';

const getPkceCollection = () => getDb().collection('pkce_challenges');
const usedAuthCodes = new Set<string>(); // Prevent auth code reuse

async function getTikTokClientConfig() {
    const credentials = await getSystemCredentials();
    const clientKey = credentials.tiktokClientId;
    const clientSecret = credentials.tiktokClientSecret;

    if (!clientKey || !clientSecret) {
        throw new Error('TikTok Client Key or Secret is not configured in settings.');
    }
    return { clientKey, clientSecret };
}

async function saveState(state: string): Promise<void> {
    const docRef = getPkceCollection().doc(state);
    const expires = new Date(Date.now() + 10 * 60 * 1000); 
    await docRef.set({ state, createdAt: new Date().toISOString(), expires });
}

async function verifyState(state: string): Promise<boolean> {
    const docRef = getPkceCollection().doc(state);
    const doc = await docRef.get();
    if (!doc.exists) return false;
    
    await docRef.delete(); // State should be single-use
    const data = doc.data();

    if (data?.expires && data.expires.toDate() < new Date()) {
        console.warn(`TikTok auth state ${state} has expired.`);
        return false;
    }
    return true;
}


export async function buildTikTokAuthorizeUrl(adminId: string): Promise<{ success: boolean, authorizeUrl?: string, error?: string }> {
    try {
        const { clientKey } = await getTikTokClientConfig();
        const scopes = 'user.info.basic'; // Only request basic user info
        
        const state = `tiktok_auth:${adminId}:${crypto.randomUUID()}`;
        await saveState(state);
        
        const params = new URLSearchParams({
            client_key: clientKey,
            redirect_uri: getRedirectUri(),
            response_type: 'code',
            scope: scopes,
            state: state,
        });
        
        const authorizeUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
        return { success: true, authorizeUrl };

    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}


export async function exchangeCodeForToken(code: string, state: string): Promise<{ success: boolean; error?: string }> {
    if (usedAuthCodes.has(code)) {
        const errorMessage = "Authorization code has already been used. Please try authenticating again.";
        await logEvent('TIKTOK_AUTH_FAILURE', errorMessage);
        return { success: false, error: errorMessage };
    }
    
    if (!(await verifyState(state))) {
         const errorMessage = "Invalid or expired state parameter. CSRF attack may have been attempted.";
         await logEvent('TIKTOK_AUTH_FAILURE', errorMessage);
         return { success: false, error: errorMessage };
    }
    
    try {
        const { clientKey, clientSecret } = await getTikTokClientConfig();
        
        usedAuthCodes.add(code);
        setTimeout(() => usedAuthCodes.delete(code), 5 * 60 * 1000);
        
        const body = new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: getRedirectUri(), 
        });

        const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });

        const responseText = await response.text();
        let tokenData: any;
        try {
            tokenData = JSON.parse(responseText);
        } catch (e) {
            console.error("TikTok API response was not valid JSON:", responseText);
            throw new Error(`TikTok API returned non-JSON response with status ${response.status}`);
        }

        if (tokenData.error || tokenData.error_code || !response.ok) {
            const errorDescription = tokenData.error_description || tokenData.error || 'Failed to exchange code for TikTok token.';
            console.error("TikTok API Error:", errorDescription, tokenData);
            throw new Error(errorDescription);
        }

        await saveSystemCredentials({
            tiktokAccessToken: tokenData.access_token,
        });

        await logEvent('TIKTOK_AUTH_SUCCESS', 'Successfully exchanged code for TikTok API token.');
        return { success: true };

    } catch (error) {
        console.error("Error exchanging code for TikTok token:", error);
        await logEvent('TIKTOK_AUTH_FAILURE', `Failed to exchange code for token. Error: ${(error as Error).message}`);
        return { success: false, error: (error as Error).message };
    }
}
