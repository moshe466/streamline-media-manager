import 'dotenv/config';
import http from 'http';
import fetch from 'node-fetch';

const URL = process.env.LINKS_POLLER_URL || 'https://app.mizrachitv.co.il/api/cron/links-poller';
const SECRET = process.env.CRON_SECRET || '';
const POLL_INTERVAL_MS = Number(process.env.LINKS_POLLER_INTERVAL_MS || 5000);
const PORT = Number(process.env.PORT || 8080);

let lastRunAt: string | null = null;
let lastError: string | null = null;
let lastResult: any = null;

http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'links-poller',
      target: URL,
      lastRunAt,
      lastError,
      lastResult,
      uptime: process.uptime(),
    }));
  })
  .listen(PORT, () => {
    console.log(`✅ links-poller health server listening on ${PORT}`);
  });

async function run() {
  lastRunAt = new Date().toISOString();

  try {
    const res = await fetch(URL, {
      headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {},
    });

    const text = await res.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Non JSON response: ${text.slice(0, 300)}`);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    lastResult = data;
    lastError = null;

    console.log(new Date().toISOString(), '✅ Links poll result:', data);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.error(new Date().toISOString(), '❌ Links poll error:', lastError);
  }
}

run();
setInterval(run, POLL_INTERVAL_MS);

console.log(`🚀 Links poller started every ${POLL_INTERVAL_MS}ms`);
