
import { NextResponse } from 'next/server';
import { checkFlussonicStatus } from '@/services/flussonic';
import { getDb } from '@/lib/firebase-admin';
import { sendTelegramLogMessage } from '@/services/telegram';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const STATUS_DOC_REF = getDb().collection('system_status').doc('flussonic');

type FlussonicStatusRecord = {
  isUp: boolean;
  lastChecked: string;
  lastStatusChange: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const currentStatus = await checkFlussonicStatus();
    const now = new Date().toISOString();

    const statusDoc = await STATUS_DOC_REF.get();
    const previousStatus = statusDoc.exists ? (statusDoc.data() as FlussonicStatusRecord) : { isUp: true, lastStatusChange: now };

    const hasStatusChanged = currentStatus.success !== previousStatus.isUp;

    if (hasStatusChanged && !currentStatus.success) {
      // The server just went down
      const errorMessage = `🚨 <b>שרת מדיה נפל!</b> 🚨\n\nשרת Flussonic אינו מגיב. בדיקה אחרונה נכשלה.\nשגיאה: ${currentStatus.error || 'לא ידוע'}`;
      await sendTelegramLogMessage(errorMessage, 'onFlussonicDown');
      await logEvent('FLUSSONIC_DOWN_DETECTED', `Server is down. Error: ${currentStatus.error}`);
    }

    if (hasStatusChanged) {
        // Update the status and the time it changed
        await STATUS_DOC_REF.set({
            isUp: currentStatus.success,
            lastChecked: now,
            lastStatusChange: now,
        });
    } else {
        // Only update the last checked time
        await STATUS_DOC_REF.set({
            lastChecked: now,
        }, { merge: true });
    }

    return NextResponse.json({ 
        success: true, 
        status: currentStatus.success ? 'online' : 'offline', 
        statusChanged: hasStatusChanged 
    });
  } catch (error) {
    console.error('Error in Flussonic monitor cron job:', error);
    // Send a fallback alert if the check process itself fails critically
    await sendTelegramLogMessage(`🔥 <b>קריסה במנגנון הניטור!</b> 🔥\n\nתהליך בדיקת השרת נכשל עם שגיאה: ${(error as Error).message}`, 'onFlussonicDown');
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
