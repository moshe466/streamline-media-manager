import { sendTelegramMessage } from '../src/services/telegram';
import { MONITORING_CHAT_ID } from '../src/lib/telegram-config';

async function main() {
  await sendTelegramMessage(
    MONITORING_CHAT_ID,
    '✅ בדיקת טלגרם מהסטודיו - הבוט פעיל'
  );

  console.log('telegram test sent');
}

main().catch((err) => {
  console.error('telegram test failed:', err);
  process.exit(1);
});
