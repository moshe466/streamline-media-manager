import { getSystemCredentials } from '../src/services/users';

async function main() {
  const creds = await getSystemCredentials();

  console.log({
    hasTelegramWebhookSecret: !!(creds as any).telegramWebhookSecret,
    secretLength: (creds as any).telegramWebhookSecret
      ? String((creds as any).telegramWebhookSecret).length
      : 0,
  });
}

main().catch(console.error);
