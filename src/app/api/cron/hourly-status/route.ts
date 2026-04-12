
import { NextResponse } from 'next/server';
import { getStreams } from '@/services/flussonic';
import { testFirestoreConnectionAction } from '@/actions/test-firestore-action';
import { sendTelegramLogMessage } from '@/services/telegram';
import { logEvent } from '@/services/logger';

const CRON_SECRET = process.env.CRON_SECRET;

function escapeHtml(s: string): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!CRON_SECRET) {
      console.error("CRON_SECRET is not set in environment variables. Denying access.");
      return NextResponse.json({ error: 'Cron secret not configured on server.' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  await logEvent('HOURLY_STATUS_CRON_START', 'Hourly status report cron job started.');

  try {
    const [streams, dbStatus] = await Promise.all([
        getStreams(),
        testFirestoreConnectionAction()
    ]);
    
    const activeStreams = streams.filter(s => s.status === 'online').length;
    const offlineStreams = streams.length - activeStreams;

    const serverStatusText = streams ? '✅ תקין' : '❌ תקלה';
    const dbStatusText = dbStatus.success ? '✅ תקין' : '❌ תקלה';
    const appStatusText = '✅ תקינה';
    
    const message = [
        '📊 <b>דוח סטטוס מערכת שעתי</b> 📊',
        '-----------------------------------',
        `🖥️ <b>שרת מדיה:</b> ${serverStatusText}`,
        `📂 <b>מסד נתונים:</b> ${dbStatusText}`,
        `📱 <b>אפליקציה:</b> ${appStatusText}`,
        '-----------------------------------',
        `🟢 <b>שידורים פעילים:</b> ${activeStreams}`,
        `⚫️ <b>שידורים לא פעילים:</b> ${offlineStreams}`,
    ].join('\n');
    
    await sendTelegramLogMessage(message, 'onHourlyStatusReport', 'HTML');

    return NextResponse.json({ success: true, message: 'Hourly status report sent.' });

  } catch (error) {
    console.error('Error in hourly status cron job:', error);
    await logEvent('HOURLY_STATUS_CRON_FAILURE', `Error during hourly status report: ${(error as Error).message}`);
    
    // Send a failure message to the monitoring channel
    const errorMessage = `🔥 <b>שגיאה בדוח סטטוס שעתי!</b> 🔥\n\nתהליך יצירת הדוח נכשל עם שגיאה: ${escapeHtml((error as Error).message)}`;
    await sendTelegramLogMessage(errorMessage, undefined, 'HTML'); // Send to default monitoring group

    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
