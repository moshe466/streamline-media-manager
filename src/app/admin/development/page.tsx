
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Server, TestTube2, UploadCloud, ArrowRight, Lock, KeyRound, Loader2, Image as ImageIcon, Briefcase, Wand2, Shield, DatabaseZap, BellRing } from 'lucide-react';
import Link from 'next/link';
import { getUserById } from '@/services/users';

const DEV_ACCESS_CODE = '1560';

type ToolCardProps = {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    target?: string;
};

const ToolCard = ({ title, description, icon: Icon, href, target }: ToolCardProps) => (
    <Card className="hover:border-primary/50 hover:bg-muted/30 transition-colors">
        <Link href={href} target={target} className="flex flex-col h-full">
            <CardHeader>
                <div className="flex justify-end items-center gap-4">
                    <div className="text-right">
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                </div>
            </CardHeader>
            <CardFooter className="mt-auto">
                <Button variant="secondary" className="w-full justify-start">
                    <ArrowRight className="ml-2 h-4 w-4" />
                    עבור לדף
                </Button>
            </CardFooter>
        </Link>
    </Card>
);


export default function DevelopmentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [accessCode, setAccessCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const userId = sessionStorage.getItem('userId');
            if (!userId) {
                router.push('/login');
                return;
            }
            const user = await getUserById(userId);
            if (!user || (user.role !== 'super-admin' && user.role !== 'admin')) {
                toast({ variant: 'destructive', title: 'אין הרשאה', description: 'דף זה זמין למנהלים בלבד.' });
                router.push('/admin/dashboard');
            }
        };
        checkAuth();
    }, [router, toast]);
    
    const handleAccess = (e?: React.FormEvent) => {
        e?.preventDefault();
        setIsLoading(true);
        if (accessCode === DEV_ACCESS_CODE) {
            toast({ title: 'הגישה אושרה' });
            setIsAuthorized(true);
        } else {
            toast({ variant: 'destructive', title: 'קוד שגוי', description: 'קוד הגישה שהוזן אינו נכון.' });
            setAccessCode('');
        }
        setIsLoading(false);
    };

    if (!isAuthorized) {
        return (
            <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
                <Card className="w-full max-w-sm text-right">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-end gap-2">
                           <Lock className="h-5 w-5" />
                           איזור מוגן למפתחים
                        </CardTitle>
                        <CardDescription>אנא הזן את קוד הגישה כדי להמשיך.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleAccess}>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="access-code">קוד הגישה</Label>
                                <Input 
                                    id="access-code" 
                                    type="password" 
                                    dir="ltr" 
                                    value={accessCode}
                                    onChange={(e) => setAccessCode(e.target.value)}
                                    className="text-center tracking-[8px]"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                                <KeyRound className="ml-2 h-4 w-4" />
                                כניסה
                            </Button>
                            <Button variant="link" className="w-full" asChild>
                                <Link href="/admin/dashboard">
                                    חזרה לדף הבית
                                </Link>
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        );
    }


    const devTools = [
        { title: 'סטטוס מערכת', description: 'אבחון חיבורים ל-Flussonic ו-Firestore', icon: Server, href: '/admin/status' },
        { title: 'סטטוס Storage', description: 'בדיקת חיבור והרשאות לאחסון קבצים', icon: UploadCloud, href: '/admin/storage-status' },
        { title: 'אבחון שידורים', description: 'קבלת נתונים טכניים מלאים על שידור ספציפי', icon: TestTube2, href: '/admin/stream-tests' },
        { title: 'לוגים', description: 'מעקב אחר כל הפעולות והאירועים במערכת', icon: FileText, href: '/admin/logs' },
        { title: 'ניהול לוגו ברירת מחדל', description: 'הגדרת הלוגו הראשי והלוגו למצב אופליין', icon: ImageIcon, href: '/admin/default-logos' },
        { title: 'התראות מטיס (טלגרם)', description: 'ניהול ערוצים המפעילים התראות בקבוצת המטיסים.', icon: BellRing, href: '/admin/telegram-alerts' },
        { title: 'חשבוניות וחיוב לקוח', description: 'בדיקות חיובים, יצירת מסמכים וחיפוש לקוחות במערכת החיובים.', icon: Briefcase, href: '/admin/billing-test' },
        { title: 'טופס הרשמה ללקוח', description: 'קישור ישיר לשאלון הצטרפות והגדרת לקוח חדש.', icon: FileText, href: '/questionnaire', target: '_blank' },
        { title: 'ניהול סיור וירטואלי', description: 'עריכת התוכן והשלבים של סיור ההדרכה ללקוחות.', icon: Wand2, href: '/admin/virtual-tour' },
        { title: 'מדיניות הפרטיות', description: 'צפייה ועריכת מסמך מדיניות הפרטיות', icon: Shield, href: '/privacy-policy', target: '_blank' },
        { title: 'שחזור מסד נתונים', description: 'שחזור נתונים שנמחקו מה-archive.', icon: DatabaseZap, href: '/admin/restore' },
    ];

    return (
        <div className="space-y-8 text-right">
             <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">כלי פיתוח ואבחון</h1>
                <p className="text-muted-foreground">
                    מקבץ כלים לבדיקה וניטור של תקינות המערכת.
                </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {devTools.map(tool => <ToolCard key={tool.href} {...tool} />)}
            </div>
        </div>
    );
}
