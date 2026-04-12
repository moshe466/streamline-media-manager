
'use server';

import { getDb } from '@/lib/firebase-admin';
import type { Client, ClientPermissions } from './clients';

const getMailCollection = () => getDb().collection('mail');

const UH_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Ff2ab28a1-9ed3-4c7c-8120-75ed9dbb5894.png?alt=media&token=a6d81473-5fa3-4869-b8d1-a6277e01033a";
const STANDARD_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

/**
 * Creates a document in the 'mail' collection to be processed by the Trigger Email extension.
 * @param email The recipient's email address.
 * @param subject The subject of the email.
 * @param html The HTML content of the email.
 * @returns A promise that resolves to an object indicating success or failure.
 */
async function sendEmailViaTrigger(email: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
    try {
        await getMailCollection().add({
            to: [email],
            message: {
                subject,
                html,
            },
        });
        console.log(`Email document created for ${email} with subject "${subject}"`);
        return { success: true };
    } catch (error) {
        console.error('Failed to create email document in Firestore:', error);
        return { success: false, error: 'Failed to trigger email send.' };
    }
}


/**
 * Sends a simple invitation email to fill out the questionnaire.
 * This email does NOT contain an OTP.
 * @param email The recipient's email address.
 * @param name The recipient's name for the greeting.
 * @returns A promise that resolves to an object indicating success or failure.
 */
export async function sendInvitationEmail(email: string, name: string): Promise<{ success: boolean, error?: string }> {
     const emailHtml = `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px;">
        <h2 style="color: #4a4a4a;">ברוך הבא לפלטפורמת השידורים של Mizrachi-TV!</h2>
        <p>שלום, ${name} 🙌</p>
        <p>
            תודה שהתעניינת במערכת הניהול וההזרמה של <strong>Mizrachi-TV</strong> – הפלטפורמה שמעניקה לך את כל הכלים לניהול שידורים חיים, הקלטות, וצופים – בצורה פשוטה, חכמה ומותאמת בדיוק לצרכים שלך.
        </p>
        <p>
            על מנת שנוכל להפעיל עבורך את השירות ולהתאים אותו אישית, נשמח שתמלא את טופס ההרשמה הראשוני.
        </p>
        <p style="text-align: center;">
            <a href="https://app.mizrachitv.co.il/questionnaire" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            למעבר לטופס ההרשמה
            </a>
        </p>
        <p>לאחר מילוי הטופס, ניצור עבורך כרטיס לקוח ונעדכן אותך בהמשך.</p>
        <p>בברכה,<br>צוות Mizrachi-TV</p>
        <hr>
        <small style="color: gray;">
            הודעה זו נשלחה באופן אוטומטי ממערכת ניהול הלקוחות של Mizrachi-TV.
        </small>
      </div>
    `;

    return await sendEmailViaTrigger(email, `הזמנה להצטרפות ל-Mizrachi-TV`, emailHtml);
}


/**
 * Generates an OTP and sends a verification email.
 * This function is for direct user/viewer creation where an immediate code is needed.
 * @returns The generated OTP code, or null if the process failed.
 */
export async function sendVerificationEmail(email: string, name: string, portal: 'uh' | 'standard' = 'standard'): Promise<{ otpCode: string | null, error?: string }> {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const isUh = portal === 'uh';
    const logoUrl = isUh ? UH_LOGO_URL : STANDARD_LOGO_URL;
    const brandName = isUh ? "יחידת הרחפנים - איחוד הצלה" : "Mizrachi-TV";
    const primaryColor = isUh ? "#000000" : "#1E3A8A";
    const accentColor = isUh ? "#333333" : "#2563EB";

    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #eeeeee;">
          <div style="background-color: ${primaryColor}; padding: 20px; text-align: center;">
            <img src="${logoUrl}" alt="${brandName}" style="max-width: 180px; max-height: 90px; object-fit: contain;">
          </div>
          <div style="padding: 30px;">
            <h2 style="color: ${primaryColor}; margin-top: 0;">קוד אימות לכניסה</h2>
            <p>שלום ${name},</p>
            <p>קוד האימות שלך לכניסה למערכת <strong>${brandName}</strong> הוא:</p>
            <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; border: 1px dashed #cccccc;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: ${primaryColor}; font-family: monospace;">${otpCode}</span>
            </div>
            <p>השתמש בקוד זה ובכתובת המייל שלך כדי להתחבר לממשק הניהול והצפייה.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.mizrachitv.co.il${isUh ? '/uh' : '/login'}" style="background-color: ${accentColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    כניסה למערכת
                </a>
            </div>
            <p style="font-size: 13px; color: #666666;">אם לא ביקשת קוד זה, ניתן להתעלם מהודעה זו בבטחה.</p>
          </div>
          <div style="background-color: #eeeeee; text-align: center; padding: 15px; font-size: 12px; color: #888888;">
            <p>© כל הזכויות שמורות ל-${brandName}</p>
          </div>
        </div>
      </div>
    `;

    const result = await sendEmailViaTrigger(email, `קוד אימות עבור ${brandName}`, emailHtml);

    if (result.success) {
        return { otpCode };
    } else {
        return { otpCode: null, error: result.error };
    }
}


export async function sendPermissionApprovedEmail(email: string, name: string, message: string): Promise<{ success: boolean, error?: string }> {
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2FLOGO.jpg?alt=media&token=3afeaf3f-82d1-48aa-bbd2-30e813169e6d";

    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; background-color: #f7f7f7; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1E3A8A; padding: 20px; text-align: center;">
            <img src="${logoUrl}" alt="Mizrachi TV Logo" style="max-width: 180px;">
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #1E3A8A;">שלום ${name},</h2>
            <p style="color: #333333; line-height: 1.6;">${message}</p>
            <p style="color: #333333; line-height: 1.6;">כעת תוכל להתחבר שוב למערכת עם קוד האימות המקורי שלך (אם הוא עדיין לא נוצל) או לבקש קוד חדש ממסך הכניסה.</p>
            <div style="text-align: center; margin: 20px 0;">
                <a href="https://app.mizrachitv.co.il" style="background-color: #2563EB; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">לכניסה למערכת</a>
            </div>
            <p style="color: #555555; line-height: 1.6; font-size: 14px;">תודה רבה!</p>
          </div>
          <div style="background-color: #eeeeee; text-align: center; padding: 15px; font-size: 12px; color: #666666;">
             <p>צוות Mizrachi-TV<br>לשירותי שידור • צילום • אולפני שטח<br><a href="https://www.mizrachitv.co.il" style="color: #666;">www.mizrachitv.co.il</a></p>
            <p>זוהיו הודעה אוטומטית, אין להשיב למייל זה.</p>
          </div>
        </div>
      </div>
    `;

    return await sendEmailViaTrigger(email, 'הגישה שלך למערכת חודשה', emailHtml);
}

/**
 * Sends a summary email to a client after their permissions have been set or updated.
 * @param client The client object.
 * @param isNewClient A boolean to indicate if a welcome message should be included.
 */
export async function sendApprovalAndSummaryEmail(client: Client, isNewClient: boolean): Promise<{ success: boolean; error?: string }> {
    const permissions = client.permissions;
    const permissionsList: string[] = [];

    if(permissions.canCreateStreams) permissionsList.push(`יצירת שידורים חדשים (עד ${permissions.maxStreams === Infinity ? 'ללא הגבלה' : permissions.maxStreams})`);
    if(permissions.canDeleteStreams) permissionsList.push('מחיקת שידורים');
    if(permissions.canCreateViewers) permissionsList.push('יצירת צופים');
    if(permissions.hasAllStreamsAccess) {
        permissionsList.push('גישה לכל השידורים');
    } else {
        const allowedCount = Object.keys(permissions.allowedStreams || {}).length;
        if(allowedCount > 0) permissionsList.push(`גישה ל-${allowedCount} שידורים ספציפיים`);
    }

    const permissionItemsHtml = permissionsList.length > 0
        ? `<ul>${permissionsList.map(p => `<li style="margin-right: 20px;">• ${p}</li>`).join('')}</ul>`
        : "<p>לא הוגדרו הרשאות מיוחדות.</p>";

    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; line-height: 1.6;">
        <p>שלום ${client.nickname},</p>
        ${isNewClient ? `
          <h2 style="color: #1E3A8A;">ברוך הבא למערכת הניהול של Mizrachi-TV!</h2>
          <p>שמחים לבשר כי חשבונך הוגדר בהצלחה.</p>
        ` : `
          <h2 style="color: #1E3A8A;">עדכון הרשאות</h2>
          <p>הרשאות החשבון שלך עודכנו על ידי מנהל המערכת.</p>
        `}
        <p>להלן פרטי הגישה שלך:</p>
        <div style="background-color: #f2f2f2; padding: 15px; border-radius: 5px;">
            <p><strong>📧 כתובת מייל:</strong> ${client.email}</p>
            ${isNewClient ? `<p><strong>🔐 סיסמה (קוד חד-פעמי):</strong> <span style="font-size: 18px; font-weight: bold; color: #1E3A8A;">${client.otp}</span></p>` : ''}
            <p><strong>🔗 קישור ישיר למערכת:</strong> <a href="https://app.mizrachitv.co.il">app.mizrachitv.co.il</a></p>
        </div>
        
        <h3 style="color: #1E3A8A; margin-top: 20px;">🚀 הרשאות שהוגדרו עבורך:</h3>
        ${permissionItemsHtml}

        <p style="margin-top: 20px;">אם נתקלת בשאלה או בקושי – אנחנו כאן לעזור.</p>
        <p>בהצלחה!<br>צוות Mizrachi-TV 🎥</p>
        <hr>
        <p><strong>כתובת:</strong> ברנר 7 רחובות<br><strong>טלפון:</strong> 058-5948911</p>
      </div>
    `;

    const subject = isNewClient ? `ברוך הבא ל-Mizrachi-TV, ${client.nickname}!` : 'עדכון הרשאות בחשבונך';

    return await sendEmailViaTrigger(client.email, subject, emailHtml);
}

/**
 * Sends an email to the client when their WebRTC broadcast access is enabled.
 * @param client The client object containing email, nickname, and WebRTC credentials.
 */
export async function sendBroadcastAccessEmail(client: Client): Promise<{ success: boolean; error?: string }> {
    const { email, nickname, webrtcUsername, webrtcPassword } = client;

    if (!webrtcUsername || !webrtcPassword) {
        return { success: false, error: 'Missing WebRTC credentials for the client.' };
    }

    const broadcastLoginUrl = 'https://app.mizrachitv.co.il/live-broadcast';
    const emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; line-height: 1.6;">
            <h2 style="color: #1E3A8A;">🚀 גישה לשידור חי מהדפדפן הופעלה!</h2>
            <p>שלום ${nickname},</p>
            <p>שמחים לעדכן שהפעלנו עבורך את האפשרות לשדר ישירות מהמחשב או מהטלפון הנייד, ללא צורך בתוכנה חיצונית.</p>
            <p>להלן פרטי ההתחברות לממשק השידור:</p>
            <div style="background-color: #f2f2f2; padding: 15px; border-radius: 5px; text-align: right;">
                <p><strong>👤 שם משתמש:</strong> ${webrtcUsername}</p>
                <p><strong>🔑 סיסמה:</strong> ${webrtcPassword}</p>
            </div>
             <p style="text-align: center; margin: 20px 0;">
                <a href="${broadcastLoginUrl}" style="background-color: #2563EB; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    כניסה לממשק השידור
                </a>
            </p>
            <p style="margin-top: 20px;">שמור פרטים אלו במקום בטוח. הם ישמשו אותך בכל פעם שתרצה להתחיל שידור.</p>
            <p>בברכה,<br>צוות Mizrachi-TV</p>
        </div>
    `;

    const subject = 'הופעלה עבורך גישה לשידור חי מהדפדפן';
    return await sendEmailViaTrigger(email, subject, emailHtml);
}
