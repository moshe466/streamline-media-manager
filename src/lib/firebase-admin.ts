'use server-only';

import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// הימנעות מהאתחול הכפול בסביבת dev/HMR
declare global {
  // eslint-disable-next-line no-var
  var __ADMIN_APP__: admin.app.App | undefined;
}

function initAdminIfNeeded(): admin.app.App | undefined {
  if (global.__ADMIN_APP__) return global.__ADMIN_APP__;
  if (admin.apps.length) {
    global.__ADMIN_APP__ = admin.app();
    return global.__ADMIN_APP__;
  }

  try {
    const projectId   = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey?.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      // קרדנציאלס מפורשים (לוקאל/דב)
      global.__ADMIN_APP__ = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
      console.log('✅ Initialized Firebase Admin with explicit credentials.');
      return global.__ADMIN_APP__;
    }

    // בררת מחדל – ADC (עובד ב־Firebase App Hosting/Cloud Run ללא מפתח פרטי)
    console.log('Attempting to initialize Firebase Admin with Application Default Credentials...');
    global.__ADMIN_APP__ = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✅ Initialized Firebase Admin with Application Default Credentials.');
    return global.__ADMIN_APP__;
  } catch (e) {
    console.error('Firebase Admin init failed (will defer error to first use):', e);
    return undefined; // לא מפילים את ה־SSR/‏build
  }
}

// נקודות גישה "בטוחות" – זורקות רק כשבאמת חייבים עכשיו Admin
export function getDb(): admin.firestore.Firestore {
  const app = initAdminIfNeeded();
  if (!app) throw new Error('Firebase Admin is not initialized (no credentials available).');
  return admin.firestore(app);
}

export function getAuth(): admin.auth.Auth {
  const app = initAdminIfNeeded();
  if (!app) throw new Error('Firebase Admin is not initialized (no credentials available).');
  return admin.auth(app);
}

export function getAdminStorage(): admin.storage.Storage {
    const app = initAdminIfNeeded();
    if (!app) throw new Error('Firebase Admin is not initialized (no credentials available).');
    return admin.storage(app);
}

// במידה וקוד קיים מצפה לפונקציה בשם initializeFirebaseAdmin – נחזיר boolean במקום לזרוק
export function initializeFirebaseAdmin(): boolean {
  return !!initAdminIfNeeded();
}
