
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/logo';
import { type PermissionRequest, getRequestById } from '@/services/requests';
import { Check, Clock, Copy, FileText, Loader2, Send, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function StatusContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const requestId = searchParams.get('reqId');

    const [request, setRequest] = useState<PermissionRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!requestId) {
            setError('מזהה בקשה לא סופק.');
            setIsLoading(false);
            return;
        }

        const fetchRequest = async () => {
            setIsLoading(true);
            try {
                const fetchedRequest = await getRequestById(requestId);
                if (!fetchedRequest) {
                    setError('לא נמצאה בקשה עבור המזהה שסופק.');
                } else {
                    setRequest(fetchedRequest);
                }
            } catch (err) {
                setError('אירעה שגיאה בטעינת סטטוס הבקשה.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchRequest();
        const intervalId = setInterval(fetchRequest, 10000); // Poll every 10 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [requestId]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast({ title: 'הקישור הועתק!', description: 'שמור אותו כדי לחזור לכאן ולבדוק את סטטוס הבקשה.' });
    };
    
    const statusConfig = {
        pending: { text: "התקבל", icon: Send, color: "text-blue-500", description: "הטופס התקבל בהצלחה! בקשתך נשלחה למנהל המערכת ותטופל בהקדם." },
        in_progress: { text: "בטיפול", icon: Clock, color: "text-yellow-500", description: "מנהל המערכת בודק את בקשתך כעת. ניצור קשר במידת הצורך." },
        approved: { text: "אושר", icon: Check, color: "text-green-500", description: "חשבונך אושר! כעת תוכל להיכנס למערכת באמצעות קוד האימות שנשלח אלייך במייל." },
        rejected: { text: "נדחה", icon: XCircle, color: "text-red-500", description: "לאחר בדיקה, לצערנו לא ניתן לאשר את בקשתך בשלב זה. לפרטים נוספים פנה למנהל." },
    };
    
    const currentStatus = request?.status || 'pending';
    const config = statusConfig[currentStatus];

    if (isLoading) {
        return <Skeleton className="w-full max-w-2xl h-96" />;
    }

    if (error) {
        return (
            <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <CardTitle className="text-destructive">שגיאה</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{error}</p>
                    <Button asChild variant="link" className="mt-4"><Link href="/questionnaire">חזור לטופס</Link></Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-2xl text-center">
            <CardHeader>
                <div className="flex justify-center mb-4">
                    <div className={cn("p-4 rounded-full bg-muted", config.color)}>
                        <config.icon className="h-10 w-10 text-background" />
                    </div>
                </div>
                <CardTitle className={cn("text-2xl", config.color)}>סטטוס הבקשה: {config.text}</CardTitle>
                <CardDescription>
                    {config.description}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="text-xs text-muted-foreground">
                    <p>שם המבקש: {request?.requestorNickname}</p>
                    <p>אימייל: {request?.requestorEmail}</p>
                </div>
                {currentStatus === 'approved' && (
                    <Button asChild size="lg">
                        <Link href="/login">כניסה למערכת</Link>
                    </Button>
                )}
            </CardContent>
            <CardContent>
                <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="ml-2 h-4 w-4" />
                    העתק קישור למעקב
                </Button>
            </CardContent>
        </Card>
    );
}

export default function QuestionnaireStatusPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-muted/20">
            <Suspense fallback={<Skeleton className="w-full max-w-2xl h-96" />}>
                <StatusContent />
            </Suspense>
        </main>
    );
}
