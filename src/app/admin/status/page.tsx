
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { testFirestoreConnectionAction } from "@/actions/test-firestore-action";
import { checkFlussonicStatus } from '@/services/flussonic';
import { CheckCircle2, AlertCircle, Server, Copy, ClipboardCheck, Loader2, Database, ArrowRight, Lock } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function StatusPage() {
    const [firestoreResult, setFirestoreResult] = useState<any>(null);
    const [flussonicResult, setFlussonicResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const userRole = sessionStorage.getItem('userRole');
        if (userRole !== 'super-admin') {
            setIsAuthorized(false);
            setIsLoading(false);
            return;
        }
        setIsAuthorized(true);

        const runTests = async () => {
            const [fsResult, flussonicStatus] = await Promise.all([
                testFirestoreConnectionAction(),
                checkFlussonicStatus()
            ]);
            setFirestoreResult(fsResult);
            setFlussonicResult(flussonicStatus);
            setIsLoading(false);
        };
        runTests();
    }, []);

    if (!isAuthorized && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <Lock className="h-12 w-12 text-muted-foreground" />
                <h1 className="text-2xl font-bold">גישה מוגבלת</h1>
                <p className="text-muted-foreground">דף הסטטוס זמין למנהל ראשי בלבד מטעמי אבטחה.</p>
                <Button asChild><Link href="/admin/dashboard">חזרה ללוח המחוונים</Link></Button>
            </div>
        );
    }

    // ... [Rest of the existing render logic for StatusPage] ...
    return (
        <div className="space-y-8 text-right">
            <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href="/admin/development">
                       <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">סטטוס מערכת</h1>
            </div>
            
            <Card>
                <CardHeader><CardTitle>חיבור לשרת Flussonic</CardTitle></CardHeader>
                <CardContent>
                    <div className="p-4 bg-muted rounded-md border dir-ltr">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                        {isLoading ? <Skeleton className="h-10 w-full" /> : JSON.stringify(flussonicResult, null, 2)}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>חיבור ל-Firestore</CardTitle></CardHeader>
                <CardContent>
                    <div className="p-4 bg-muted rounded-md border dir-ltr">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                            {isLoading ? <Skeleton className="h-24 w-full" /> : JSON.stringify(firestoreResult, null, 2)}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
