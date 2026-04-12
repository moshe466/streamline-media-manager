'use server';

import { getDb } from '@/lib/firebase-admin';

export async function testFirestoreConnection() {
  try {
    const db = getDb();
    const docRef = db.collection('debug-test').doc('connection-check');
    await docRef.set({ timestamp: new Date().toISOString(), status: 'ok' });

    const snapshot = await docRef.get();
    const data = snapshot.data();

    await docRef.delete(); // Clean up the test document

    console.log('✅ Firestore connection test successful!', data);
    return {
      success: true,
      message: 'Connection successful. Wrote and read document from "debug-test" collection.',
      data: data
    };
  } catch (error: any) {
    console.error('❌ Firestore connection test failed:', error);

    // Check if this is the specific "NOT_FOUND" error
    if (error.code === 5 || (error.message && error.message.includes('NOT_FOUND'))) {
       return {
        success: false,
        error: 'Firestore database not found or not enabled.',
        details: "The application connected to Google, but the Firestore service for project 'streamline-media-manager' is not active. Please go to the Firebase Console, select your project, navigate to 'Firestore Database' and click 'Create database' to enable it.",
        resolution: 'Enable Firestore in the Firebase Console.'
      };
    }

    // For any other errors
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace available.';
    return {
      success: false,
      error: errorMessage,
      stack: errorStack,
    };
  }
}
