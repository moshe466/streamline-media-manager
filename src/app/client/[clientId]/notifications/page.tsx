

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bell, Tv, Settings, User, Save, Loader2, Link as LinkIcon, Trash2, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Client, NotificationSettings } from '@/services/clients';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { updateClientNotificationSettings, updateTelegramChats } from '@/services/clients';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


export default function ClientNotificationsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<Client | null>(null);
    const [streams, setStreams] = useState<FlussonicStream[]>([]);
    const [settings, setSettings] = useState<NotificationSettings>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const clientDataString = sessionStorage.getItem('clientData');
            if (!clientDataString) throw new Error('Client data not found');
            const clientData: Client = JSON.parse(clientDataString);
            setClient(clientData);
            setSettings(clientData.notificationSettings || {});

            const allStreams = await getStreams();
            const authorizedStreams = clientData.permissions.hasAllStreamsAccess
                ? allStreams
                : allStreams.filter(stream => Object.keys(clientData.permissions.allowedStreams || {}).includes(stream.name));
            setStreams(authorizedStreams);

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון נתונים.' });
            router.push(`/client/${clientId}/dashboard`);
        } finally {
            setIsLoading(false);
        }
    }, [clientId, router, toast]);
    
     useEffect(() => {
        const handleClientDataUpdate = () => {
            const clientDataString = sessionStorage.getItem('clientData');
             if (clientDataString) {
                setClient(JSON.parse(clientDataString));
            }
        };
        
        loadData();

        window.addEventListener('clientDataUpdated', handleClientDataUpdate);
        return () => {
             window.removeEventListener('clientDataUpdated', handleClientDataUpdate);
        }
    }, [loadData]);
    
    
    const handleSettingChange = (key: keyof NotificationSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };
    
    const handleStreamSettingChange = (type: 'onStreamOnline' | 'onStreamOffline', streamName: string, isEnabled: boolean) => {
        setSettings(prev => {
            const newStreamSettings = { ...(prev[type] || {}) };
            if (isEnabled) {
                newStreamSettings[streamName] = true;
            } else {
                delete newStreamSettings[streamName];
            }
            return { ...prev, [type]: newStreamSettings };
        });
    };
    
    const handleBulkStreamSettingChange = (type: 'onStreamOnline' | 'onStreamOffline', enableAll: boolean) => {
        if (enableAll) {
            const allStreamsEnabled = streams.reduce((acc, stream) => {
                acc[stream.name] = true;
                return acc;
            }, {} as { [streamName: string]: boolean });
            setSettings(prev => ({ ...prev, [type]: allStreamsEnabled }));
        } else {
            // Disable all by setting an empty object
            setSettings(prev => ({ ...prev, [type]: {} }));
        }
    };


    const handleSave = async () => {
        if (!client) return;
        setIsSaving(true);
        const result = await updateClientNotificationSettings(client.id, settings);
        if (result.success) {
            toast({ title: 'ההגדרות נשמרו בהצלחה!' });
            const clientDataString = sessionStorage.getItem('clientData');
            if(clientDataString) {
                const newClientData = { ...JSON.parse(clientDataString), notificationSettings: settings };
                sessionStorage.setItem('clientData', JSON.stringify(newClientData));
                 window.dispatchEvent(new Event('clientDataUpdated'));
            }
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את ההגדרות.' });
        }
        setIsSaving(false);
    };
    
     const handleTelegramDisconnect = async (chatIdToDisconnect: string) => {
        if (!client || !client.telegramChats) return;
        setIsDisconnecting(chatIdToDisconnect);
        try {
            const updatedChats = client.telegramChats.filter(chat => chat.id !== chatIdToDisconnect);
            const result = await updateTelegramChats(client.id, updatedChats);

            if (result.success) {
                toast({ title: 'החיבור לטלגרם בוטל' });
                // Update local state and session storage
                const updatedClient = { ...client, telegramChats: updatedChats };
                setClient(updatedClient);
                sessionStorage.setItem('clientData', JSON.stringify(updatedClient));
                window.dispatchEvent(new Event('clientDataUpdated'));
            } else {
                throw new Error(result.error || "Failed to disconnect Telegram chat.");
            }
        } catch (error) {
            toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
        } finally {
            setIsDisconnecting(null);
        }
    };
    
    if (isLoading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }
    
    const isTelegramConnected = client?.telegramChats && client.telegramChats.length > 0;
    const notificationsEnabled = client?.telegramNotificationsEnabled !== false; // Default to true if undefined

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <Button asChild variant="outline"><Link href={`/client/${clientId}/dashboard`}><ArrowRight className="ml-2 h-4 w-4"/>חזרה לדשבורד</Link></Button>
                <div className="text-right space-y-2"><h1 className="text-3xl font-bold tracking-tight">הגדרות התראות</h1><p className="text-muted-foreground">בחר אילו עדכונים ואירועים חשובים לקבל ישירות לטלגרם.</p></div>
            </div>

            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        <Bell className="h-5 w-5"/>
                        חיבור וניהול טלגרם
                    </CardTitle>
                     <CardDescription>
                        כאן תוכל לחבר את הבוט לקבוצות וערוצים, ולהפעיל או להשבית את קבלת ההתראות.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!isTelegramConnected ? (
                         <div className="text-center p-6 bg-muted/50 rounded-lg">
                            <p className="mb-4">כדי להתחיל, חבר את הבוט לחשבון הטלגרם שלך.</p>
                             <Button onClick={() => window.open('https://t.me/Mizrachi_TV_bot?start=connect', '_blank')}>
                                <LinkIcon className="ml-2 h-4 w-4" />
                                התחבר לבוט והתחל
                            </Button>
                         </div>
                    ) : (
                         <>
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                 <a href={`https://t.me/Mizrachi_TV_bot?start=${notificationsEnabled ? 'stop' : 'start'}`} target="_blank" rel="noopener noreferrer">
                                     <Button variant={notificationsEnabled ? 'destructive' : 'default'}>
                                        {notificationsEnabled ? <StopCircle className="ml-2 h-4 w-4" /> : <PlayCircle className="ml-2 h-4 w-4" />}
                                        {notificationsEnabled ? 'הפסק התראות' : 'הפעל התראות'}
                                    </Button>
                                 </a>
                                 <div className="text-right">
                                    <Label className="font-semibold text-base">מצב קבלת התראות</Label>
                                    <p className="text-sm text-muted-foreground">ההתראות כרגע <span className={notificationsEnabled ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{notificationsEnabled ? "פעילות" : "מושבתות"}</span>.</p>
                                 </div>
                             </div>
                             <div className="space-y-2 pt-4">
                                <Label className="font-semibold">צ'אטים מחוברים:</Label>
                                {(client.telegramChats ?? []).map(chat => (
                                     <div key={chat.id} className="flex items-center justify-between p-2 pl-1 border rounded-md bg-muted/50">
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={!!isDisconnecting}>
                                                    {isDisconnecting === chat.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                                 </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="text-right">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>לבטל את החיבור?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        פעולה זו תמנע שליחת התראות לקבוצה/ערוץ "{chat.name}". תוכל להתחבר מחדש בכל עת.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleTelegramDisconnect(chat.id)} className="bg-destructive hover:bg-destructive/90">כן, בטל חיבור</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <p className="font-medium">{chat.name}</p>
                                     </div>
                                ))}
                             </div>
                         </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center justify-end gap-2"><Tv className="h-5 w-5"/>התראות על מצב שידורים</CardTitle>
                        <CardDescription>קבל התראה כאשר שידור עולה לאוויר או יורד ממנו.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    
                     <div>
                        <div className="flex justify-between items-center mb-2">
                             <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleBulkStreamSettingChange('onStreamOnline', false)}>כבה הכל</Button>
                                <Button size="sm" variant="outline" onClick={() => handleBulkStreamSettingChange('onStreamOnline', true)}>הפעל הכל</Button>
                            </div>
                            <h4 className="font-semibold text-right">עלייה לאוויר</h4>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
                           {streams.map(stream => (
                                <div key={`online-${stream.name}`} className="flex items-center justify-end gap-2 p-2 border rounded-md">
                                     <Label htmlFor={`online-${stream.name}`} className="flex-grow text-right truncate pr-1">{stream.name}</Label>
                                    <Switch id={`online-${stream.name}`} checked={!!settings.onStreamOnline?.[stream.name]} onCheckedChange={(checked) => handleStreamSettingChange('onStreamOnline', stream.name, checked)} />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-2 mt-6">
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleBulkStreamSettingChange('onStreamOffline', false)}>כבה הכל</Button>
                                <Button size="sm" variant="outline" onClick={() => handleBulkStreamSettingChange('onStreamOffline', true)}>הפעל הכל</Button>
                            </div>
                            <h4 className="font-semibold text-right">ירידה מהאוויר</h4>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
                           {streams.map(stream => (
                                <div key={`offline-${stream.name}`} className="flex items-center justify-end gap-2 p-2 border rounded-md">
                                     <Label htmlFor={`offline-${stream.name}`} className="flex-grow text-right truncate pr-1">{stream.name}</Label>
                                    <Switch id={`offline-${stream.name}`} checked={!!settings.onStreamOffline?.[stream.name]} onCheckedChange={(checked) => handleStreamSettingChange('onStreamOffline', stream.name, checked)} />
                                </div>
                            ))}
                        </div>
                    </div>

                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center justify-end gap-2"><User className="h-5 w-5"/>התראות חשבון ומערכת</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-md">
                        <Switch id="sub-ending" checked={!!settings.onSubscriptionEnding} onCheckedChange={(checked) => handleSettingChange('onSubscriptionEnding', checked)} />
                        <Label htmlFor="sub-ending">קבל התראה 7 ימים לפני סיום המנוי</Label>
                    </div>
                     <div className="flex items-center justify-between p-3 border rounded-md">
                        <Switch id="new-stream" checked={!!settings.onNewStreamAdded} onCheckedChange={(checked) => handleSettingChange('onNewStreamAdded', checked)} />
                        <Label htmlFor="new-stream">קבל התראה כאשר מנהל מוסיף לי שידור חדש</Label>
                    </div>
                    {client?.permissions.canCreateViewers && (
                         <div className="flex items-center justify-between p-3 border rounded-md">
                            <Switch id="viewer-request" checked={!!settings.onViewerRequest} onCheckedChange={(checked) => handleSettingChange('onViewerRequest', checked)} />
                            <Label htmlFor="viewer-request">קבל התראה על בקשת גישה חדשה מצופה</Label>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="flex items-center justify-end gap-2"><Settings className="h-5 w-5"/>התראות שידורים יוצאים (Push)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                     <div className="flex items-center justify-between p-3 border rounded-md">
                        <Switch id="push-start" checked={!!settings.onPushStart} onCheckedChange={(checked) => handleSettingChange('onPushStart', checked)} />
                        <Label htmlFor="push-start">התראה כאשר מתחיל שידור יוצא (לפייסבוק, יוטיוב וכו')</Label>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-start">
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    <Save className="ml-2 h-4 w-4" />
                    שמור הגדרות
                </Button>
            </div>
        </div>
    );
}

    
