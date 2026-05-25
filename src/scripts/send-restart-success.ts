import { sendTelegramMessage } from '@/services/telegram';

async function main() {
  const chatId = process.argv[2];
  const mode = process.argv[3] || 'success';

  if (!chatId) {
    console.error('Missing chatId');
    process.exit(1);
  }

  const text =
    mode === 'success'
      ? '✅ הדריסה וההפעלה מחדש הושלמו בהצלחה. כל השירותים עלו.'
      : '❌ הדריסה וההפעלה מחדש הסתיימו עם תקלה. בדוק את סטטוס המערכת והלוגים.';

  await sendTelegramMessage(chatId, text);
  console.log('Restart completion message sent to Telegram:', { chatId, mode });
}

main().catch((err) => {
  console.error('Failed to send restart completion message:', err);
  process.exit(1);
});
