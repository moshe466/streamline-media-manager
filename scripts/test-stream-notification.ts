import { notifyStreamOnline, notifyStreamOffline } from '../src/services/notifications';

async function main() {
  await notifyStreamOnline('TEST_WAKE_TELEGRAM', 'בדיקת מערכת');
  await notifyStreamOffline('TEST_WAKE_TELEGRAM', 'בדיקת מערכת');
  console.log('stream notifications sent');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
