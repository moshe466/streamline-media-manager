import fetch from 'node-fetch';

const URL = process.env.STREAM_MONITOR_URL || 'https://app.mizrachitv.co.il/api/cron/stream-monitor';
const SECRET = process.env.CRON_SECRET || '7a94b0efddbf6930cdf27abc6ec7a77110e12e36b7c8beecd2445edb77543be4';

async function run() {
    try {
        const res = await fetch(URL, {
            headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {}
        });

        const data = await res.json();
        console.log(new Date().toISOString(), '✅ Poll result:', data);
    } catch (err) {
        console.error(new Date().toISOString(), '❌ Poll error:', err);
    }
}

setInterval(run, 5 * 1000);

console.log('🚀 Stream poller started (every 10 seconds)');
