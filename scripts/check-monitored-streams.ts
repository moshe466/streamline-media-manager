import { getMonitoredStreams } from '../src/services/telegram-alerts';

async function main() {
  const streams = await getMonitoredStreams();

  console.log('count =', streams.length);
  console.log(streams);
}

main().catch(console.error);
