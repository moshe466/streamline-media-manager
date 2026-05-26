import { getLinkAnalytics, listLinkAnalytics } from '@/services/link-analytics';
import { getStreams } from '@/services/flussonic';
import os from 'os';
import { spawn, execSync } from 'child_process';

import { NextResponse } from 'next/server';
import { sendTelegramLogMessage, sendTelegramMessage, getSession, createOrUpdateSession, deleteSession, sendTelegramMessageWithPhoneKeyboard, answerTelegramCallbackQuery, getTelegramChatMember, createTelegramSingleUseInviteLink } from '@/services/telegram';
import { TELEGRAM_LINKS_SUPER_ADMIN_ID } from '@/lib/telegram-config';
import { createLinkAccessRequest, approveTelegramUserLinkAccess, rejectTelegramUserLinkAccess, revokeTelegramUserLinkAccess, isTelegramUserAllowedToCreateLinks, getTelegramLinkAccessRequest, listApprovedTelegramLinkUsers, getTelegramLinkPermission, setTelegramUserCustomDisplayName, listPendingTelegramLinkAccessRequests } from '@/services/telegram-link-permissions';
import { LINKS_GROUP_CHAT_ID, PILOT_ALERTS_GROUP_ID, TELEGRAM_BROADCAST_GROUPS } from '@/lib/telegram-config';
import { logEvent } from '@/services/logger';
import { getDb } from '@/lib/firebase-admin';
import type { Client } from '@/services/clients';
import { updateClientTelegramNotificationsEnabled, updateClientTelegramConnection } from '@/services/clients';
import { getSystemCredentials, getUserById, updateUser } from '@/services/users';
import type { User } from '@/services/users';
import { getAuthCodeDetails } from '@/services/telegram-auth';
import { createSecureLink, listRecentSecureLinks, deleteSecureLink } from '@/services/secure-links';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TELEGRAM_SESSION_IDLE_LIMIT_MS = 5 * 60 * 1000;


async function sendLinkAdminMenu(chatId: number | string) {
  await sendTelegramMessage(
    chatId,
    '🛠️ תפריט ניהול הרשאות ולינקים',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ שלח לינק לבקשת הרשאה', callback_data: 'link_admin:send_request_link' }],
          [{ text: '📊 סטטיסטיקות לינקים', callback_data: 'link_admin:link_stats_menu' }],
          [{ text: '👁️ לינקים פעילים עכשיו', callback_data: 'link_admin:active_links' }],
          [{ text: '⚠️ לינקים חשודים', callback_data: 'link_admin:suspicious_links' }],
          [{ text: '🚫 לינקים חסומים', callback_data: 'link_admin:blocked_links' }],
          [{ text: '📢 שלח הודעה לכל הקבוצות', callback_data: 'link_admin:broadcast' }],
          [{ text: '⏳ בקשות ממתינות', callback_data: 'link_admin:pending_requests' }],
          [{ text: '📋 רשימת משתמשים מורשים', callback_data: 'link_admin:list_users' }],
          [{ text: '✏️ שנה שם למשתמש', callback_data: 'link_admin:rename_menu' }],
          [{ text: '❌ הסר הרשאה ממשתמש', callback_data: 'link_admin:revoke_menu' }],
          [{ text: '📊 סטטוס מערכת', callback_data: 'link_admin:system_status' }]
        ]
      }
    }
  );
}

// === helpers (שים למעלה בקובץ, לפני handlePhone) ===
function normalizeEmail(e: string) {
  return (e || '').trim().toLowerCase();
}
function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  return digits;
}

async function getClientByChatId(chatId: number): Promise<Client | null> {
    const db = getDb();
    const snapshot = await db.collection('clients').where('telegramChats', 'array-contains', { id: String(chatId) }).limit(1).get();
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client;
}



async function findClientByTelegramChatIdSafe(chatId: number | string): Promise<Client | null> {
  const db = getDb();
  const snapshot = await db.collection('clients').get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const chats = Array.isArray(data.telegramChats) ? data.telegramChats : [];
    const match = chats.find((chat: any) => String(chat?.id) === String(chatId));

    if (match) {
      return { id: doc.id, ...data } as Client;
    }
  }

  return null;
}


async function findAdminByTelegramChatIdSafe(chatId: number | string): Promise<User | null> {
  const db = getDb();
  const snapshot = await db.collection('users').where('telegramChatId', '==', String(chatId)).limit(1).get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as User;
}

async function handleNewUser(chatId: number, from: any) {
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || '(ללא שם)';
  const username = from?.username ? '@' + from.username : '—';
  const userId = from?.id ?? '—';

  await sendTelegramLogMessage(
    [
      '🆕 משתמש חדש לחץ Start',
      `שם: ${fullName}`,
      `שם משתמש: ${username}`,
      `User ID: <code>${userId}</code>`,
      `Chat ID: <code>${chatId}</code>`
    ].join('\n')
  );

  await deleteSession(chatId);
  await createOrUpdateSession(chatId, { state: 'awaiting_email' });

  await sendTelegramMessage(
    chatId,
    [
      '✋ ברוכים הבאים לבוט של Mizrachi-TV!',
      '',
      'כדי לזהות אותך ולוודא אם אתה לקוח רשום, נבקש 2 פרטים:',
      '1) כתובת מייל',
      '2) מספר טלפון',
      '',
      'נתחיל מהמייל — פשוט כתוב כאן את כתובת המייל שלך 👇'
    ].join('\n')
  );
}

async function handleEmail(chatId: number, text: string) {
    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(text)) {
        await sendTelegramMessage(chatId, "כתובת המייל שהוזנה אינה תקינה. אנא נסה שוב.");
        return;
    }
    await createOrUpdateSession(chatId, { email: text.toLowerCase(), state: 'awaiting_phone' });
    
    await sendTelegramMessageWithPhoneKeyboard(
      chatId,
      'תודה! עכשיו שלח את מספר הטלפון שלך.\nאפשר לשתף דרך הכפתור או להקליד בפורמט 0501234567.'
    );
}

async function handlePhone(chatId: number, textOrPhone: string, session: any) {
  try {
    const phone = normalizePhone(textOrPhone);
    if (!/^05\d{8}$/.test(phone)) {
      await sendTelegramMessage(
        chatId,
        'מספר הטלפון שהוזן אינו תקין. נסה שוב (לדוגמה: 0501234567).'
      );
      return;
    }

    // אם שמרת אימייל בסשן — נרמול
    const email = normalizeEmail(session?.email || '');

    // מומלץ: חיפוש ישיר בפיירסטור במקום getClients()
    const db = getDb();
    const snap = await db.collection('clients').where('email', '==', email).limit(10).get();
    const matched = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .find(c => normalizePhone(c.phone) === phone);

    if (matched) {
      // 1) שמירת chatId בכרטיס הלקוח
      await db.collection('clients').doc(matched.id).update({ 
          telegramChats: [ { id: String(chatId), name: `צ'אט פרטי` } ], // Add as an array
          telegramNotificationsEnabled: true // Enable notifications on connect
      });

      // 3) הודעת הצלחה חדשה (בלי נוסח "התחברת לקבלת התראות")
      const displayName = matched.nickname || matched.name || 'לקוח';
      await sendTelegramMessage(
        chatId,
        [
          `✅ ${displayName}, הזדהות הושלמה בהצלחה.`,
          'מעכשיו תוכל לקבל עדכונים והתראות מהמוצר.',
          'כדי להפסיק זמנית את קבלת ההתראות, שלח את הפקודה /stop'
        ].join('\n')
      );

      await sendTelegramLogMessage(
        `✅ לקוח זוהה ושויך (clientId=${matched.id}) לצ׳אט ${chatId}.`
      );
      await deleteSession(chatId);
      return;
    }

    // לא נמצא לקוח — שולחים לטופס הרשמה
    const registrationLink = 'https://app.mizrachitv.co.il/questionnaire';
    await sendTelegramMessage(
      chatId,
      [
        'מצטערים, לא נמצאה התאמה במערכת לפרטים שסיפקת.',
        '',
        'כדי להצטרף לשירות, מלא/י את טופס ההרשמה:',
        registrationLink
      ].join('\n')
    );
    await deleteSession(chatId);
  } catch (err) {
    console.error('handlePhone error:', err);
    await sendTelegramLogMessage(`🔥 handlePhone error: ${(err as Error).message}`);
    // לא מפילים את השיחה — שולחים הודעה רכה למשתמש
    await sendTelegramMessage(
      chatId,
      'אירעה תקלה רגעית בעת העיבוד. אפשר לנסות שוב, או לשלוח /start להתחלה מחדש.'
    );
  }
}

async function handleStopCommand(chatId: number) {
    const client = await getClientByChatId(chatId);
    if (client) {
        await getDb().collection('clients').doc(client.id).update({ telegramNotificationsEnabled: false });
        await sendTelegramMessage(chatId, 'התראות אוטומטיות הופסקו. כדי לחדש אותן, שלח את הפקודה /start');
    } else {
        await sendTelegramMessage(chatId, 'לא נמצא חשבון מקושר. אנא התחל את תהליך הרישום מחדש דרך ממשק הניהול.');
    }
}

async function handleStartWithCode(chatId: number, from: any, code: string) {
    const authDetails = await getAuthCodeDetails(code);

    if (!authDetails) {
        await sendTelegramMessage(chatId, 'קוד האימות אינו תקין או שפג תוקפו. אנא נסה להתחבר שוב מהמערכת.');
        await logEvent('TELEGRAM_AUTH_FAILURE', `Invalid or expired auth code received from chat ID: ${chatId}`);
        return;
    }

    const { userId, userRole } = authDetails;
    if (userRole === 'admin' || userRole === 'editor' || userRole === 'super-admin') {
        await updateUser(userId, { telegramChatId: String(chatId) });
        await sendTelegramMessage(chatId, '✅ החשבון שלך קושר בהצלחה! כעת תקבל התראות ניהוליות ישירות לכאן.');
        await logEvent('TELEGRAM_AUTH_SUCCESS', `Admin/editor ${userId} successfully linked to chat ID: ${chatId}`);
    } else {
        // Handle other roles if needed in the future
        await sendTelegramMessage(chatId, 'קוד אימות לא מזוהה עבור תפקיד זה.');
    }
}


async function handleStartCommand(chatId: number, from: any, code?: string) {
    if (code) {
        await handleStartWithCode(chatId, from, code);
        return;
    }
    
    // Check if it's a known admin reconnecting
    const admin = await getUserById(from.id.toString()); // Assuming from.id is the potential admin identifier
    if (admin && admin.telegramChatId === String(chatId)) {
        await sendTelegramMessage(chatId, `שלום ${admin.nickname}, ברוך שובך!`);
        return;
    }

    // Default flow for new users or clients
    const client = await getClientByChatId(chatId);
    if (client) {
        await getDb().collection('clients').doc(client.id).update({ telegramNotificationsEnabled: true });
        await sendTelegramMessage(chatId, `שלום ${client.nickname}, הפעלת מחדש את ההתראות האוטומטיות. כדי להפסיק אותן, שלח /stop`);
    } else {
        await handleNewUser(chatId, from);
    }
}


export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // אימות טוקן סודי (אם הגדרת setWebhook עם secret_token)
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    try {
      const creds = await getSystemCredentials();
      const expected = (creds as any).telegramWebhookSecret; // Assuming the field name
      if (expected && secretHeader !== expected) {
        await logEvent('TELEGRAM_WEBHOOK_SECRET_MISMATCH', `Got: ${secretHeader || '(none)'}`);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch { /* optional: fail silently if creds fail */ }

    // לוג מהיר לערוץ ניטור
    await sendTelegramLogMessage(`✅ WEBHOOK HIT\n${new Date().toISOString()}\n${rawBody.slice(0, 800)}`);
    await logEvent('TELEGRAM_WEBHOOK_RECEIVED', rawBody);

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: true, message: 'Non-JSON request processed.' });
    }

    // תמיכה בעדכון contact (כפתור “שתף מספר טלפון”)
    const message = body.message;
    if (message?.contact && message?.chat?.type === 'private') {
      const chatId = message.chat.id;
      let session = await getSession(chatId);

      if (session?.updatedAt) {
        const last = new Date(session.updatedAt).getTime();
        if (Date.now() - last > TELEGRAM_SESSION_IDLE_LIMIT_MS) {
          await createOrUpdateSession(chatId, { state: 'idle', updatedAt: new Date().toISOString() });
          session = { state: 'idle' };
          if (String(message.from.id) === TELEGRAM_LINKS_SUPER_ADMIN_ID) {
            await sendTelegramMessage(chatId, '⏱️ עברו 5 דקות ללא פעולה. חזרת לתפריט הראשי.');
            await sendLinkAdminMenu(chatId);
            return NextResponse.json({ success: true });
          }
        }
      }

      // Admin compatibility: plain /start and /stop for already linked admins
      const linkedAdmin = await findAdminByTelegramChatIdSafe(chatId);

      if (linkedAdmin && (message.text || '').trim() === '/start') {
        await updateUser(linkedAdmin.id, { adminTelegramEnabled: true });
        await sendTelegramMessage(chatId, `🔔 ההתראות הניהוליות הופעלו מחדש עבור ${linkedAdmin.nickname}.`);
        return NextResponse.json({ ok: true });
      }

      if (linkedAdmin && (message.text || '').trim() === '/stop') {
        await updateUser(linkedAdmin.id, { adminTelegramEnabled: false });
        await sendTelegramMessage(chatId, `⏸️ ההתראות הניהוליות הופסקו עבור ${linkedAdmin.nickname}.`);
        return NextResponse.json({ ok: true });
      }


      if (session?.state === 'awaiting_phone') {
        const phone = (message.contact.phone_number || '').replace(/\D/g, '');
        await handlePhone(chatId, phone, session);
      } else {
        await sendTelegramMessage(chatId, 'אנא שלח /start כדי להתחיל תהליך חדש.');
      }
      return NextResponse.json({ success: true });
    }

    const callbackQuery = body.callback_query;
    if (callbackQuery?.data) {
      const data = callbackQuery.data;
      console.log('TELEGRAM CALLBACK RECEIVED', { data, fromId: callbackQuery.from?.id, chatId: callbackQuery.message?.chat?.id });
      const from = callbackQuery.from;
      const chatId = callbackQuery.message?.chat?.id;

      const callbackId = callbackQuery.id;
      const isSuperAdmin = String(message.from.id) === TELEGRAM_LINKS_SUPER_ADMIN_ID;

      try {
        await answerTelegramCallbackQuery(callbackId);
      } catch (e) {
        console.error('Failed to answer callback query:', e);
      }
      if (data === 'link_admin:main_menu') {
        if (chatId) await sendLinkAdminMenu(chatId);
        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:link_stats_menu' || data === 'link_admin:active_links' || data === 'link_admin:suspicious_links' || data === 'link_admin:blocked_links') {
        const links = await listLinkAnalytics(20);

        let filtered = links;
        let title = '📊 סטטיסטיקות לינקים';

        if (data === 'link_admin:active_links') {
          filtered = links.filter((l: any) => (l.currentViewers || 0) > 0);
          title = '👁️ לינקים פעילים עכשיו';
        }

        if (data === 'link_admin:suspicious_links') {
          filtered = links.filter((l: any) => l.suspectedSharing);
          title = '⚠️ לינקים חשודים';
        }

        if (data === 'link_admin:blocked_links') {
          filtered = links.filter((l: any) => l.isBlocked);
          title = '🚫 לינקים חסומים';
        }

        if (!filtered.length) {
          await sendTelegramMessage(chatId!, title + '\n\n📭 אין נתונים להצגה.', {
            reply_markup: { inline_keyboard: [[{ text: '↩️ חזרה לתפריט הראשי', callback_data: 'link_admin:main_menu' }]] }
          });
          return NextResponse.json({ success: true });
        }

        for (const link of filtered.slice(0, 10) as any[]) {
          const linkId = link.linkId || link.id;
          const text =
            `${title}\n\n` +
            `🔗 <b>Link ID:</b> <code>${linkId}</code>\n` +
            `📡 <b>שידור:</b> <code>${link.streamName || '—'}</code>\n` +
            `👁️ <b>צופים עכשיו:</b> ${link.currentViewers || 0}\n` +
            `📈 <b>שיא צפיות:</b> ${link.peakViewers || 0}\n` +
            `�� <b>IPs:</b> ${link.uniqueIpCount || 0}\n` +
            `⚠️ <b>חשד לשיתוף:</b> ${link.suspectedSharing ? 'כן' : 'לא'}\n` +
            `🚫 <b>חסום:</b> ${link.isBlocked ? 'כן' : 'לא'}\n` +
            `🕒 <b>עודכן:</b> ${link.updatedAt || '—'}`;

          await sendTelegramMessage(chatId!, text, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📊 פרטים', callback_data: `link_stats:${linkId}` }
                ],
                [
                  link.isBlocked
                    ? { text: '✅ שחרר חסימה', callback_data: `unblock_link:${linkId}` }
                    : { text: '🚫 חסום לינק', callback_data: `block_link:${linkId}` }
                ],
                [
                  { text: '↩️ חזרה לתפריט הראשי', callback_data: 'link_admin:main_menu' }
                ]
              ]
            }
          });
        }

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('link_stats:')) {
        const linkId = data.split(':')[1];
        const stats = await getLinkAnalytics(linkId);

        if (!stats) {
          await sendTelegramMessage(chatId!, '📭 אין נתוני צפייה ללינק הזה.');
          return NextResponse.json({ success: true });
        }

        const sessions = Object.values((stats as any).currentSessions || {}) as any[];
        const maxWatchSeconds = Math.max(0, ...sessions.map((session: any) => session.watchSeconds || 0));

        await sendTelegramMessage(
          chatId!,
          `📊 <b>סטטיסטיקת לינק</b>\n\n` +
          `🔗 <b>לינק:</b> <code>${linkId}</code>\n` +
          `📡 <b>שידור:</b> <code>${(stats as any).streamName || '—'}</code>\n` +
          `🟢 <b>מחובר עכשיו:</b> ${(stats as any).isLiveNow ? 'כן' : 'לא'}\n` +
          `👁️ <b>צופים עכשיו:</b> ${(stats as any).currentViewers || 0}\n` +
          `�� <b>שיא צפיות:</b> ${(stats as any).peakViewers || 0}\n` +
          `🌍 <b>מספר IP:</b> ${(stats as any).uniqueIpCount || 0}\n` +
          `⏱️ <b>זמן צפייה מקסימלי:</b> ${maxWatchSeconds} שניות\n` +
          `⚠️ <b>חשד לשיתוף:</b> ${(stats as any).suspectedSharing ? 'כן' : 'לא'}\n` +
          `🚫 <b>חסום:</b> ${(stats as any).isBlocked ? 'כן' : 'לא'}\n` +
          `🔁 <b>פעימות:</b> ${(stats as any).totalHeartbeats || 0}`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  (stats as any).isBlocked
                    ? { text: '✅ שחרר חסימה', callback_data: `unblock_link:${linkId}` }
                    : { text: '🚫 חסום לינק', callback_data: `block_link:${linkId}` }
                ],
                [{ text: '↩️ חזרה לתפריט הראשי', callback_data: 'link_admin:main_menu' }]
              ]
            }
          }
        );

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('block_link:') || data.startsWith('unblock_link:')) {
        const linkId = data.split(':')[1];
        const isBlocked = data.startsWith('block_link:');

        await getDb().collection('secure_link_analytics').doc(linkId).set({
          isBlocked,
          blockedAt: isBlocked ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await sendTelegramMessage(
          chatId!,
          isBlocked ? `🚫 הלינק נחסם: ${linkId}` : `✅ החסימה שוחררה: ${linkId}`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '↩️ חזרה לתפריט הראשי', callback_data: 'link_admin:main_menu' }]]
            }
          }
        );

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:broadcast') {
        await createOrUpdateSession(chatId!, {
          state: 'awaiting_broadcast_message'
        });

        await sendTelegramMessage(
          chatId!,
          '📢 שלח עכשיו את ההודעה שברצונך להפיץ לכל הקבוצות.'
        );

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:send_request_link') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        if (chatId) {
          await sendTelegramMessage(
            chatId,
            '🔗 זה הלינק לשליחה למשתמש חדש:\n\nhttps://t.me/Mizrachi_TV_bot?start=request_link_access'
          );
        }
        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:pending_requests') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        const requests = await listPendingTelegramLinkAccessRequests();

        if (!requests.length) {
          await sendTelegramMessage(chatId, '📭 אין כרגע בקשות ממתינות.');
          return NextResponse.json({ success: true });
        }

        for (const req of requests) {
          const displayName =
            `${req.firstName || ''} ${req.lastName || ''}`.trim() ||
            `@${req.username || '—'}` ||
            req.telegramUserId;

          const text =
            `📨 <b>בקשה ממתינה</b>\n\n` +
            `👤 <b>שם:</b> ${displayName}\n` +
            `📛 <b>יוזר:</b> @${req.username || '—'}\n` +
            `🆔 <b>Telegram ID:</b> <code>${req.telegramUserId}</code>\n` +
            `💬 <b>Chat ID:</b> <code>${req.chatId || '—'}</code>\n` +
            `🕒 <b>נשלח:</b> ${req.requestedAt || '—'}`;

          await sendTelegramMessage(
            chatId,
            text,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ מאושר', callback_data: `approve_link_user:${req.telegramUserId}` },
                    { text: '❌ לא מאושר', callback_data: `reject_link_user:${req.telegramUserId}` }
                  ],
                  [
                    { text: '📡 חוזי', callback_data: `hozi_link_user:${req.telegramUserId}` }
                  ]
                ]
              }
            }
          );
        }

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:system_status') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }

        const checkProc = (pattern: string) => {
          try {
            const out = execSync(`ps aux | grep "${pattern}" | grep -v grep`, { encoding: 'utf8' }).trim();
            return out ? '✅ רץ' : '❌ לא רץ';
          } catch {
            return '❌ לא רץ';
          }
        };

        const nextDevStatus = checkProc('next dev');
        const nextStartStatus = checkProc('next start');
        const nextStatus = (nextDevStatus === '✅ רץ' || nextStartStatus === '✅ רץ') ? '✅ רץ' : '❌ לא רץ';
        const streamPollerStatus = checkProc('stream-poller');
        const linksPollerStatus = checkProc('links-poller');

        const db = getDb();

        let activeLinksCount = 0;
        try {
          const now = new Date();
          const activeLinksSnap = await db
            .collection('secure_links')
            .where('expiresAt', '>', now)
            .get();

          activeLinksCount = activeLinksSnap.size;
        } catch (e) {
          console.error('system_status activeLinksCount error:', e);
        }

        let onlineStreamsCount = 0;
        try {
          const streams = await getStreams();
          onlineStreamsCount = (streams || []).filter((s: any) => s.status === 'online').length;
        } catch (e) {
          console.error('system_status onlineStreamsCount error:', e);
        }

        let restartTime = 'לא ידוע';
        let restartStatus = 'לא ידוע';

        try {
          const raw = execSync('cat restart-status.json 2>/dev/null || true', { encoding: 'utf8' }).trim();
          if (raw) {
            const parsed = JSON.parse(raw);
            restartStatus = parsed.status || 'לא ידוע';
            restartTime = parsed.finishedAt || parsed.startedAt || 'לא ידוע';
          }
        } catch {}

        const totalMemGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const freeMemGb = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
        const usedMemGb = (Number(totalMemGb) - Number(freeMemGb)).toFixed(1);
        const load = os.loadavg()[0].toFixed(2);
        const uptimeHours = (os.uptime() / 3600).toFixed(1);

        const message =
          '📊 סטטוס מערכת\n\n' +
          `🌐 Next.js: ${nextStatus}\n` +
          `📡 Stream Poller: ${streamPollerStatus}\n` +
          `🔗 Links Poller: ${linksPollerStatus}\n\n` +
          `🎥 שידורים באוויר: ${onlineStreamsCount}\n` +
          `🔗 לינקים פעילים: ${activeLinksCount}\n\n` +
          `🕒 הפעלה אחרונה: ${restartTime}\n` +
          `♻️ סטטוס restart: ${restartStatus}\n` +
          `💾 זיכרון בשימוש: ${usedMemGb}GB / ${totalMemGb}GB\n` +
          `⚙️ עומס מערכת: ${load}\n` +
          `⏱ Uptime שרת: ${uptimeHours} שעות\n`;

        if (chatId) {
          await sendTelegramMessage(chatId, message);
        }

        return NextResponse.json({ success: true });
      }


      if (data === 'link_admin:restart_system') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }

        if (chatId) {
          await sendTelegramMessage(chatId, '♻️ התקבלה פקודת דריסה והפעלה מחדש. המערכת תופעל מחדש בעוד כ-2 שניות...');
        }

        const cmd = "sleep 2; bash src/scripts/restart-system.sh > restart.log 2>&1";
        const child = spawn('bash', ['-lc', cmd], {
          detached: true,
          stdio: 'ignore',
          cwd: process.cwd(),
          env: process.env,
        });

        child.unref();

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:recent_links') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        const links = await listRecentSecureLinks(10);

        if (!links.length) {
          await sendTelegramMessage(chatId, '📭 אין לינקים אחרונים להצגה.');
          return NextResponse.json({ success: true });
        }

        for (const link of links) {
          const host = (link as any).appHost || 'mcr.uhdrones.org.il';
          const watchUrl = `https://${host}/watch/${link.id}`;
          const actorName = (link as any).createdBy || 'לא ידוע';
          const source = (link as any).createdVia === 'bot' ? 'בוט' : 'אפליקציה';
          const createdAt = link.createdAt instanceof Date ? link.createdAt.toISOString() : String(link.createdAt || '');

          const expiresAt = link.expiresAt instanceof Date
            ? link.expiresAt
            : new Date((link as any).expiresAt || 0);

          const isActive = expiresAt > new Date();
          const statusText = isActive ? '✅ פעיל' : '⛔ לא פעיל';

          const text =
            `📋 <b>לינק אחרון</b>\n\n` +
            `👤 <b>יוצר:</b> ${actorName}\n` +
            `📡 <b>שידור:</b> ${link.streamName}\n` +
            `🧩 <b>מקור:</b> ${source}\n` +
            `📌 <b>סטטוס:</b> ${statusText}\n` +
            `🕒 <b>נוצר:</b> ${createdAt}\n` +
            `⌛ <b>פג תוקף:</b> ${expiresAt.toISOString()}\n\n` +
            `<b>לינק:</b>\n${watchUrl}`;

          const inline_keyboard = isActive
            ? [
                [{ text: '🔗 פתח לינק', url: watchUrl }],
                [{ text: '🗑️ מחק לינק', callback_data: `delete_secure_link:${link.id}` }]
              ]
            : [
                [{ text: '🔗 פתח לינק', url: watchUrl }]
              ];

          await sendTelegramMessage(
            chatId,
            text,
            {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard }
            }
          );
        }

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:list_users') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const users = await listApprovedTelegramLinkUsers();

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        if (!users.length) {
          await sendTelegramMessage(chatId, '📭 אין משתמשים מורשים כרגע.');
          return NextResponse.json({ success: true });
        }

        let message = '📋 רשימת משתמשים מורשים:\n\n';
        users.forEach((u, i) => {
          message += `${i + 1}. ${u.firstName || ''} ${u.lastName || ''}\n`;
          message += `📛 @${u.username || '—'}\n`;
          message += `🆔 ${u.telegramUserId}\n\n`;
        });

        await sendTelegramMessage(chatId, message);
        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:rename_menu') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const users = await listApprovedTelegramLinkUsers();

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        if (!users.length) {
          await sendTelegramMessage(chatId, '📭 אין משתמשים מורשים לשינוי שם.');
          return NextResponse.json({ success: true });
        }

        const inline_keyboard = users.map((u) => {
          const displayName =
            (u as any).customDisplayName?.trim() ||
            `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
            `@${u.username || '—'}`;

          return ([
            {
              text: `✏️ ${displayName}`,
              callback_data: `rename_link_user:${u.telegramUserId}`
            }
          ]);
        });

        await sendTelegramMessage(
          chatId,
          'בחר משתמש לשינוי שם:',
          { reply_markup: { inline_keyboard } }
        );
        return NextResponse.json({ success: true });
      }

      if (data.startsWith('rename_link_user:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const targetTelegramUserId = data.split(':')[1];

        await createOrUpdateSession(chatId!, {
          state: 'awaiting_link_user_rename',
          targetTelegramUserId
        });

        await sendTelegramMessage(
          chatId!,
          `✏️ שלח עכשיו את השם החדש עבור המשתמש ${targetTelegramUserId}`
        );

        return NextResponse.json({ success: true });
      }

      if (data === 'link_admin:revoke_menu') {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const users = await listApprovedTelegramLinkUsers();

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        if (!users.length) {
          await sendTelegramMessage(chatId, '📭 אין משתמשים מורשים להסרה.');
          return NextResponse.json({ success: true });
        }

        const inline_keyboard = users.map((u) => {
          const displayName =
            (u as any).customDisplayName?.trim() ||
            `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
            `@${u.username || '—'}`;

          return ([
            {
              text: `❌ ${displayName}`,
              callback_data: `revoke_link_user:${u.telegramUserId}`
            }
          ]);
        });

        await sendTelegramMessage(
          chatId,
          'בחר משתמש להסרת הרשאה:',
          { reply_markup: { inline_keyboard } }
        );
        return NextResponse.json({ success: true });
      }

      if (data.startsWith('delete_secure_link:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }

        const linkId = data.split(':')[1];
        const links = await listRecentSecureLinks(50);
        const targetLink = links.find((l) => l.id === linkId);

        if (!chatId) {
          return NextResponse.json({ success: true });
        }

        if (!targetLink) {
          await sendTelegramMessage(chatId, `⛔ הלינק ${linkId} כבר לא קיים במערכת.`);
          return NextResponse.json({ success: true });
        }

        const expiresAt = targetLink.expiresAt instanceof Date
          ? targetLink.expiresAt
          : new Date((targetLink as any).expiresAt || 0);

        if (!(expiresAt > new Date())) {
          await sendTelegramMessage(chatId, `⛔ הלינק ${linkId} כבר לא פעיל ולכן לא ניתן למחוק אותו מכאן.`);
          return NextResponse.json({ success: true });
        }

        const result = await deleteSecureLink(linkId, from.first_name || from.username || String(from.id));

        if (result.success) {
          await sendTelegramMessage(chatId, `✅ הלינק ${linkId} נמחק בהצלחה.`);
        } else {
          await sendTelegramMessage(chatId, `❌ מחיקת הלינק ${linkId} נכשלה.`);
        }

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('approve_link_user:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const targetTelegramUserId = data.split(':')[1];
        await approveTelegramUserLinkAccess({
          targetTelegramUserId,
          approvedByTelegramUserId: from.id
        });

        const req = await getTelegramLinkAccessRequest(targetTelegramUserId);

        let inviteText = '';
        try {
          const member = await getTelegramChatMember(LINKS_GROUP_CHAT_ID, targetTelegramUserId);
          const status = member?.status || '';
          const isAlreadyInGroup = ['creator', 'administrator', 'member', 'restricted'].includes(status);

          if (!isAlreadyInGroup && req?.chatId) {
            const invite = await createTelegramSingleUseInviteLink(LINKS_GROUP_CHAT_ID);
            inviteText = `\n\n🔗 להצטרפות לקבוצת הלינקים: ${invite.invite_link}`;
          }
        } catch (e) {
          console.error('Failed to check membership or create invite link:', e);
        }

        if (req?.chatId) {
          await sendTelegramMessage(
            req.chatId,
            `✅ בקשתך אושרה. כעת תוכל ליצור לינקים דרך הבוט.${inviteText}`
          );
        }

        if (chatId) {
          await sendTelegramMessage(chatId, `✅ המשתמש ${targetTelegramUserId} אושר ליצירת לינקים.`);
        }

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('hozi_link_user:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const targetTelegramUserId = data.split(':')[1];

        await rejectTelegramUserLinkAccess({
          targetTelegramUserId,
          rejectedByTelegramUserId: from.id
        });

        const req = await getTelegramLinkAccessRequest(targetTelegramUserId);

        let userMessage = 'יצירת לינקים מאושרת רק לבעלי תפקידים ספציפיים ובקשתך לא אושרה.';

        try {
          const member = await getTelegramChatMember(PILOT_ALERTS_GROUP_ID, targetTelegramUserId);
          const status = member?.status || '';
          const isAlreadyInGroup = ['creator', 'administrator', 'member', 'restricted'].includes(status);

          if (isAlreadyInGroup) {
            userMessage += ' הנך נמצא כבר בקבוצת חוזי, שם המידע על פתיחה וסגירת שידורים קיים.';
          } else {
            const invite = await createTelegramSingleUseInviteLink(PILOT_ALERTS_GROUP_ID);
            userMessage += ` לחיבור לקבלת מידע על השידורים בזמן אמת לחץ על הלינק: ${invite.invite_link}`;
          }
        } catch (e) {
          console.error('Failed to process Hozi group membership/invite:', e);
          userMessage += ' אם אתה זקוק לחיבור לקבוצת חוזי, פנה למנהל המערכת.';
        }

        if (req?.chatId) {
          await sendTelegramMessage(req.chatId, userMessage);
        }

        if (chatId) {
          await sendTelegramMessage(chatId, `📡 המשתמש ${targetTelegramUserId} הופנה למסלול חוזי.`);
        }

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('revoke_link_user:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const targetTelegramUserId = data.split(':')[1];

        await revokeTelegramUserLinkAccess({
          targetTelegramUserId,
          revokedByTelegramUserId: from.id
        });

        const req = await getTelegramLinkAccessRequest(targetTelegramUserId);
        if (req?.chatId) {
          await sendTelegramMessage(req.chatId, '⛔ ההרשאה שלך ליצירת לינקים הוסרה על ידי מנהל המערכת.');
        }

        if (chatId) {
          await sendTelegramMessage(chatId, `✅ ההרשאה של המשתמש ${targetTelegramUserId} הוסרה.`);
        }

        return NextResponse.json({ success: true });
      }

      if (data.startsWith('reject_link_user:')) {
        if (!isSuperAdmin) {
          return NextResponse.json({ success: true });
        }
        const targetTelegramUserId = data.split(':')[1];
        await rejectTelegramUserLinkAccess({
          targetTelegramUserId,
          rejectedByTelegramUserId: from.id
        });

        const req = await getTelegramLinkAccessRequest(targetTelegramUserId);

        if (req?.chatId) {
          await sendTelegramMessage(req.chatId, '❌ בקשתך ליצירת לינקים נדחתה. אם לדעתך מדובר בטעות, פנה למנהל המערכת.');
        }

        if (chatId) {
          await sendTelegramMessage(chatId, `❌ הבקשה של המשתמש ${targetTelegramUserId} נדחתה.`);
        }

        return NextResponse.json({ success: true });
      }
    }

    // פקודות / הודעות פרטיות
    if (message?.chat?.type === 'private' && message?.from) {
      const chatId = message.chat.id;
      const from = message.from;
      const text = (message.text || '').trim();
      console.log('PRIVATE MESSAGE RECEIVED', { chatId, fromId: from.id, text, sessionState: 'not_ready_yet' });
      const session = await getSession(chatId);

            if (text.startsWith('/start ')) {
        const payload = text.replace('/start', '').trim();
        console.log('START PAYLOAD:', payload);


        if (payload === 'client_resume') {
          const client = await getClientByChatId(chatId);

          if (!client) {
            await sendTelegramMessage(chatId, '❌ לא נמצא לקוח מקושר לצ׳אט הזה.');
            return NextResponse.json({ ok: true });
          }

          await getDb().collection('clients').doc(client.id).update({ telegramNotificationsEnabled: true });
          await sendTelegramMessage(chatId, `🔔 ההתראות הופעלו מחדש עבור ${client.nickname}.`);
          return NextResponse.json({ ok: true });
        }

        if (payload === 'client_stop') {
          const client = await getClientByChatId(chatId);

          if (!client) {
            await sendTelegramMessage(chatId, '❌ לא נמצא לקוח מקושר לצ׳אט הזה.');
            return NextResponse.json({ ok: true });
          }

          await getDb().collection('clients').doc(client.id).update({ telegramNotificationsEnabled: false });
          await sendTelegramMessage(chatId, `⏸️ ההתראות הופסקו עבור ${client.nickname}.`);
          return NextResponse.json({ ok: true });
        }

        if (payload === 'admin_resume') {
          const admin = await findAdminByTelegramChatIdSafe(chatId);

          if (!admin) {
            await sendTelegramMessage(chatId, '❌ לא נמצא מנהל מקושר לצ׳אט הזה.');
            return NextResponse.json({ ok: true });
          }

          await updateUser(admin.id, { adminTelegramEnabled: true });
          await sendTelegramMessage(chatId, `🔔 ההתראות הניהוליות הופעלו מחדש עבור ${admin.nickname}.`);
          return NextResponse.json({ ok: true });
        }

        if (payload === 'admin_stop') {
          const admin = await findAdminByTelegramChatIdSafe(chatId);

          if (!admin) {
            await sendTelegramMessage(chatId, '❌ לא נמצא מנהל מקושר לצ׳אט הזה.');
            return NextResponse.json({ ok: true });
          }

          await updateUser(admin.id, { adminTelegramEnabled: false });
          await sendTelegramMessage(chatId, `⏸️ ההתראות הניהוליות הופסקו עבור ${admin.nickname}.`);
          return NextResponse.json({ ok: true });
        }

        if (payload === 'request_link_access') {
          const result = await createLinkAccessRequest({
            telegramUserId: from.id,
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
            chatId: chatId
          });

          if (!result.created) {
            await sendTelegramMessage(chatId, '⌛ כבר שלחת בקשה או שיש לך הרשאה.');
            return NextResponse.json({ success: true });
          }

          const adminText =
            `📨 <b>בקשת הרשאה חדשה ליצירת לינקים</b>\n\n` +
            `👤 <b>שם:</b> ${from.first_name || ''} ${from.last_name || ''}\n` +
            `📛 <b>יוזר:</b> @${from.username || '—'}\n` +
            `🆔 <b>Telegram ID:</b> <code>${from.id}</code>\n` +
            `💬 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
            `בחר פעולה:`;

          await sendTelegramMessage(
            TELEGRAM_LINKS_SUPER_ADMIN_ID,
            adminText,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ מאושר', callback_data: `approve_link_user:${from.id}` },
                    { text: '❌ לא מאושר', callback_data: `reject_link_user:${from.id}` }
                  ],
                  [
                    { text: '📡 חוזי', callback_data: `hozi_link_user:${from.id}` }
                  ]
                ]
              }
            }
          );

          await sendTelegramMessage(chatId, '📨 הבקשה נשלחה למנהל.');
          return NextResponse.json({ success: true });
        }

      if (payload.startsWith('create_')) {
          const streamName = payload.replace('create_', '').trim();

          if (!streamName) {
            await sendTelegramMessage(chatId, '⚠️ לא זוהה שם שידור.');
            return NextResponse.json({ success: true });
          }

          const isAllowed = await isTelegramUserAllowedToCreateLinks(from.id);

          if (!isAllowed) {
            await sendTelegramMessage(
              chatId,
              '❌ אין לך הרשאה ליצור לינקים. שלח /start request_link_access כדי להגיש בקשה.'
            );
            return NextResponse.json({ success: true });
          }

          const permission = await getTelegramLinkPermission(from.id);
          const actorName =
            (permission as any)?.customDisplayName?.trim() ||
            [from.first_name, from.last_name].filter(Boolean).join(' ').trim() ||
            from.username ||
            String(from.id);

          console.log('CREATE LINK DEBUG', { payload, streamName, actorName, fromId: from.id });
          const result = await createSecureLink(streamName, 'default', actorName, 'mcr.uhdrones.org.il', 'bot');
          console.log('CREATE LINK RESULT', result);

          if (!result.success || !result.id) {
            await sendTelegramMessage(chatId, '❌ יצירת הלינק נכשלה.');
            return NextResponse.json({ success: true });
          }

          const watchUrl = `https://mcr.uhdrones.org.il/watch/${result.id}`;

          await sendTelegramMessage(
            chatId,
            `✅ הלינק נוצר בהצלחה עבור <code>${streamName}</code>\n\n${watchUrl}`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔗 פתח לינק', url: watchUrl }]
                ]
              }
            }
          );

          return NextResponse.json({ success: true });
        }

        // fallback ל-start עם payload לא מזוהה
        await sendTelegramMessage(chatId, '⚠️ פעולה לא מזוהה בלינק.');
        return NextResponse.json({ success: true });
      }

const isAdminCommand =
        text === '/link_admin' ||
        text === '/list_link_users' ||
        text === '/list_pending_link_requests' ||
        text.startsWith('/revoke_link_user ') ||
        text === '/request_link_access' ||
        text === '/start request_link_access';

      if (session?.state === 'awaiting_broadcast_message' && text && !isAdminCommand) {
          let successCount = 0;
          let failedCount = 0;

          const broadcastText = `📢 <b>הודעת מערכת MizrachiTV</b>\n\n${text}`;

          for (const groupId of TELEGRAM_BROADCAST_GROUPS) {
              try {
                  await sendTelegramMessage(groupId, broadcastText, { parse_mode: 'HTML' });
                  successCount++;
              } catch (err) {
                  console.error('Broadcast send failed:', groupId, err);
                  failedCount++;
              }
          }

          await createOrUpdateSession(chatId, { state: 'idle' });

          await sendTelegramMessage(
              chatId,
              `✅ ההודעה נשלחה. הצליח: ${successCount}, נכשל: ${failedCount}`
          );

          return NextResponse.json({ success: true });
      }

      if (session?.state === 'awaiting_link_user_rename' && text && !isAdminCommand) {
          const targetTelegramUserId = session.targetTelegramUserId;
          await setTelegramUserCustomDisplayName({
              targetTelegramUserId,
              customDisplayName: text
          });

          await createOrUpdateSession(chatId, { state: 'idle' });

          await sendTelegramMessage(
              chatId,
              `✅ השם המותאם נשמר עבור המשתמש ${targetTelegramUserId}: ${text}`
          );
          return NextResponse.json({ success: true });
      }

      if (text.startsWith('/link_stats')) {
          const linkId = text.replace('/link_stats', '').trim();

          if (!linkId) {
              await sendTelegramMessage(chatId, '⚠️ שימוש נכון: /link_stats <linkId>');
              return NextResponse.json({ success: true });
          }

          const stats = await getLinkAnalytics(linkId);

          if (!stats) {
              await sendTelegramMessage(chatId, '📭 אין עדיין נתוני צפייה ללינק הזה.');
              return NextResponse.json({ success: true });
          }

          const sessions = Object.values((stats as any).currentSessions || {}) as any[];
          const maxWatchSeconds = Math.max(0, ...sessions.map((s: any) => s.watchSeconds || 0));

          await sendTelegramMessage(
              chatId,
              `📊 <b>סטטיסטיקת לינק</b>\n\n` +
              `�� <b>לינק:</b> <code>${linkId}</code>\n` +
              `📡 <b>שידור:</b> <code>${(stats as any).streamName || '—'}</code>\n` +
              `🟢 <b>מחובר עכשיו:</b> ${(stats as any).isLiveNow ? 'כן' : 'לא'}\n` +
              `👁️ <b>צופים עכשיו:</b> ${(stats as any).currentViewers || 0}\n` +
              `📈 <b>שיא צפיות:</b> ${(stats as any).peakViewers || 0}\n` +
              `🌍 <b>מספר IP:</b> ${(stats as any).uniqueIpCount || 0}\n` +
              `⏱️ <b>זמן צפייה מקסימלי:</b> ${maxWatchSeconds} שניות\n` +
              `⚠️ <b>חשד לשיתוף:</b> ${(stats as any).suspectedSharing ? 'כן' : 'לא'}\n` +
              `🔁 <b>פעימות:</b> ${(stats as any).totalHeartbeats || 0}`,
              { parse_mode: 'HTML' }
          );

          return NextResponse.json({ success: true });
      }

      if (text === '/link_admin') {
          if (String(from.id) !== TELEGRAM_LINKS_SUPER_ADMIN_ID) {
              await sendTelegramMessage(chatId, '❌ אין לך הרשאה לבצע פעולה זו.');
              return NextResponse.json({ success: true });
          }

          await sendLinkAdminMenu(chatId);
          return NextResponse.json({ success: true });
      }

      if (text === '/list_pending_link_requests') {
          if (String(from.id) !== TELEGRAM_LINKS_SUPER_ADMIN_ID) {
              await sendTelegramMessage(chatId, '❌ אין לך הרשאה לבצע פעולה זו.');
              return NextResponse.json({ success: true });
          }

          const requests = await listPendingTelegramLinkAccessRequests();

          if (!requests.length) {
              await sendTelegramMessage(chatId, '📭 אין כרגע בקשות ממתינות.');
              return NextResponse.json({ success: true });
          }

          for (const req of requests) {
              const displayName =
                `${req.firstName || ''} ${req.lastName || ''}`.trim() ||
                `@${req.username || '—'}` ||
                req.telegramUserId;

              const text =
                `📨 <b>בקשה ממתינה</b>\n\n` +
                `👤 <b>שם:</b> ${displayName}\n` +
                `📛 <b>יוזר:</b> @${req.username || '—'}\n` +
                `🆔 <b>Telegram ID:</b> <code>${req.telegramUserId}</code>\n` +
                `💬 <b>Chat ID:</b> <code>${req.chatId || '—'}</code>\n` +
                `🕒 <b>נשלח:</b> ${req.requestedAt || '—'}`;

              await sendTelegramMessage(
                chatId,
                text,
                {
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ מאושר', callback_data: `approve_link_user:${req.telegramUserId}` },
                        { text: '❌ לא מאושר', callback_data: `reject_link_user:${req.telegramUserId}` }
                      ],
                      [
                        { text: '📡 חוזי', callback_data: `hozi_link_user:${req.telegramUserId}` }
                      ]
                    ]
                  }
                }
              );
          }

          return NextResponse.json({ success: true });
      }

      if (text === '/list_link_users') {
          if (String(from.id) !== TELEGRAM_LINKS_SUPER_ADMIN_ID) {
              await sendTelegramMessage(chatId, '❌ אין לך הרשאה לבצע פעולה זו.');
              return NextResponse.json({ success: true });
          }

          const users = await listApprovedTelegramLinkUsers();

          if (!users.length) {
              await sendTelegramMessage(chatId, '📭 אין משתמשים מורשים כרגע.');
              return NextResponse.json({ success: true });
          }

          let message = '📋 רשימת משתמשים מורשים:\n\n';
          users.forEach((u, i) => {
              const displayName =
                (u as any).customDisplayName?.trim() ||
                `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
                '—';

              message += `${i + 1}. ${displayName}\n`;
              message += `📛 @${u.username || '—'}\n`;
              message += `🆔 ${u.telegramUserId}\n\n`;
          });

          await sendTelegramMessage(chatId, message);
          return NextResponse.json({ success: true });
      }

      if (text.startsWith('/revoke_link_user ')) {
          if (String(from.id) !== TELEGRAM_LINKS_SUPER_ADMIN_ID) {
              await sendTelegramMessage(chatId, '❌ אין לך הרשאה לבצע פעולה זו.');
              return NextResponse.json({ success: true });
          }

          const targetTelegramUserId = text.replace('/revoke_link_user', '').trim();

          if (!targetTelegramUserId) {
              await sendTelegramMessage(chatId, '⚠️ שימוש נכון: /revoke_link_user <telegramUserId>');
              return NextResponse.json({ success: true });
          }

          await revokeTelegramUserLinkAccess({
              targetTelegramUserId,
              revokedByTelegramUserId: from.id
          });

          const req = await getTelegramLinkAccessRequest(targetTelegramUserId);
          if (req?.chatId) {
              await sendTelegramMessage(req.chatId, '⛔ ההרשאה שלך ליצירת לינקים הוסרה על ידי מנהל המערכת.');
          }

          await sendTelegramMessage(chatId, `✅ ההרשאה של המשתמש ${targetTelegramUserId} הוסרה.`);
          return NextResponse.json({ success: true });
      }

      // המשך שיחה לפי session
      if (!text.startsWith('/')) {
        if (session) {
          if (session.state === 'awaiting_email') {
            await handleEmail(chatId, text);
          } else if (session.state === 'awaiting_phone') {
            await handlePhone(chatId, text, session);
          }
        } else {
          await sendTelegramMessage(chatId, 'לא זוהתה פעולה. שלח /start כדי להתחיל מחדש.');
        }

        return NextResponse.json({ success: true });
      }
    }

    // עדכוני חברות בקבוצה/ערוץ
    const myChatMember = body.my_chat_member;
    if (myChatMember) {
      await logEvent('TELEGRAM_CHAT_MEMBER_UPDATE', JSON.stringify(myChatMember));
      return NextResponse.json({ success: true });
    }

    await logEvent('TELEGRAM_UPDATE_IGNORED', 'Ignoring non-message update.');
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('CRITICAL ERROR in /api/telegram-auth:', error);
    await sendTelegramLogMessage(`🔥 Critical error in API: ${(error as Error).message}`);
    await logEvent('TELEGRAM_WEBHOOK_ERROR', (error as Error).message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
