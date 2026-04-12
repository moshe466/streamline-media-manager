
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const SESSIONS_COLLECTION = 'active_sessions';
const STALE_THRESHOLD_MINUTES = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!CRON_SECRET) {
      console.error("CRON_SECRET is not set in environment variables. Denying access.");
      return NextResponse.json({ error: 'Cron secret not configured on server.' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const sessionsRef = db.collection(SESSIONS_COLLECTION);
    
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

    const staleSessionsSnapshot = await sessionsRef.where('lastSeen', '<', staleThreshold).get();

    if (staleSessionsSnapshot.empty) {
      console.log('Session cleanup cron: No stale sessions found.');
      return NextResponse.json({ success: true, deletedCount: 0, message: 'No stale sessions to clean up.' });
    }

    const batch = db.batch();
    staleSessionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    const deletedCount = staleSessionsSnapshot.size;
    console.log(`Session cleanup cron: Successfully deleted ${deletedCount} stale session(s).`);
    await logEvent('SESSION_CLEANUP_SUCCESS', `Deleted ${deletedCount} stale active sessions.`);

    return NextResponse.json({ success: true, deletedCount });

  } catch (error) {
    console.error('Error in session cleanup cron job:', error);
    await logEvent('SESSION_CLEANUP_FAILURE', `Error during session cleanup: ${(error as Error).message}`);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
