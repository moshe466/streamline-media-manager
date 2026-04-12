
'use server';

import admin from 'firebase-admin';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const getSessionsCollection = () => getDb().collection('active_sessions');

export type ActiveSession = {
    userId: string;
    role: 'super-admin' | 'admin' | 'editor' | 'client' | 'viewer';
    lastSeen: FieldValue;
    sessionId: string;
};

export type ActiveSessionWithDetails = Omit<ActiveSession, 'lastSeen'> & {
    nickname: string;
    email: string;
    lastSeen: string;
};

/**
 * Creates or updates an active session document in Firestore.
 */
export async function registerActiveSession(session: ActiveSession): Promise<void> {
    try {
        const sessionRef = getSessionsCollection().doc(session.userId);
        await sessionRef.set({
            ...session,
            lastSeen: FieldValue.serverTimestamp(), 
        });
    } catch (error) {
        console.error(`Failed to register active session for user ${session.userId}:`, error);
    }
}

/**
 * Removes a session document from Firestore.
 */
export async function removeActiveSession(userId: string): Promise<void> {
    try {
        await getSessionsCollection().doc(userId).delete();
    } catch (error) {
        console.error(`Failed to remove active session for user ${userId}:`, error);
    }
}

/**
 * Updates the 'lastSeen' timestamp for a user's session.
 */
export async function updateSessionHeartbeat(userId: string, sessionId: string): Promise<void> {
    try {
        const sessionRef = getSessionsCollection().doc(userId);
        const doc = await sessionRef.get();
        if (doc.exists && doc.data()?.sessionId === sessionId) {
             await sessionRef.update({ lastSeen: FieldValue.serverTimestamp() });
        }
    } catch (error) {
        // Heartbeat failure is non-critical
    }
}

/**
 * Counts active sessions, optionally grouped by role.
 */
export async function getActiveSessionsCount(groupByRole = false): Promise<number | Record<string, number>> {
    try {
        const snapshot = await getSessionsCollection().get();
        if (!groupByRole) {
            return snapshot.size;
        }

        const counts: Record<string, number> = {
            admin: 0,
            editor: 0,
            client: 0,
            viewer: 0,
        };

        snapshot.forEach(doc => {
            const data = doc.data() as Omit<ActiveSession, 'lastSeen'> & { lastSeen: admin.firestore.Timestamp };
            const role = data.role === 'super-admin' ? 'admin' : data.role;
            if (counts[role] !== undefined) {
                counts[role]++;
            }
        });

        return counts;

    } catch (error) {
        console.error('Error fetching active sessions count:', error);
        if (groupByRole) return { admin: 0, editor: 0, client: 0, viewer: 0 };
        return 0;
    }
}


/**
 * Retrieves all active session documents and enriches them with user details.
 */
export async function getActiveSessions(): Promise<ActiveSessionWithDetails[]> {
    try {
        const sessionsSnapshot = await getSessionsCollection().get();
        if (sessionsSnapshot.empty) {
            return [];
        }

        const detailedSessions: ActiveSessionWithDetails[] = [];

        for (const sessionDoc of sessionsSnapshot.docs) {
            const sessionData = sessionDoc.data() as Omit<ActiveSession, 'lastSeen'> & { lastSeen: admin.firestore.Timestamp };
            
            let collectionName: string;
            switch(sessionData.role) {
                 case 'super-admin':
                 case 'admin':
                 case 'editor':
                    collectionName = 'users';
                    break;
                case 'client':
                    collectionName = 'clients';
                    break;
                case 'viewer':
                    collectionName = 'viewers';
                    break;
                default:
                    continue; 
            }
            
            const userDoc = await getDb().collection(collectionName).doc(sessionData.userId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                detailedSessions.push({
                    userId: sessionData.userId,
                    role: sessionData.role,
                    sessionId: sessionData.sessionId,
                    nickname: userData?.nickname || 'Unknown User',
                    email: userData?.email || 'Unknown Email',
                    lastSeen: sessionData.lastSeen.toDate().toISOString(),
                });
            }
        }
        
        detailedSessions.sort((a, b) => a.nickname.localeCompare(b.nickname));
        return detailedSessions;
    } catch (error) {
        console.error("Error fetching detailed active sessions:", error);
        return [];
    }
}
