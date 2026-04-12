
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function PrivacyPolicyPage() {
    const pathname = usePathname();
    const isAdminPath = pathname.startsWith('/admin');

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-8 text-right text-black">
                 <div className="flex justify-between items-center mb-6 border-b pb-4">
                     <Button asChild variant="outline">
                        <Link href={isAdminPath ? "/admin/development" : "/login"}>
                           <ArrowRight className="ml-2 h-4 w-4" />
                           חזרה
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">מדיניות הפרטיות של האפליקציה</h1>
                </div>

                <div className="prose prose-sm md:prose-base max-w-none text-right">
                    <p className="text-sm text-gray-500 mb-6 text-center">תאריך עדכון אחרון: ‏28.08.2025</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">1. מבוא</h2>
                    <p>ברוכים הבאים לאפליקציית MIZRACHI-TV (להלן: "האפליקציה"). אנו מכבדים את פרטיות המשתמשים שלנו ומתחייבים להגן על המידע האישי שנאסף בעת השימוש באפליקציה ובשירותינו. מדיניות פרטיות זו נועדה להסביר אילו נתונים נאספים, כיצד אנו משתמשים בהם ומהן זכויותיך ביחס לנתונים אלו.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">2. איזה מידע אנו אוספים</h2>
                    <p>בעת שימוש באפליקציה ייאסף מידע מסוגים שונים, כולל:</p>
                    <ul className="list-disc list-inside mr-4">
                        <li><strong>מידע אישי שנמסר על ידך</strong> – שם מלא, כתובת אימייל, מספר טלפון, פרטי חשבון משתמש.</li>
                        <li><strong>מידע טכני</strong> – סוג מכשיר, מערכת הפעלה, כתובת IP, גרסת האפליקציה, קבצי עוגיות (Cookies).</li>
                        <li><strong>מידע על שימוש</strong> – אופן השימוש באפליקציה, צפייה בשידורים, פעולות שבוצעו.</li>
                    </ul>

                    <h2 className="text-xl font-semibold mt-4 mb-2">3. שימוש במידע</h2>
                    <p>המידע שנאסף ישמש לצרכים הבאים:</p>
                    <ul className="list-disc list-inside mr-4">
                        <li>מתן שירותי האפליקציה ותפעול תקין.</li>
                        <li>שיפור חוויית המשתמש והתאמת השירות לצרכיך.</li>
                        <li>אבטחת המידע וזיהוי משתמשים מורשים.</li>
                        <li>שליחת עדכונים, התראות או הצעות שיווקיות (בכפוף להסכמה מראש).</li>
                    </ul>

                    <h2 className="text-xl font-semibold mt-4 mb-2">4. שמירת מידע ואבטחה</h2>
                    <p>אנו נוקטים באמצעים טכנולוגיים וארגוניים מקובלים כדי להגן על המידע האישי שלך מפני גישה בלתי מורשית, שימוש לרעה או אובדן.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">5. שיתוף מידע עם צדדים שלישיים</h2>
                    <p>איננו משתפים מידע אישי עם צדדים שלישיים, אלא במקרים הבאים:</p>
                    <ul className="list-disc list-inside mr-4">
                        <li>כאשר קיים צורך לצורך מתן השירות (לדוגמה ספקי אחסון נתונים).</li>
                        <li>כאשר קיימת חובה חוקית או דרישה של רשות מוסמכת.</li>
                        <li>לצורך הגנה על זכויותינו המשפטיות.</li>
                    </ul>

                    <h2 className="text-xl font-semibold mt-4 mb-2">6. זכויות המשתמש</h2>
                    <p>כמשתמש באפליקציה עומדות לך הזכויות הבאות:</p>
                    <ul className="list-disc list-inside mr-4">
                        <li>לעיין במידע שנשמר עליך.</li>
                        <li>לבקש תיקון או מחיקה של מידע שגוי.</li>
                        <li>לבקש להפסיק קבלת דיוור שיווקי.</li>
                    </ul>

                    <h2 className="text-xl font-semibold mt-4 mb-2">7. שימוש בעוגיות (Cookies)</h2>
                    <p>האפליקציה עשויה להשתמש בקובצי Cookies ו/או טכנולוגיות דומות לצורך תפעול שוטף, איסוף סטטיסטיקות ושיפור השירות.</p>

                    <h2 className="text_xl font-semibold mt-4 mb-2">8. שינויי מדיניות</h2>
                    <p>אנו שומרים לעצמנו את הזכות לעדכן מעת לעת את מדיניות הפרטיות. גרסה מעודכנת תפורסם באפליקציה או באתר הנחיתה.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">9. יצירת קשר</h2>
                    <p>לשאלות או בקשות בנוגע למדיניות זו ניתן לפנות אלינו בכתובת:<br/>📧 office@mizrachitv.co.il</p>
                </div>
            </div>
        </div>
    );
}
