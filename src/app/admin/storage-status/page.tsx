
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { testStorageConnectionAction, initializeStorageAction } from "@/actions/storage-actions";
import { CheckCircle2, AlertCircle, Server, Copy, ClipboardCheck, Loader2, Database, FolderSync } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type TestResult = {
    success: boolean;
    [key: string]: any;
};

export default function StorageStatusPage() {
    const [storageResult, setStorageResult] = useState<TestResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const runTest = async () => {
            setIsLoading(true);
            const result = await testStorageConnectionAction();
            setStorageResult(result);
            setIsLoading(false);
        };
        runTest();
    }, []);

    const handleCopy = (data: any) => {
        if (!data) return;
        const logText = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(logText).then(() => {
            setIsCopied(true);
            toast({ title: 'הלוג הועתק ללוח' });
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    
    const handleInitializeStorage = async () => {
        setIsInitializing(true);
        toast({ title: 'מתחיל אתחול Storage...' });
        try {
            const result = await initializeStorageAction();
            if (result.success) {
                toast({
                    title: 'אתחול הושלם',
                    description: 'תיקיות הבסיס נוצרו בהצלחה ב-Storage.',
                });
            } else {
                 throw new Error(result.error || 'Failed to initialize storage.');
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'שגיאה באתחול',
                description: (error as Error).message,
            });
        } finally {
            setIsInitializing(false);
        }
    };

    const renderResult = (result: TestResult | null) => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-end gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="font-bold text-lg">בודק חיבור...</span>
                </div>
            );
        }
        if (!result) {
             return (
                <div className="flex items-center gap-2 text-yellow-500">
                    <AlertCircle className="h-6 w-6" />
                    <span className="font-bold text-lg">לא התקבלה תוצאה</span>
                </div>
            );
        }
        if (result.success) {
            return (
                <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-bold text-lg">חיבור תקין</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-6 w-6" />
                <span className="font-bold text-lg">כשל בחיבור</span>
            </div>
        );
    };

    return (
        <div className="space-y-8 text-right">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">סטטוס Firebase Storage</h1>
                <p className="text-muted-foreground">אבחון חיבור ויצירת תיקיות בסיס בשירות האחסון.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-end gap-3">
                        {renderResult(storageResult)}
                        <CardTitle>חיבור ל-Cloud Storage</CardTitle>
                    </div>
                     <CardDescription>
                        בדיקה זו מנסה לכתוב ולקרוא קובץ זמני ב-Firebase Storage כדי לוודא שההרשאות והחיבור תקינים.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="p-4 bg-muted rounded-md border text-right dir-ltr">
                        <div className="flex justify-between items-center mb-2">
                             <Button variant="ghost" size="icon" onClick={() => handleCopy(storageResult)} disabled={!storageResult}>
                                {isCopied ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </Button>
                            <h4 className="text-lg font-semibold text-right">לוג מהשרת:</h4>
                        </div>
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                           {isLoading ? (
                                <Skeleton className="h-24 w-full" />
                            ) : (
                                storageResult ? JSON.stringify(storageResult, null, 2) : "אין נתונים להצגה."
                            )}
                        </pre>
                    </div>
                </CardContent>
                 {storageResult?.success && (
                    <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                        <div className="text-right">
                            <h3 className="font-semibold">שלב הבא: אתחול תיקיות</h3>
                            <p className="text-sm text-muted-foreground">
                                לחץ על הכפתור כדי לוודא שתיקיות הבסיס (`receipts`, `client-documents`) קיימות ב-Storage. הפעולה תיצור אותן אם הן לא קיימות.
                            </p>
                        </div>
                        <Button onClick={handleInitializeStorage} disabled={isInitializing}>
                             {isInitializing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FolderSync className="ml-2 h-4 w-4" />}
                            אתחל תיקיות Storage
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
