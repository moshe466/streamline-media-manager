'use server';

import { getDb } from '@/lib/firebase-admin';

export async function testFirestoreConnection() {
  try {
    const db = getDb();
    const docRef = db.collection('test').doc('connection-check');
    await docRef.set({ timestamp: new Date().toISOString() });

    const snapshot = await docRef.get();
    const data = snapshot.data();

    console.log('✅ חיבור למסד נתונים הצליח!', data);
    return data;
  } catch (error) {
    console.error('❌ שגיאה בגישה ל-Firestore:', error);
    return null;
  }
}
