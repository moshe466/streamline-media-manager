
import { NextResponse } from 'next/server';
import { cleanupExpiredSecureLinks } from '@/services/secure-links';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;

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
    const result = await cleanupExpiredSecureLinks();
    await logEvent('SECURE_LINKS_CLEANUP', `Cron job deleted ${result.deletedCount} expired secure links.`);
    return NextResponse.json({ success: true, ...result });

  } catch (error) {
    console.error('Error in secure links cleanup cron job:', error);
    await logEvent('SECURE_LINKS_CLEANUP_FAILURE', `Error during cleanup: ${(error as Error).message}`);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
