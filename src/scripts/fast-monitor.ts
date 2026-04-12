const MONITOR_URL = 'https://app.mizrachitv.co.il/api/cron/stream-monitor';
const SECRET = 'nzrjhnav039279898crbr7rjucushrv1';

async function run() {
  try {
    const res = await fetch(MONITOR_URL, {
      headers: {
        Authorization: `Bearer ${SECRET}`,
      },
    });

    const data = await res.json();

    if (data.detectedChanges > 0) {
      console.log('🔥 CHANGE DETECTED', new Date().toISOString(), data);
    }
  } catch (e) {
    console.error('ERROR', e);
  }
}

setInterval(run, 2000);
