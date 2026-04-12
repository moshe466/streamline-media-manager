
import { NextResponse } from 'next/server';
import { sendTelegramLogMessage, sendTelegramMessage, getSession, createOrUpdateSession, deleteSession, sendTelegramMessageWithPhoneKeyboard, answerTelegramCallbackQuery, getTelegramChatMember, createTelegramSingleUseInviteLink } from '@/services/telegram';
import { TELEGRAM_LINKS_SUPER_ADMIN_ID } from '@/lib/telegram-config';
import { createLinkAccessRequest, approveTelegramUserLinkAccess, rejectTelegramUserLinkAccess, revokeTelegramUserLinkAccess, isTelegramUserAllowedToCreateLinks, getTelegramLinkAccessRequest, listApprovedTelegramLinkUsers, getTelegramLinkPermission, setTelegramUserCustomDisplayName, listPendingTelegramLinkAccessRequests } from '@/services/telegram-link-permissions';
import { LINKS_GROUP_CHAT_ID, PILOT_ALERTS_GROUP_ID } from '@/lib/telegram-config';
import { logEvent } from '@/services/logger';
import { getDb } from '@/lib/firebase-admin';
import type { Client } from '@/services/clients';
import { getSystemCredentials, getUserById, updateUser } from '@/services/users';
import { getAuthCodeDetails } from '@/services/telegram-auth';
import { createSecureLink } from '@/services/secure-links';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
      const session = await getSession(chatId);

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
      const isSuperAdmin = String(from.id) === TELEGRAM_LINKS_SUPER_ADMIN_ID;

      try {
        await answerTelegramCallbackQuery(callbackId);
      } catch (e) {
        console.error('Failed to answer callback query:', e);
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
          const result = await createSecureLink(streamName, 'default', actorName);
          console.log('CREATE LINK RESULT', result);

          if (!result.success || !result.id) {
            await sendTelegramMessage(chatId, '❌ יצירת הלינק נכשלה.');
            return NextResponse.json({ success: true });
          }

          const watchUrl = `https://app.mizrachitv.co.il/watch/${result.id}`;

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

      if (text === '/link_admin') {
          if (String(from.id) !== TELEGRAM_LINKS_SUPER_ADMIN_ID) {
              await sendTelegramMessage(chatId, '❌ אין לך הרשאה לבצע פעולה זו.');
              return NextResponse.json({ success: true });
          }

          await sendTelegramMessage(
              chatId,
              '🛠️ תפריט ניהול הרשאות לינקים',
              {
                  reply_markup: {
                      inline_keyboard: [
                          [{ text: '➕ שלח לינק לבקשת הרשאה', callback_data: 'link_admin:send_request_link' }],
                          [{ text: '⏳ בקשות ממתינות', callback_data: 'link_admin:pending_requests' }],
                          [{ text: '📋 רשימת משתמשים מורשים', callback_data: 'link_admin:list_users' }],
                          [{ text: '✏️ שנה שם למשתמש', callback_data: 'link_admin:rename_menu' }],
                          [{ text: '❌ הסר הרשאה ממשתמש', callback_data: 'link_admin:revoke_menu' }]
                      ]
                  }
              }
          );

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
