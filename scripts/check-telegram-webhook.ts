import { getSystemCredentials } from '../src/services/users';

async function main() {
  const creds = await getSystemCredentials();
  const token = creds.telegramBotToken;

  if (!token) {
    console.log('No Telegram token');
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await res.json();

  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
