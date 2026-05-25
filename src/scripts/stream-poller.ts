import 'dotenv/config';
import fetch from 'node-fetch';

const URL = process.env.STREAM_MONITOR_URL || 'https://app.mizrachitv.co.il/api/cron/stream-monitor';
const SECRET = process.env.CRON_SECRET || '';

async function run() {
  try {
    const res = await fetch(URL, {
      headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {}
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(new Date().toISOString(), '❌ Poll non-JSON response:', text.slice(0, 300));
      return;
    }

    if (!res.ok) {
      console.error(new Date().toISOString(), '❌ Poll HTTP error:', res.status, data);
      return;
    }

    console.log(new Date().toISOString(), '✅ Poll result:', data);
  } catch (err) {
    console.error(new Date().toISOString(), '❌ Poll error:', err);
  }
}

run();
setInterval(run, 5 * 1000);
console.log('🚀 Stream poller started (every 5 seconds)');
