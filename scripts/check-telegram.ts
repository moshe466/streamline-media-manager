import { getSystemCredentials } from '../src/services/users';

async function main() {
  const creds = await getSystemCredentials();

  console.log({
    hasTelegramBotToken: !!creds.telegramBotToken,
    tokenLength: creds.telegramBotToken ? creds.telegramBotToken.length : 0,
  });
}

main().catch(console.error);
