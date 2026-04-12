

'use server';

import { getDb } from '@/lib/firebase-admin';

const getPkceCollection = () => getDb().collection('pkce_challenges');

export async function savePkceChallenge(state: string, codeVerifier: string): Promise<void> {
    const docRef = getPkceCollection().doc(state);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes
    await docRef.set({ codeVerifier, createdAt: new Date().toISOString(), expires });
}


export async function loadPkceVerifier(state: string): Promise<string | null> {
    const docRef = getPkceCollection().doc(state);
    const doc = await docRef.get();
    if (!doc.exists) {
        return null;
    }
    await docRef.delete();
    const data = doc.data();

    // Firestore timestamps are objects, need to convert to JS Date
    if (data?.expires && data.expires.toDate() < new Date()) {
        console.warn(`PKCE challenge for state ${state} has expired.`);
        return null;
    }

    return data?.codeVerifier || null;
}
