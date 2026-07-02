import { getSystemCredentials } from '../src/services/users';

async function main() {
  const creds = await getSystemCredentials();
  const token = creds.telegramBotToken;

  if (!token) throw new Error('No Telegram token');

  const url = 'https://app.mizrachitv.co.il/api/telegram-auth';

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log(JSON.stringify(await info.json(), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
