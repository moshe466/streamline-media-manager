
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';

export type AuthContext = {
    userId: string;
    sessionId: string;
};

/**
 * Validates that the caller has a valid, active session.
 * Throws an error if validation fails.
 */
export async function validateActionCaller(context: AuthContext, requiredRole?: string[]): Promise<any> {
    const { userId, sessionId } = context;
    if (!userId || !sessionId) {
        throw new Error('Authentication context missing.');
    }

    const db = getDb();
    // Check across all potential user collections
    const collections = ['users', 'clients', 'viewers'];
    let userData: any = null;
    let userRole: string = '';

    for (const collection of collections) {
        const doc = await db.collection(collection).doc(userId.toLowerCase()).get();
        if (doc.exists) {
            userData = doc.data();
            userRole = userData.role || (collection === 'clients' ? 'client' : 'viewer');
            break;
        }
    }

    if (!userData) {
        throw new Error('User not found.');
    }

    // Verify Session ID
    const storedSessions = userData.activeSessionId || userData.broadcastSessionId;
    const sessionIsValid = Array.isArray(storedSessions) 
        ? storedSessions.includes(sessionId) 
        : storedSessions === sessionId;

    if (!sessionIsValid) {
        await logEvent('SECURITY_VIOLATION', `Invalid session attempt by user ${userId}`);
        throw new Error('Invalid or expired session.');
    }

    // Verify Role if required
    if (requiredRole && !requiredRole.includes(userRole)) {
        await logEvent('SECURITY_VIOLATION', `Unauthorized role access attempt by ${userId} (Role: ${userRole})`);
        throw new Error('Unauthorized access.');
    }

    return { ...userData, id: userId, role: userRole };
}

/**
 * Ensures that a client or viewer only accesses resources they own.
 */
export async function verifyOwnership(context: AuthContext, targetId: string) {
    if (context.userId.toLowerCase() !== targetId.toLowerCase()) {
        const caller = await validateActionCaller(context);
        // Admins can bypass ownership checks
        if (caller.role === 'admin' || caller.role === 'super-admin') return;
        
        await logEvent('SECURITY_VIOLATION', `Ownership bypass attempt: User ${context.userId} tried to access ${targetId}`);
        throw new Error('Access denied: You do not own this resource.');
    }
}

/**
 * Implementation of Rate Limiting for Auth attempts.
 */
export async function checkRateLimit(email: string, action: 'login' | 'resend'): Promise<{ allowed: boolean; error?: string }> {
    const db = getDb();
    const normalizedEmail = email.toLowerCase();
    const limitDoc = await db.collection('auth_limits').doc(`${normalizedEmail}_${action}`).get();
    const now = Date.now();

    if (limitDoc.exists) {
        const data = limitDoc.data();
        const cooldownTime = action === 'login' ? 15 * 60 * 1000 : 2 * 60 * 1000; // 15m for login, 2m for resend
        
        if (data && data.attempts >= 5 && (now - data.lastAttempt < cooldownTime)) {
            const remaining = Math.ceil((cooldownTime - (now - data.lastAttempt)) / 60000);
            return { 
                allowed: false, 
                error: `יותר מדי ניסיונות. אנא נסה שוב בעוד ${remaining} דקות.` 
            };
        }

        // Reset if cooldown passed
        if (data && now - data.lastAttempt > cooldownTime) {
            await limitDoc.ref.set({ attempts: 1, lastAttempt: now });
        } else {
            await limitDoc.ref.update({ attempts: (data?.attempts || 0) + 1, lastAttempt: now });
        }
    } else {
        await db.collection('auth_limits').doc(`${normalizedEmail}_${action}`).set({ attempts: 1, lastAttempt: now });
    }

    return { allowed: true };
}

export async function clearRateLimit(email: string, action: 'login' | 'resend') {
    await getDb().collection('auth_limits').doc(`${email.toLowerCase()}_${action}`).delete();
}

