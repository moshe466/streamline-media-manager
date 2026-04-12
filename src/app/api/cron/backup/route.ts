
import { NextResponse } from 'next/server';
import { runAutomatedBackup } from '@/services/backup';

// This is the cron job secret. It must be set in your environment variables.
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
    const result = await runAutomatedBackup();
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, message: result.message, error: result.error }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
