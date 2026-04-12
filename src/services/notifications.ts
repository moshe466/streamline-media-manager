'use server';

/**
 * Hub for Business Notifications.
 * Consolidates all alert-sending logic to break circular dependencies.
 */

import { sendTelegramMessage, sendTelegramLogMessage } from './telegram';
import { PILOT_ALERTS_GROUP_ID, LINKS_GROUP_CHAT_ID, LOGIN_SUCCESS_CHAT_ID } from '@/lib/telegram-config';
import { logEvent } from './logger';
import { getClientById, getClients, type Client } from './clients';

function escapeHtml(s: string): string {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notifyStreamOnline(streamName: string, clientNickname?: string) {
    await logEvent('STREAM_ONLINE', `Stream ${streamName} is now online. ${clientNickname ? `(Client: ${clientNickname})` : ''}`);

    const clients = await getClients({ userId: 'system', sessionId: 'system' });

    const adminMessage = `✅ <b>עלייה לאוויר</b>\n\nהשידור <code>${escapeHtml(streamName)}</code> עלה לאוויר. ${clientNickname ? `(לקוח: <b>${escapeHtml(clientNickname)}</b>)` : ''}`;
    await sendTelegramLogMessage(adminMessage, 'onStreamStatusChange');

    await sendTelegramMessage(
        LINKS_GROUP_CHAT_ID,
        `מטיס (${streamName}) עלה לשידור`,
        {
            reply_markup: {
                inline_keyboard: [[{
                    text: '🎬 צור לינק',
                    url: `https://t.me/Mizrachi_TV_bot?start=create_${streamName}`
                }]]
            }
        }
    );

    await sendTelegramMessage(PILOT_ALERTS_GROUP_ID, `מטיס (${streamName}) עלה לשידור`);

    for (const client of clients) {
        await sendNotificationIfEnabled(
            client,
            'onStreamOnline',
            streamName,
            () => `✅ <b>עלייה לאוויר:</b> השידור <code>${streamName}</code> החל לפעול.`
        );
    }
}

export async function notifyStreamOffline(streamName: string, clientNickname?: string) {
    await logEvent('STREAM_OFFLINE', `Stream ${streamName} is now offline. ${clientNickname ? `(Client: ${clientNickname})` : ''}`);

    const clients = await getClients({ userId: 'system', sessionId: 'system' });

    const adminMessage = `⛔️ <b>נפילת שידור</b>\n\nהשידור <code>${escapeHtml(streamName)}</code> הפסיק לפעול. ${clientNickname ? `(לקוח: <b>${escapeHtml(clientNickname)}</b>)` : ''}`;
    await sendTelegramLogMessage(adminMessage, 'onStreamStatusChange');

    await sendTelegramMessage(PILOT_ALERTS_GROUP_ID, `מטיס (${streamName}) ירד משידור`);

    for (const client of clients) {
        await sendNotificationIfEnabled(
            client,
            'onStreamOffline',
            streamName,
            () => `⛔️ <b>נפילת שידור:</b> השידור <code>${streamName}</code> הפסיק לפעול.`
        );
    }
}

export async function notifyNewStreamAdded(clientId: string, streamName: string) {
    const client = await getClientById(clientId);
    if (!client) return;

    await sendNotificationIfEnabled(
        client,
        'onNewStreamAdded',
        null,
        () => `🎉 <b>שידור חדש נוסף!</b> המנהל הוסיף לך את השידור <code>${streamName}</code> לחשבון.`
    );
}

export async function notifyViewerRequest(clientId: string, viewerName: string) {
    const client = await getClientById(clientId);
    if (!client) return;

    await sendNotificationIfEnabled(
        client,
        'onViewerRequest',
        null,
        () => `🙋‍♂️ <b>בקשת גישה חדשה:</b> הצופה <b>${viewerName}</b> מבקש לחדש את הרשאת הכניסה שלו.`
    );
}

export async function notifyPushStart(clientId: string, pushComment: string) {
    const client = await getClientById(clientId);
    if (!client) return;

    await sendNotificationIfEnabled(
        client,
        'onPushStart',
        null,
        () => `🚀 <b>שידור יוצא החל:</b> השידור ליעד "<b>${pushComment}</b>" החל בהצלחה.`
    );
}

export async function notifyAdminOnNewStream(streamName: string, creatorName: string) {
    const message = `📡 <b>שידור חדש נוצר</b>\n\nהמשתמש <b>${escapeHtml(creatorName)}</b> יצר את השידור <code>${escapeHtml(streamName)}</code>.`;
    await sendTelegramLogMessage(message, 'onStreamCreated');
}

export async function notifyAdminOnStreamDelete(streamName: string, clientName: string) {
    const message = `🗑️ <b>שידור נמחק</b>\n\nהשידור <code>${escapeHtml(streamName)}</code> (ששויך ללקוח <b>${escapeHtml(clientName)}</b>) נמחק.`;
    await sendTelegramLogMessage(message, 'onStreamDeleted');
}

export async function notifyAdminOnBackupSuccess(backupType: 'אוטומטי' | 'ידני', backupId: string) {
    const message = `🗄️ <b>גיבוי הושלם בהצלחה</b>\n\nסוג הגיבוי: <b>${backupType}</b>\nמזהה קובץ: <code>${backupId}</code>`;
    await sendTelegramLogMessage(message, 'onBackupSuccess');
}

export async function notifyAdminOnSecureLinkCreated(
    streamName: string,
    actorName: string,
    linkId: string,
    appHost?: string,
    source: 'app' | 'bot' = 'app'
) {
    const host = appHost || 'mcr.uhdrones.org.il';
    const linkUrl = `https://${host}/watch/${linkId}`;

    const title = source === 'bot'
        ? '🔗 לינק נוצר מהבוט'
        : '🔗 לינק נוצר באמצעות האפליקציה';

    const groupMessage =
        `${title}\n\n` +
        `👤 יוצר: ${escapeHtml(actorName)}\n` +
        `📡 שידור: ${escapeHtml(streamName)}\n\n` +
        `לינק:\n${linkUrl}`;

    const adminMessage =
        `🔗 <b>נוצר קישור צפייה מאובטח</b>\n\n` +
        `<b>מקור:</b> ${source === 'bot' ? 'בוט' : 'אפליקציה'}\n` +
        `<b>יוצר:</b> ${escapeHtml(actorName)}\n` +
        `<b>שידור:</b> <code>${escapeHtml(streamName)}</code>\n\n` +
        `<b>לינק:</b>\n${linkUrl}`;

    await sendTelegramLogMessage(adminMessage, 'onSecureLinkCreated');
    await sendTelegramMessage(LINKS_GROUP_CHAT_ID, groupMessage, { parse_mode: 'HTML' });
}

export async function notifyAdminOnSecureLinkDeleted(streamName: string, actorName: string) {
    const message = `🗑️ <b>קישור צפייה מאובטח נמחק</b>\n\nהמשתמש <b>${escapeHtml(actorName)}</b> מחק את הקישור לשידור <code>${escapeHtml(streamName)}</code>.`;
    await sendTelegramLogMessage(message, 'onSecureLinkCreated');
}

export async function notifyAdminOnViewerCreated(clientName: string, viewerName: string) {
    const message = `👤 <b>צופה חדש נוצר</b>\n\nהלקוח <b>${escapeHtml(clientName)}</b> יצר חשבון צופה עבור <b>${escapeHtml(viewerName)}</b>.`;
    await sendTelegramLogMessage(message, 'onViewerCreated');
}

export async function notifyAdminLogin(nickname: string, role: string, email: string) {
    const roleEmoji = role === 'super-admin' ? '👑' : (role === 'admin' ? '🛡️' : '📝');
    const message = `🔐 <b>התחברות מנהל</b>\n\n${roleEmoji} המשתמש <b>${escapeHtml(nickname)}</b> התחבר למערכת.\n<b>תפקיד:</b> ${role}\n<b>אימייל:</b> ${escapeHtml(email)}`;

    await sendTelegramLogMessage(message, 'onAdminLogin');
    await sendTelegramMessage(LOGIN_SUCCESS_CHAT_ID, message, { parse_mode: 'HTML' });
}

async function sendNotificationIfEnabled(
    client: Client,
    settingKey: keyof import('./clients').NotificationSettings,
    streamName: string | null,
    messageBuilder: (client: Client) => string
) {
    const clientTelegramChats = client.telegramChats || [];
    if (clientTelegramChats.length === 0) return;
    if (client.telegramNotificationsEnabled === false) return;

    const settings = client.notificationSettings || {};
    let isEnabled = false;

    if (settingKey === 'onStreamOnline' || settingKey === 'onStreamOffline') {
        if (streamName && settings[settingKey]?.[streamName]) {
            isEnabled = true;
        }
    } else {
        if (settings[settingKey]) {
            isEnabled = true;
        }
    }

    if (isEnabled) {
        const message = messageBuilder(client);
        for (const chat of clientTelegramChats) {
            await sendTelegramMessage(chat.id, message);
        }
    }
}
