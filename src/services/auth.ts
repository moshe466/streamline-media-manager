
'use server';
import { getSystemCredentials, getUsers, type User, updateUserOtp, prepareNewUser } from './users';
import { getClients, type Client } from './clients';
import { getAllViewers, type Viewer } from './viewers';
import { getViewerById } from './viewers-auth';
import { isPast, parseISO } from 'date-fns';
import { handleActionError } from '@/lib/security-utils';
import { getDb } from '@/lib/firebase-admin';
import { sendVerificationEmail, sendApprovalAndSummaryEmail } from './email';
import { createPermissionRequestFromQuestionnaire } from './requests';
import { randomBytes } from 'crypto';
import { registerActiveSession, updateSessionHeartbeat } from './sessions';
import { FieldValue } from 'firebase-admin/firestore';
import { logEvent } from './logger';
import { checkRateLimit, clearRateLimit } from './security';

type VerificationResult = {
  success: boolean;
  role: 'super-admin' | 'admin' | 'editor' | 'client' | 'viewer' | 'broadcaster' | null;
  id: string | null;
  nickname: string | null;
  email: string | null;
  activeSessionId?: string | null;
  clientId?: string;
  client?: Client;
  error?: string;
};

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = email.toLowerCase();

    const rateCheck = await checkRateLimit(normalizedEmail, 'resend');
    if (!rateCheck.allowed) return { success: false, error: rateCheck.error };

    try {
        const db = getDb();

        const userDoc = await db.collection('users').doc(normalizedEmail).get();
        if (userDoc.exists) {
            const user = userDoc.data() as User;
            await updateUserOtp(user.id);
            return { success: true };
        }

        const clientDoc = await db.collection('clients').doc(normalizedEmail).get();
        if (clientDoc.exists) {
            const client = clientDoc.data() as Client;
            const portal = client.portalOrigin || 'standard';
            const emailResult = await sendVerificationEmail(client.email, client.firstName, portal);
            if (!emailResult.otpCode) {
                throw new Error(emailResult.error || 'Failed to generate new OTP for client.');
            }
            await clientDoc.ref.update({ otp: emailResult.otpCode });
            return { success: true };
        }

        const viewerDoc = await db.collection('viewers').doc(normalizedEmail).get();
        if (viewerDoc.exists) {
            const viewer = viewerDoc.data() as Viewer;
            const portal = viewer.portalOrigin || 'standard';
            const emailResult = await sendVerificationEmail(viewer.email, viewer.firstName, portal);
            if (!emailResult.otpCode) {
                throw new Error(emailResult.error || 'Failed to generate new OTP for viewer.');
            }
            await viewerDoc.ref.update({ otp: emailResult.otpCode });
            return { success: true };
        }

        return { success: false, error: 'לא נמצא משתמש עם כתובת המייל שהוזנה.' };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

export async function handleQuestionnaireSubmission(formData: any): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
        const db = getDb();
        const email = formData.email.toLowerCase();
        const clientRef = db.collection('clients').doc(email);
        const clientDoc = await clientRef.get();
        const emailExists = clientDoc.exists;

        const result = await createPermissionRequestFromQuestionnaire(
            formData,
            emailExists,
            clientDoc.data() as Client | undefined
        );

        return { success: true, requestId: result.requestId };
    } catch (error) {
        return { success: false, error: handleActionError(error) };
    }
}

const handleSuccessfulLogin = async (
    userRef: FirebaseFirestore.DocumentReference,
    userRole: VerificationResult['role'],
    userId: string,
    nickname: string,
    email: string
): Promise<string> => {
    if (!userRole) throw new Error("User role must be defined for a successful login.");

    const sessionId = `session_${Date.now()}_${randomBytes(8).toString('hex')}`;
    
    // Ensure the document exists before update
    const doc = await userRef.get();
    if (!doc.exists && (userRole === 'admin' || userRole === 'super-admin' || userRole === 'editor')) {
        await userRef.set({
            email: email.toLowerCase(),
            nickname: nickname,
            role: userRole,
            otp: '',
            activeSessionId: sessionId
        });
    } else {
        await userRef.update({ activeSessionId: sessionId });
    }

    await registerActiveSession({
        userId,
        role: userRole as any,
        sessionId,
        lastSeen: FieldValue.serverTimestamp(),
    });
    await clearRateLimit(email, 'login');
    await logEvent('LOGIN_SUCCESS', `משתמש התחבר: ${nickname} (${userRole})`);
    
    // Trigger notification if an admin role logs in
    if (['super-admin', 'admin', 'editor', 'client', 'viewer', 'broadcaster'].includes(userRole as string)) {
        try {
            const { notifyAdminLogin } = await import('./notifications');
            await notifyAdminLogin(nickname, userRole as string, email);
        } catch (e) {
            console.error("Failed to send login notification:", e);
        }
    }

    return sessionId;
};

export async function verifyBroadcastUser(username: string, password?: string): Promise<VerificationResult> {
    try {
        if (!password) {
            return { success: false, role: null, id: null, nickname: null, email: null, error: "סיסמה חסרה." };
        }

        const clientsRef = getDb().collection('clients');
        const snapshot = await clientsRef
            .where('webrtcUsername', '==', username)
            .where('webrtcPassword', '==', password)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { success: false, role: null, id: null, nickname: null, email: null, error: "שם משתמש או סיסמה שגויים." };
        }

        const clientDoc = snapshot.docs[0];
        const clientData = clientDoc.data() as Client;
        const sessionId = `broadcast_session_${Date.now()}_${randomBytes(8).toString('hex')}`;

        await clientDoc.ref.update({ broadcastSessionId: FieldValue.arrayUnion(sessionId) });
        await logEvent('LOGIN_SUCCESS', `משדר (Broadcaster) התחבר: ${clientData.nickname}`);
        try {
            const { notifyAdminLogin } = await import('./notifications');
            await notifyAdminLogin(clientData.nickname, 'broadcaster', clientData.email || '');
        } catch (e) {
            console.error('Failed to send broadcaster login notification:', e);
        }

        return {
            success: true,
            role: 'broadcaster',
            id: clientDoc.id,
            nickname: clientData.nickname,
            email: clientData.email,
            activeSessionId: sessionId,
        };
    } catch (error) {
        return { success: false, role: null, id: null, nickname: null, email: null, error: handleActionError(error) };
    }
}

export async function verifyUser(email: string, code: string): Promise<VerificationResult> {
    const normalizedEmail = email.toLowerCase();

    const rateCheck = await checkRateLimit(normalizedEmail, 'login');
    if (!rateCheck.allowed) {
        return { success: false, role: null, id: null, nickname: null, email: null, error: rateCheck.error };
    }

    try {
        const db = getDb();
        const systemCreds = await getSystemCredentials();
        const superAdminEmail = 'admin@mizrachitv.co.il';
        const superAdminPassword = systemCreds.superAdminPassword || '039279898';

        if (normalizedEmail === superAdminEmail.toLowerCase() && code === superAdminPassword) {
            const userRef = db.collection('users').doc(normalizedEmail);
            const superAdminDoc = await userRef.get();
            const userId = normalizedEmail; // Use normalizedEmail as ID
            const nickname = (superAdminDoc.data() as User)?.nickname || 'מנהל ראשי';
            const sessionId = await handleSuccessfulLogin(userRef, 'super-admin', userId, nickname, normalizedEmail);

            return {
                success: true,
                role: 'super-admin',
                id: userId,
                nickname,
                email: superAdminEmail,
                activeSessionId: sessionId,
            };
        }

        const collections = ['users', 'clients', 'viewers'];
        for (const coll of collections) {
            const q = await db
                .collection(coll)
                .where('email', '==', normalizedEmail)
                .where('otp', '==', code)
                .limit(1)
                .get();

            if (!q.empty) {
                const doc = q.docs[0];
                const data = doc.data();
                const role = data.role || (coll === 'clients' ? 'client' : 'viewer');
                const sessionId = await handleSuccessfulLogin(doc.ref, role, doc.id, data.nickname, normalizedEmail);

                return {
                    success: true,
                    role,
                    id: doc.id,
                    nickname: data.nickname,
                    email: data.email,
                    client: coll === 'clients' ? ({ ...data, id: doc.id } as Client) : undefined,
                    clientId: coll === 'viewers' ? data.clientId : undefined,
                    activeSessionId: sessionId,
                };
            }
        }

        return { success: false, role: null, id: null, nickname: null, email: null, error: "קוד אימות או אימייל שגויים." };
    } catch (error) {
        return { success: false, role: null, id: null, nickname: null, email: null, error: handleActionError(error) };
    }
}

export async function validateSession(userId: string, userRole: string, sessionId: string): Promise<{ isValid: boolean; reason?: string; }> {
    try {
        let collectionName: string;
        let sessionField = 'activeSessionId';

        switch (userRole) {
            case 'super-admin':
            case 'admin':
            case 'editor':
                collectionName = 'users';
                break;
            case 'client':
                collectionName = 'clients';
                break;
            case 'broadcaster':
                collectionName = 'clients';
                sessionField = 'broadcastSessionId';
                break;
            case 'viewer':
                collectionName = 'viewers';
                break;
            default:
                return { isValid: false, reason: 'תפקיד משתמש לא ידוע.' };
        }

        const docRef = getDb().collection(collectionName).doc(userId.toLowerCase());
        const doc = await docRef.get();

        if (!doc.exists) {
            return { isValid: false, reason: 'המשתמש לא נמצא.' };
        }

        const storedSessions = doc.data()?.[sessionField];
        const sessionIsValid = Array.isArray(storedSessions)
            ? storedSessions.includes(sessionId)
            : storedSessions === sessionId;

        if (!sessionIsValid) {
            return { isValid: false, reason: 'התחברת ממכשיר אחר. החיבור הנוכחי נסגר.' };
        }

        if (userRole !== 'broadcaster') {
            await updateSessionHeartbeat(userId, sessionId);
        }

        return { isValid: true };
    } catch (error) {
        return { isValid: false, reason: 'שגיאה באימות החיבור.' };
    }
}
