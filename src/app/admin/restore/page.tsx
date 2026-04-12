
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DatabaseZap, AlertTriangle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { restoreFromArchive } from '@/actions/restore-from-archive-action';
import Link from 'next/link';

export default function RestorePage() {
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreLog, setRestoreLog] = useState<string[]>([]);
    const { toast } = useToast();

    const handleRestore = async () => {
        setIsRestoring(true);
        setRestoreLog([]);

        try {
            const result = await restoreFromArchive();
            setRestoreLog(result.logs);

            if (result.success) {
                toast({
                    title: 'השחזור הושלם בהצלחה!',
                    description: `שוחזרו ${result.restoredCount} מסמכים.`,
                });
            } else {
                throw new Error(result.error || 'An unknown error occurred during restoration.');
            }
        } catch (e: any) {
             toast({
                variant: 'destructive',
                title: 'שגיאה חמורה בשחזור',
                description: e.message,
            });
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-8 text-right">
             <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href="/admin/development">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לכלי פיתוח
                    </Link>
                </Button>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">שחזור מסד נתונים</h1>
                    <p className="text-muted-foreground">
                        כלי לשחזור מסמכים שנמחקו והועברו לארכיון.
                    </p>
                </div>
            </div>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        אזהרה: פעולה בלתי הפיכה
                    </CardTitle>
                    <CardDescription>
                        תהליך השחזור יקרא את כל המסמכים מהקולקציה `deleted_archive` וינסה לכתוב אותם חזרה למקומם המקורי.
                        פעולה זו עלולה לדרוס נתונים קיימים אם נוצרו מסמכים חדשים עם אותו מזהה (ID) מאז המחיקה.
                        <strong>יש להשתמש בכלי זה בזהירות מירבית ורק לאחר הבנת ההשלכות.</strong>
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                     <Button variant="destructive" onClick={handleRestore} disabled={isRestoring}>
                        {isRestoring ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="ml-2 h-4 w-4" />}
                        {isRestoring ? 'משחזר...' : 'אני מבין את הסיכון, התחל בשחזור'}
                    </Button>
                </CardFooter>
            </Card>

            {(isRestoring || restoreLog.length > 0) && (
                <Card>
                    <CardHeader>
                        <CardTitle>לוג שחזור</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="w-full h-64 p-4 bg-muted/50 rounded-md text-xs overflow-auto font-mono text-left dir-ltr">
                            {restoreLog.map((log, index) => (
                                <p key={index} className={log.startsWith('ERROR') || log.startsWith('CRITICAL') ? 'text-red-400' : ''}>{log}</p>
                            ))}
                            {isRestoring && <p className="animate-pulse">Restoring...</p>}
                        </pre>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
