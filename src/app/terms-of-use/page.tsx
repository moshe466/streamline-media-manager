
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';


export default function TermsOfUsePage() {

    return (
         <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-8 text-right text-black">
                 <div className="flex justify-between items-center mb-6 border-b pb-4">
                     <Button asChild variant="outline">
                        <Link href="/login">
                           <ArrowRight className="ml-2 h-4 w-4" />
                           חזרה
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">תנאי שימוש – MIZRACHI-TV</h1>
                </div>

                <div className="prose prose-sm md:prose-base max-w-none text-right">
                    <p className="text-sm text-gray-500 mb-6 text-center">תאריך עדכון אחרון: ‏28.08.2025</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">1. מבוא</h2>
                    <p>ברוכים הבאים לאפליקציית MIZRACHI-TV (להלן: "האפליקציה"). השימוש באפליקציה כפוף לתנאי שימוש אלו. בכניסתך לאפליקציה ו/או בשימושך בשירותים, אתה מצהיר כי קראת, הבנת והסכמת לתנאים המפורטים להלן.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">2. הגדרות</h2>
                    <p>האפליקציה – MIZRACHI-TV וכל השירותים הנלווים.</p>
                    <p>משתמש – כל אדם המשתמש באפליקציה, בין אם נרשם ובין אם לא.</p>
                    <p>מפעיל האפליקציה – בעלי הזכויות באפליקציה וצוות הפיתוח המנהל אותה.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">3. שימוש באפליקציה</h2>
                    <p>השימוש באפליקציה מותר למטרות אישיות ופרטיות בלבד.</p>
                    <p>חל איסור לעשות שימוש בלתי חוקי, מסחרי או פוגעני באפליקציה.</p>
                    <p>המשתמש מתחייב שלא להפריע לפעילות התקינה של האפליקציה, לא לפרוץ, לשבש או להעתיק את תכניה ללא רשות.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">4. רישום וחשבון משתמש</h2>
                    <p>ייתכן כי לשם שימוש בשירותים מסוימים תידרש הרשמה ופתיחת חשבון.</p>
                    <p>בעת ההרשמה המשתמש מתחייב למסור פרטים נכונים, מלאים ועדכניים.</p>
                    <p>המשתמש אחראי לשמירה על סודיות פרטי ההתחברות לחשבון.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">5. תוכן משתמשים</h2>
                    <p>ייתכן שהאפליקציה תאפשר למשתמשים להעלות, לשתף או לשדר תוכן.</p>
                    <p>המשתמש מצהיר כי בידיו כל הזכויות הנדרשות בתוכן שהוא מעלה, וכי התוכן לא מפר זכויות יוצרים, סימני מסחר או זכויות צד שלישי.</p>
                    <p>המפעיל רשאי להסיר תוכן הפוגע או מפר את התנאים, לפי שיקול דעתו הבלעדי.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">6. קניין רוחני</h2>
                    <p>כל זכויות היוצרים, סימני המסחר, הפטנטים והתכנים המוצגים באפליקציה שייכים ל־MIZRACHI-TV או לצדדים שלישיים שהעניקו הרשאה. אין להעתיק, לשכפל, להפיץ או להשתמש בכל חלק מהתכנים ללא אישור מראש ובכתב.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">7. הגבלת אחריות</h2>
                    <p>האפליקציה והשירותים ניתנים כמות שהם (As-Is) וללא אחריות מכל סוג.</p>
                    <p>המפעיל אינו אחראי לנזקים עקיפים, תקלות טכניות, הפסקות שידור או אובדן נתונים.</p>
                    <p>המשתמש אחראי בלעדית לשימוש שהוא עושה באפליקציה ובשירותים.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">8. שינויים באפליקציה ובתנאים</h2>
                    <p>המפעיל שומר לעצמו את הזכות לשנות או להפסיק את פעילות האפליקציה בכל עת.</p>
                    <p>תנאי שימוש אלה עשויים להשתנות מעת לעת. פרסום הגרסה המעודכנת יהווה הודעה למשתמשים.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">9. דין ושיפוט</h2>
                    <p>על תנאי שימוש אלו יחולו דיני מדינת ישראל. מקום השיפוט הבלעדי יהיה בבתי המשפט המוסמכים במחוז תל אביב-יפו.</p>

                    <h2 className="text-xl font-semibold mt-4 mb-2">10. יצירת קשר</h2>
                    <p>לשאלות או הבהרות ניתן לפנות אלינו בכתובת:<br/>📧 office@miztachitv.co.il</p>
                </div>
            </div>
        </div>
    );
}
