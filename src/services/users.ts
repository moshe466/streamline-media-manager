
'use server';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { validateActionCaller, AuthContext } from './security';

// We import this dynamically in auth logic, but we can have the logic here to break cycles
import { sendVerificationEmail } from './email';

const getUsersCollection = () => getDb().collection('users');
const getSettingsCollection = () => getDb().collection('settings');
const getArchiveCollection = () => getDb().collection('deleted_archive');

export type UserPermissions = {
    canAccessUsers?: boolean;
    canAccessBackup?: boolean;
};

export type AdminNotificationSettings = {
    onNewQuestionnaire?: boolean;
    onClientRenewalRequest?: boolean;
    onFlussonicDown?: boolean;
    onStreamStatusChange?: boolean;
    onDvrStatusChange?: boolean;
    onStreamCreated?: boolean;
    onStreamDeleted?: boolean;
    onPushAdded?: boolean;
    onBackupSuccess?: boolean;
    onViewerCreated?: boolean;
    onHourlyStatusReport?: boolean;
    onSecureLinkCreated?: boolean;
    onAdminLogin?: boolean;
};

export type MultiviewSettings = {
    selectedStreams: string[];
    gridColumns: number;
};

export type User = {
    id: string;
    email: string;
    role: 'super-admin' | 'admin' | 'editor';
    nickname: string;
    otp: string;
    permissions?: UserPermissions;
    adminNotificationSettings?: AdminNotificationSettings;
    telegramChatId?: string;
    activeSessionId?: string;
    multiviewSettings?: MultiviewSettings;
};

export type FlussonicServerConfig = {
    flussonicServerName: string;
    flussonicHost: string;
    flussonicUsername: string;
    flussonicPassword?: string;
}

export type SocialPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'telegram';

/**
 * Prepares a new user by checking existence across collections and sending an OTP.
 * This is moved here to break circular dependencies between auth and clients.
 */
export async function prepareNewUser(email: string, name: string, portal: 'uh' | 'standard' = 'standard'): Promise<string> {
    const normalizedEmail = email.toLowerCase();
    const db = getDb();
    
    const [u, c, v] = await Promise.all([
        db.collection('users').doc(normalizedEmail).get(),
        db.collection('clients').doc(normalizedEmail).get(),
        db.collection('viewers').doc(normalizedEmail).get(),
    ]);

    if (u.exists || c.exists || v.exists) {
        throw new Error('משתמש עם כתובת מייל זו כבר קיים במערכת.');
    }

    const emailResult = await sendVerificationEmail(email, name, portal);
    if (emailResult.otpCode) return emailResult.otpCode;

    throw new Error(emailResult.error || 'Failed to generate and send OTP.');
}

export async function getUsers(auth: AuthContext): Promise<User[]> {
    try {
        await validateActionCaller(auth, ['admin', 'super-admin', 'editor']);
        const snapshot = await getUsersCollection().get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error: any) {
         if (error.code === 5) {
            return [];
        }
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function getUserById(userId: string): Promise<User | null> {
    try {
        const doc = await getUsersCollection().doc(userId.toLowerCase()).get();
        if (!doc.exists) {
            return null;
        }
        return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return null;
    }
}

export async function addUser(auth: AuthContext, userData: Pick<User, 'nickname' | 'email' | 'role'>) {
    await validateActionCaller(auth, ['admin', 'super-admin']);
    const otpCode = await prepareNewUser(userData.email, userData.nickname);
    
    const usersRef = getUsersCollection();
    const userDocRef = usersRef.doc(userData.email.toLowerCase());

    const newUser: Omit<User, 'id'> = {
        otp: otpCode,
        ...userData,
        email: userData.email.toLowerCase(),
        permissions: {},
        adminNotificationSettings: {},
    };
    
    await userDocRef.set(newUser);
    return { ...newUser, id: userDocRef.id };
}


export async function updateUser(userId: string, updates: Partial<Pick<User, 'nickname' | 'role' | 'adminNotificationSettings' | 'telegramChatId' | 'multiviewSettings'>>) {
    try {
        const userRef = getUsersCollection().doc(userId.toLowerCase());
        await userRef.update(updates);
        const updatedDoc = await userRef.get();
        return { id: updatedDoc.id, ...updatedDoc.data() } as User;
    } catch (error) {
        console.error("Update user failed:", error);
        throw error;
    }
}

export async function updateUserPermissions(auth: AuthContext, userId: string, permissions: UserPermissions): Promise<void> {
    await validateActionCaller(auth, ['admin', 'super-admin']);
    const userRef = getUsersCollection().doc(userId.toLowerCase());
    await userRef.update({ permissions });
}

export async function deleteUser(auth: AuthContext, userId: string): Promise<{ success: boolean }> {
    await validateActionCaller(auth, ['super-admin']);
    const userRef = getUsersCollection().doc(userId.toLowerCase());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        console.warn(`User with ID ${userId} not found for deletion.`);
        return { success: false };
    }

    const userData = userDoc.data() as User;
    
    const archiveRef = getArchiveCollection().doc();
    const archiveData = {
        originalId: userId,
        originalCollection: 'users',
        deletedAt: new Date().toISOString(),
        data: userData,
    };
    
    const batch = getDb().batch();
    batch.set(archiveRef, archiveData);
    batch.delete(userRef);
    
    await batch.commit();

    return { success: true };
}


export async function updateUserOtp(userId: string): Promise<User> {
    const userRef = getUsersCollection().doc(userId.toLowerCase());
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new Error('User not found.');
    }
    
    const user = userDoc.data() as User;
    
    const emailResult = await sendVerificationEmail(user.email, user.nickname);
    
    if (!emailResult.otpCode) {
        throw new Error(emailResult.error || "Failed to generate new OTP code.");
    }

    await userRef.update({ otp: emailResult.otpCode });
    
    return { ...user, id: userId, otp: emailResult.otpCode };
}


export async function getSystemCredentials(): Promise<{
    superAdminPassword?: string, 
    morningApiKey?: string, 
    morningApiSecret?: string,
    flussonicServerName?: string,
    flussonicHost?: string,
    flussonicUsername?: string,
    flussonicPassword?: string,
    flussonicPublicHost?: string,
    flussonicServers?: FlussonicServerConfig[],
    googleClientId?: string,
    googleClientSecret?: string,
    youtubeClientId?: string,
    youtubeClientSecret?: string,
    youtubeSelectedChannelId?: string,
    facebookClientId?: string,
    facebookClientSecret?: string,
    facebookAccessToken?: string,
    instagramClientId?: string,
    instagramClientSecret?: string,
    tiktokClientId?: string,
    tiktokClientSecret?: string,
    tiktokAccessToken?: string,
    twitterClientId?: string,
    twitterClientSecret?: string,
    twitterAccessToken?: string,
    twitterRefreshToken?: string,
    telegramBotToken?: string,
}> {
    try {
        const doc = await getSettingsCollection().doc('credentials').get();
        if (doc.exists) {
            return doc.data() as any;
        }
        return {};
    } catch (error: any) {
        if (error.code === 5) {
            return {};
        }
        console.error("Error fetching system credentials from Firestore:", error);
        return {};
    }
}

export async function saveSystemCredentials(creds: {
    superAdminPassword?: string, 
    morningApiKey?: string, 
    morningApiSecret?: string,
    flussonicServerName?: string,
    flussonicHost?: string,
    flussonicUsername?: string,
    flussonicPassword?: string,
    flussonicPublicHost?: string,
    googleClientId?: string,
    googleClientSecret?: string,
    youtubeClientId?: string,
    youtubeClientSecret?: string,
    youtubeSelectedChannelId?: string,
    facebookClientId?: string,
    facebookClientSecret?: string,
    facebookAccessToken?: string,
    instagramClientId?: string,
    instagramClientSecret?: string,
    tiktokClientId?: string,
    tiktokClientSecret?: string,
    tiktokAccessToken?: string,
    twitterClientId?: string,
    twitterClientSecret?: string,
    twitterAccessToken?: string,
    twitterRefreshToken?: string,
    telegramBotToken?: string,
}): Promise<void> {
    const credentialsToSave: any = {};
    const keys: (keyof typeof creds)[] = [
        'superAdminPassword', 
        'morningApiKey', 
        'morningApiSecret',
        'flussonicServerName',
        'flussonicHost',
        'flussonicUsername',
        'flussonicPassword',
        'flussonicPublicHost',
        'googleClientId',
        'googleClientSecret',
        'youtubeClientId',
        'youtubeClientSecret',
        'youtubeSelectedChannelId',
        'facebookClientId',
        'facebookClientSecret',
        'facebookAccessToken',
        'instagramClientId',
        'instagramClientSecret',
        'tiktokClientId',
        'tiktokClientSecret',
        'tiktokAccessToken',
        'twitterClientId',
        'twitterClientSecret',
        'twitterAccessToken',
        'twitterRefreshToken',
        'telegramBotToken',
    ];
    
    for (const key of keys) {
        if (creds[key] !== undefined) {
            credentialsToSave[key] = creds[key];
        }
    }

    if (Object.keys(credentialsToSave).length > 0) {
        await getSettingsCollection().doc('credentials').set(credentialsToSave, { merge: true });
    }
}

export async function disconnectSocialPlatform(platform: SocialPlatform): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = getSettingsCollection().doc('credentials');
        const updateData: { [key: string]: any } = {};

        switch (platform) {
            case 'youtube':
                updateData.youtubeSelectedChannelId = FieldValue.delete();
                updateData.googleClientId = FieldValue.delete();
                updateData.googleClientSecret = FieldValue.delete();
                break;
            case 'facebook':
                updateData.facebookAccessToken = FieldValue.delete();
                break;
            case 'instagram':
                updateData.facebookAccessToken = FieldValue.delete();
                break;
            case 'tiktok':
                updateData.tiktokAccessToken = FieldValue.delete();
                break;
            case 'twitter':
                updateData.twitterAccessToken = FieldValue.delete();
                updateData.twitterRefreshToken = FieldValue.delete();
                break;
             case 'telegram':
                updateData.telegramBotToken = FieldValue.delete();
                break;
            default:
                return { success: false, error: 'Unsupported platform for disconnection.' };
        }

        await docRef.update(updateData);
        return { success: true };
    } catch (error) {
        console.error(`Error disconnecting ${platform}:`, error);
        return { success: false, error: (error as Error).message };
    }
}
