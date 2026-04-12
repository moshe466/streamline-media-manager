
'use server';

/**
 * Low-level Telegram Sender Service.
 * Does not import flussonic, clients, or other business services to prevent circular dependencies.
 * This service handles the raw communication with the Telegram API.
 */

import { getSystemCredentials } from './users';
import { logEvent } from './logger';
import { getDb } from '@/lib/firebase-admin';
import { MONITORING_CHAT_ID, PILOT_ALERTS_GROUP_ID, LINKS_GROUP_CHAT_ID, LOGIN_SUCCESS_CHAT_ID } from '@/lib/telegram-config';
import { generateTelegramAuthCode } from './telegram-auth';

/**
 * Generic function to send a message to a specific chat.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: Partial<{ parse_mode: 'HTML' | 'MarkdownV2', disable_web_page_preview?: boolean, reply_markup?: any }> = { parse_mode: 'HTML', disable_web_page_preview: true }
) {
  try {
    const credentials = await getSystemCredentials();
    const token = credentials.telegramBotToken;
    if (!token) {
        console.warn("Telegram Bot Token is not configured. Message not sent.");
        return;
    }
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parse_mode,
        disable_web_page_preview: opts.disable_web_page_preview ?? true,
        reply_markup: opts.reply_markup,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return data;
  } catch (err) {
    console.error('sendTelegramMessage error:', err);
    await logEvent('TELEGRAM_SEND_FAILURE', `sendMessage to ${chatId} failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Sends a message with a button to share phone number.
 */
export async function sendTelegramMessageWithPhoneKeyboard(chatId: number | string, text: string) {
  const credentials = await getSystemCredentials();
  const token = credentials.telegramBotToken;
  if (!token) return;
  
  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        keyboard: [[{ text: '📱 שתף מספר טלפון', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
}

/**
 * Sends log messages to administrative chats based on notification settings.
 */
export async function sendTelegramLogMessage(text: string, settingKey?: string, parseMode: 'HTML' | 'MarkdownV2' = 'HTML'): Promise<void> {
    const db = getDb();
    
    if (!settingKey) {
        // Default monitoring group
        await sendTelegramMessage(MONITORING_CHAT_ID, text, { parse_mode: parseMode });
    } else {
        // Query users who have this specific notification enabled
        const allAdminsSnapshot = await db.collection('users')
            .where(`adminNotificationSettings.${settingKey}`, '==', true)
            .get();
        
        if (allAdminsSnapshot.empty) return;

        for (const adminDoc of allAdminsSnapshot.docs) {
            const admin = adminDoc.data();
            const adminChatId = admin.telegramChatId; 
            if (adminChatId) {
                 try {
                    await sendTelegramMessage(adminChatId, text, { parse_mode: parseMode });
                } catch(err) {
                    console.error('Telegram send log failed for admin', adminDoc.id);
                }
            }
        }
    }
}

/**
 * Generates an authentication link for the Telegram bot.
 */
export async function generateTelegramAuthLink(userId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const { code } = await generateTelegramAuthCode(userId, 'admin'); 
        const url = `https://t.me/${(await import('@/lib/telegram-config')).BOT_USERNAME}?start=${code}`;
        return { success: true, url };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

// Session management for the bot conversation
export async function getSession(chatId: number) {
    const db = getDb();
    const doc = await db.collection('telegram_sessions').doc(String(chatId)).get();
    return doc.exists ? doc.data() : null;
}

export async function createOrUpdateSession(chatId: number, data: any) {
    const db = getDb();
    await db.collection('telegram_sessions').doc(String(chatId)).set(data, { merge: true });
}

export async function deleteSession(chatId: number) {
    const db = getDb();
    await db.collection('telegram_sessions').doc(String(chatId)).delete();
}

export async function notifyStreamOnline(streamName: string, clientNickname?: string) {
  await sendTelegramLogMessage(`✅ השידור ${streamName} עלה לאוויר`);
}

export async function notifyStreamOffline(streamName: string, clientNickname?: string) {
  await sendTelegramLogMessage(`⛔ השידור ${streamName} ירד מהאוויר`);
}


export async function notifyAdminOnSecureLinkCreated(streamName: string, actorName: string, linkId: string, appHost?: string) {
  await sendTelegramLogMessage(`🔗 ${actorName} יצר קישור לשידור ${streamName}`);

  const host = appHost || 'app.mizrachitv.co.il';
  const linkUrl = `https://${host}/watch/${linkId}`;
  const channelMessage = `🔗 <b>נוצר קישור צפייה חדש</b>\n\n👤 <b>יוצר:</b> ${actorName}\n📡 <b>שידור:</b> <code>${streamName}</code>\n\n<b>לינק:</b>\n${linkUrl}`;

  await sendTelegramMessage(
  LINKS_GROUP_CHAT_ID,
  channelMessage,
  {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '🔗 פתח שידור',
            url: linkUrl
          }
        ]
      ]
    }
  }
);
}

export async function notifyAdminOnSecureLinkDeleted(streamName: string, actorName: string) {
  await sendTelegramLogMessage(`🗑️ ${actorName} מחק קישור לשידור ${streamName}`);
}


export async function notifyAdminOnViewerCreated(clientName: string, viewerName: string) {
  await sendTelegramLogMessage(`👤 נוצר צופה ${viewerName} ללקוח ${clientName}`);
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string
) {
  try {
    const credentials = await getSystemCredentials();
    const token = credentials.telegramBotToken;
    if (!token) return;

    const apiUrl = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false
      }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return data;
  } catch (err) {
    console.error('answerTelegramCallbackQuery error:', err);
    throw err;
  }
}

export async function getTelegramChatMember(
  chatId: string | number,
  userId: string | number
) {
  const credentials = await getSystemCredentials();
  const token = credentials.telegramBotToken;
  if (!token) throw new Error('Telegram bot token is not configured');

  const apiUrl = `https://api.telegram.org/bot${token}/getChatMember`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      user_id: userId
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
  return data.result;
}

export async function createTelegramSingleUseInviteLink(
  chatId: string | number
) {
  const credentials = await getSystemCredentials();
  const token = credentials.telegramBotToken;
  if (!token) throw new Error('Telegram bot token is not configured');

  const expireDate = Math.floor(Date.now() / 1000) + (60 * 60); // שעה
  const apiUrl = `https://api.telegram.org/bot${token}/createChatInviteLink`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      member_limit: 1,
      expire_date: expireDate,
      creates_join_request: false
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
  return data.result;
}
