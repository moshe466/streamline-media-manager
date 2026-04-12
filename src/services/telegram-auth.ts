

'use server';

import { getDb } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

const getTelegramAuthCollection = () => getDb().collection('telegram_auth_codes');

type AuthCodeDetails = {
  userId: string;
  userRole: 'client' | 'viewer' | 'admin' | 'editor' | 'super-admin';
  expiresAt: Date;
};

/**
 * Generates a unique, temporary authentication code for linking a user to a Telegram chat.
 * @param userId - The ID of the user (client, viewer, etc.).
 * @param userRole - The role of the user.
 * @returns The generated code.
 */
export async function generateTelegramAuthCode(userId: string, userRole: AuthCodeDetails['userRole']): Promise<{ code: string }> {
  try {
    const code = randomBytes(16).toString('hex');
    const docRef = getTelegramAuthCollection().doc(code);
    
    const authDetails: AuthCodeDetails = {
      userId,
      userRole,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // Expires in 10 minutes
    };

    await docRef.set(authDetails);
    
    console.log(`Generated Telegram auth code for ${userRole} ${userId}`);
    return { code };
  } catch (error) {
    console.error('Failed to generate Telegram auth code:', error);
    throw new Error('Could not generate Telegram auth code.');
  }
}

/**
 * Retrieves the details associated with an auth code and deletes it to ensure single use.
 * @param code - The authentication code from the bot's start parameter.
 * @returns The user details or null if the code is invalid or expired.
 */
export async function getAuthCodeDetails(code: string): Promise<Omit<AuthCodeDetails, 'expiresAt'> | null> {
    try {
        const docRef = getTelegramAuthCollection().doc(code);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.warn(`Telegram auth code not found: ${code}`);
            return null;
        }

        const data = doc.data() as AuthCodeDetails;
        
        // Immediately delete the code to prevent reuse
        await docRef.delete();

        // Check for expiry
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
            console.warn(`Telegram auth code ${code} has expired.`);
            return null;
        }

        const { userId, userRole } = data;
        return { userId, userRole };

    } catch (error) {
        console.error(`Error validating Telegram auth code ${code}:`, error);
        return null;
    }
}
