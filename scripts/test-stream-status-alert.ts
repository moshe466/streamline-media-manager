import { notifyStreamOnline, notifyStreamOffline } from '../src/services/notifications';

async function main() {
  await notifyStreamOnline('TEST_STATUS_ALERT', 'בדיקת שינוי סטטוס');
  await notifyStreamOffline('TEST_STATUS_ALERT', 'בדיקת שינוי סטטוס');
  console.log('status alert test sent');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
