
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { getMonitoredStreams, saveMonitoredStreams } from '@/services/telegram-alerts';
import { RadioTower, Save, Loader2, Search, ArrowRight, BellRing } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function TelegramPilotAlertsPage() {
    const { toast } = useToast();
    const [streams, setStreams] = useState<FlussonicStream[]>([]);
    const [monitoredNames, setMonitoredNames] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [allStreams, monitored] = await Promise.all([
                getStreams(),
                getMonitoredStreams()
            ]);
            setStreams(allStreams);
            setMonitoredNames(monitored);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleStream = (name: string, checked: boolean) => {
        if (checked) {
            setMonitoredNames(prev => [...prev, name]);
        } else {
            setMonitoredNames(prev => prev.filter(n => n !== name));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const result = await saveMonitoredStreams(monitoredNames);
        if (result.success) {
            toast({ title: 'ההגדרות נשמרו בהצלחה' });
        } else {
            toast({ variant: 'destructive', title: 'שגיאה בשמירה', description: result.error });
        }
        setIsSaving(false);
    };

    const filteredStreams = streams.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="space-y-6 text-right">
                <Skeleton className="h-10 w-64 ml-auto" />
                <Card><CardHeader><Skeleton className="h-6 w-48 ml-auto" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
            </div>
        );
    }

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
                    <h1 className="text-3xl font-bold tracking-tight">התראות "מטיס" לטלגרם</h1>
                    <p className="text-muted-foreground">
                        בחר אילו ערוצים יפיקו הודעת "מטיס עלה/ירד משידור" בקבוצת הטלגרם הייעודית.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
                        <CardTitle className="flex items-center justify-end gap-2">
                            ניהול ערוצים מנוטרים
                            <BellRing className="h-5 w-5 text-primary" />
                        </CardTitle>
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="חיפוש ערוץ..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <CardDescription>
                        ההודעות יישלחו לקבוצת המטיסים (ID: 1003777907538).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredStreams.map(stream => (
                            <div key={stream.name} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30 transition-colors">
                                <Checkbox 
                                    id={`check-${stream.name}`}
                                    checked={monitoredNames.includes(stream.name)}
                                    onCheckedChange={(checked) => handleToggleStream(stream.name, !!checked)}
                                />
                                <Label htmlFor={`check-${stream.name}`} className="flex-1 text-right mr-4 cursor-pointer">
                                    <span className="font-bold">{stream.name}</span>
                                    {stream.title && <span className="block text-xs text-muted-foreground">{stream.title}</span>}
                                </Label>
                            </div>
                        ))}
                    </div>
                    {filteredStreams.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            לא נמצאו ערוצים התואמים לחיפוש.
                        </div>
                    )}
                </CardContent>
                <CardFooter className="border-t pt-6">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                        שמור הגדרות ניטור
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
