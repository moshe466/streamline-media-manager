

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowRight, Power, PowerOff, Save, Loader2, PlusCircle, Trash2, Video, Clapperboard, Play, StopCircle, Edit, CheckSquare, FileSignature, Copy, ClipboardCheck, AlertTriangle, Settings2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AuthContext } from "@/services/security";
import { getStreamDetails, updateStream, getDvrConfigs, updateStreamMetadata, getFlussonicConnectionDetails } from "@/services/flussonic";
import type { StreamDetails, StreamPush, PushStatus, ProtocolOptions, DvrConfig } from '@/services/flussonic-types';
import { getClientById, type Client } from '@/services/clients';
import { StreamInfoCard } from "@/components/dashboard/stream-info-card";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StreamStatsChart } from '@/components/dashboard/stream-stats-chart';
import { StreamPreviewImage } from '@/components/dashboard/stream-preview-image';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogClose, DialogContent as DialogPrimitiveContent, DialogDescription, DialogFooter as DialogPrimitiveFooter, DialogHeader as DialogPrimitiveHeader, DialogTitle as DialogPrimitiveTitle, DialogTrigger as DialogPrimitiveTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

type EditableStreamPush = Omit<StreamPush, 'url'> & { 
    id: string;
    name?: string;
    rtmp_url?: string;
    stream_key?: string;
};

type ClientStreamPermissions = NonNullable<Client['permissions']['allowedStreams'][string]>;

const parsePushUrl = (url: string): { rtmp_url: string; stream_key: string } => {
    if (!url) return { rtmp_url: '', stream_key: '' };
    const parts = url.split('/');
    if (parts.length > 3 && (url.startsWith('rtmp://') || url.startsWith('rtmps://'))) {
        const stream_key = parts.pop() || '';
        const rtmp_url = parts.join('/');
        return { rtmp_url, stream_key };
    }
    return { rtmp_url: url, stream_key: '' };
};

const combinePushUrl = (rtmp_url?: string, stream_key?: string): string => {
    const finalUrl = (rtmp_url || '').trim();
    const finalKey = (stream_key || '').trim();
    if (!finalUrl && !finalKey) return '';
    if (finalUrl && !finalKey) return finalUrl;
    if (!finalUrl && finalKey) return `/${finalKey}`;
    const trimmedUrl = finalUrl.endsWith('/') ? finalUrl.slice(0, -1) : finalUrl;
    const trimmedKey = finalKey.startsWith('/') ? finalKey.slice(1) : finalKey;
    return `${trimmedUrl}/${trimmedKey}`;
};

const ALL_PROTOCOLS = ['hls', 'rtmp', 'srt', 'webrtc', 'dash', 'jpeg', 'mss', 'api', 'm4f', 'm4s', 'mseld', 'shoutcast', 'tshttp', 'cmaf', 'player', 'whitelist', 'rtsp'];

export default function ClientStreamDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    
    const clientIdFromUrl = decodeURIComponent(params.clientId as string);
    const currentStreamName = decodeURIComponent(params.streamName as string);
    
    const [permissions, setPermissions] = useState<ClientStreamPermissions | null>(null);
    const [maxPushDestinations, setMaxPushDestinations] = useState(1);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [currentSourceUrl, setCurrentSourceUrl] = useState('');
    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    
    const [dvrConfigs, setDvrConfigs] = useState<DvrConfig[]>([]);

    const [liveData, setLiveData] = useState<{ details: StreamDetails | null }>({ details: null });
    
    const [isDvrSwitchOn, setIsDvrSwitchOn] = useState(false);
    const [editablePushes, setEditablePushes] = useState<EditableStreamPush[]>([]);
    
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [actioningStream, setActioningStream] = useState<string | null>(null);
    
    const [flussonicPublicHost, setFlussonicPublicHost] = useState('');

    const auth: AuthContext = {
        userId: sessionStorage.getItem('userId') || sessionStorage.getItem('clientId') || '',
        sessionId: sessionStorage.getItem('activeSessionId') || ''
    };


    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const connectionDetails = await getFlussonicConnectionDetails();
            setFlussonicPublicHost(connectionDetails.publicHost);
            
            const clientDataString = sessionStorage.getItem('clientData');
            if (!clientDataString) throw new Error('Client data not found in session.');
            const clientData: Client = JSON.parse(clientDataString);

            if (clientData.id.toLowerCase() !== clientIdFromUrl.toLowerCase()) throw new Error('Mismatched client ID. Access denied.');
            
            const hasGlobalAccess = clientData.permissions.hasAllStreamsAccess;
            const hasSpecificAccess = !!clientData.permissions.allowedStreams?.[currentStreamName];

            if (!hasGlobalAccess && !hasSpecificAccess) throw new Error('You do not have permission to access this stream.');
            
            const effectivePermissions = hasGlobalAccess
              ? { canPush: true, canEditDetails: true, canViewStats: true, canManageDVR: true, canManageThumbnails: true, canManageProtocols: true }
              : clientData.permissions.allowedStreams[currentStreamName];
            
            setPermissions(effectivePermissions);
            setMaxPushDestinations(clientData.permissions.maxPushDestinations || 1);

            const [details, configs] = await Promise.all([ getStreamDetails(currentStreamName), getDvrConfigs() ]);
            if (!details) throw new Error('Could not load stream details.');
            
            setDvrConfigs(configs);
            setLiveData({ details });
            setIsDvrSwitchOn(details.dvr != null);
            setEditablePushes(details.pushes?.map((p, i) => ({ ...p, id: p.url || `push_${i}`, ...parsePushUrl(p.url) })) ?? []);
            
            const sourceInput = details.inputs?.[0];
            setCurrentSourceUrl(
                sourceInput &&
                typeof sourceInput === 'object' &&
                'url' in sourceInput &&
                typeof sourceInput.url === 'string'
                    ? sourceInput.url
                    : ''
            );

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאת גישה', description: (error as Error).message });
            router.push(`/client/${clientIdFromUrl}/dashboard`);
        } finally {
            setIsLoading(false);
        }
    }, [currentStreamName, clientIdFromUrl, router, toast]);

    const fetchRuntimeDetails = useCallback(async () => {
        if (!currentStreamName || document.hidden) return;
        try {
            const details = await getStreamDetails(currentStreamName);
            setLiveData(prev => ({ ...prev, details: details || prev.details }));
        } catch (error) {
            console.error("DEBUG: Error fetching runtime stream details:", error);
        }
    }, [currentStreamName]);

    useEffect(() => {
        loadInitialData();
        const detailsInterval = setInterval(fetchRuntimeDetails, 5000);
        return () => clearInterval(detailsInterval);
    }, [loadInitialData, fetchRuntimeDetails]);

    const handleEditMetadata = async () => {
        if (!permissions?.canEditDetails) {
            toast({ variant: "destructive", title: "אין הרשאה", description: "אין לך הרשאה לשנות את פרטי השידור." });
            return;
        }

        setIsEditingMetadata(true);
        const clientDataString = sessionStorage.getItem("clientData");
        const clientData = clientDataString ? JSON.parse(clientDataString) : null;
        const sessionId = sessionStorage.getItem("broadcastSessionId") || sessionStorage.getItem("activeSessionId") || clientData?.broadcastSessionId || clientData?.activeSessionId || "";

        if (!sessionId) {
            setIsEditingMetadata(false);
            toast({ variant: "destructive", title: "שגיאה", description: "לא נמצאה סשן פעילה." });
            return;
        }

        const result = await updateStreamMetadata({ userId: clientIdFromUrl, sessionId }, currentStreamName, currentStreamName, currentSourceUrl, clientIdFromUrl);
        setIsEditingMetadata(false);

        if (result.success) {
            toast({ title: "הצלחה", description: "מקור השידור עודכן בהצלחה." });
            setIsEditDialogOpen(false);
            loadInitialData();
        } else {
            toast({ variant: "destructive", title: "שגיאה בעדכון", description: result.error });
        }
    };
    
    const updateLiveConfig = async (config: Partial<StreamDetails>, successMessage: string) => {
        setIsSaving(true);
        const result = await updateStream(auth, currentStreamName, config);
        setIsSaving(false);
        if (result.success) {
            toast({ title: "הצלחה!", description: successMessage });
            await loadInitialData();
        } else {
            toast({ variant: "destructive", title: "שגיאה בעדכון", description: result.error });
            await loadInitialData();
        }
    };

    const handleDvrProfileSelect = (profile: string) => {
        if (!isDvrSwitchOn) {
            toast({ variant: "destructive", title: "DVR כבוי", description: "יש להפעיל את מתג ה-DVR לפני בחירת פרופיל." });
            return;
        }
        updateLiveConfig({ dvr: { reference: profile } }, `הקלטת DVR הופעלה עם פרופיל ${profile}.`);
    };

    const handleDvrSwitchToggle = (checked: boolean) => {
        setIsDvrSwitchOn(checked);
        if (!checked) updateLiveConfig({ dvr: null }, "הקלטת DVR כובתה.");
    };

    const handleProtocolsUpdate = (mode: 'enable' | 'disable') => {
        const payload: Partial<StreamDetails> = { protocols: {} };
        ALL_PROTOCOLS.forEach(p => { (payload.protocols as Record<string, boolean>)[p] = mode === 'enable'; });
        updateLiveConfig(payload, `כל הפרוטוקולים ${mode === 'enable' ? 'הופעלו' : 'כובו'}.`);
    };

    const handleCopyProtocolUrl = (protocolKey: string) => {
        const ipHost = flussonicPublicHost;
        const domainHost = 'mizrachitv.co.il';
    
        let url = '';
        switch (protocolKey) {
            case 'hls': url = `http://${domainHost}/${currentStreamName}/index.m3u8`; break;
            case 'rtmp': url = `rtmp://${ipHost}:1935/static/${currentStreamName}`; break;
            case 'srt': url = `srt://${domainHost}:9001?streamid=#!::r=${currentStreamName},m=request`; break;
            case 'webrtc': url = `ws://${domainHost}/${currentStreamName}`; break;
            case 'dash': url = `http://${domainHost}/${currentStreamName}/index.mpd`; break;
            case 'mss': url = `http://${domainHost}/${currentStreamName}.isml/manifest`; break;
            case 'tshttp': url = `http://${domainHost}/${currentStreamName}`; break;
            case 'rtsp': url = `rtsp://${ipHost}:1933/${currentStreamName}`; break;
            case 'player': url = `http://${domainHost}/${currentStreamName}/embed.html`; break;
            default: url = `No URL defined for ${protocolKey}`;
        }
        navigator.clipboard.writeText(url).then(() => {
            setCopiedProtocol(protocolKey);
            toast({ title: "הועתק", description: `כתובת ${protocolKey.toUpperCase()} הועתקה.` });
            setTimeout(() => setCopiedProtocol(null), 2000);
        });
    };
    
    const rtmpUrl = `rtmp://${flussonicPublicHost}:1935`;
    const streamKey = `static/${currentStreamName}`;
    const isStreamOnline = liveData.details?.stats?.alive ?? false;

    if (isLoading || !permissions || !liveData.details) {
        return (
             <div className="space-y-4">
                <div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><div className="space-y-2 text-right"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80" /></div></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-6"><Skeleton className="h-[600px] w-full" /></div><div className="lg:col-span-1 space-y-6"><Skeleton className="h-[600px] w-full" /></div></div>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><Button asChild variant="outline"><Link href={`/client/${clientIdFromUrl}/streams`}><ArrowRight className="ml-2 h-4 w-4" />חזרה לכל השידורים</Link></Button></div>
                <div className="space-y-2 flex items-center gap-4">
                    {permissions.canEditDetails && (
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogPrimitiveTrigger asChild><Button variant="ghost" size="icon"><FileSignature className="h-5 w-5" /><span className="sr-only">ערוך מקור</span></Button></DialogPrimitiveTrigger>
                            <DialogPrimitiveContent className="sm:max-w-[425px] text-right">
                                <DialogPrimitiveHeader><DialogPrimitiveTitle>עריכת מקור שידור</DialogPrimitiveTitle><DialogDescription>שנה את כתובת המקור של השידור.</DialogDescription></DialogPrimitiveHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4"><Input id="new-name" value={currentStreamName} className="col-span-3" dir="ltr" disabled /><Label htmlFor="new-name" className="text-right">שם השידור</Label></div>
            setCurrentSourceUrl(
                sourceInput &&
                typeof sourceInput === 'object' &&
                'url' in sourceInput &&
                typeof sourceInput.url === 'string'
                    ? sourceInput.url
                    : ''
            );
                                </div>
                                <DialogPrimitiveFooter><Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>ביטול</Button><Button onClick={handleEditMetadata} disabled={isEditingMetadata}>{isEditingMetadata && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמור שינויים</Button></DialogPrimitiveFooter>
                            </DialogPrimitiveContent>
                        </Dialog>
                    )}
                    <h1 className="text-3xl font-bold tracking-tight">ניהול שידור: {currentStreamName}</h1>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card data-tour="stream-preview-card" className="flex flex-col lg:col-span-1 h-full">
                    <CardHeader>
                        <div className="flex justify-between items-center"><CardTitle>תצוגה מקדימה וסטטוס</CardTitle><Badge variant={'outline'} className={cn("border-transparent text-lg py-1 px-3", isStreamOnline ? 'bg-green-600 text-primary-foreground' : 'bg-red-600 text-destructive-foreground')}>{isStreamOnline ? 'אונליין' : 'אופליין'}{isStreamOnline ? <Power className="mr-1 h-4 w-4" /> : <PowerOff className="mr-1 h-4 w-4" />}</Badge></div>
                    </CardHeader>
                    <CardContent className="flex-grow flex justify-center items-center p-6 pt-0"><div className="aspect-video w-full rounded-md overflow-hidden bg-muted border relative"><StreamPreviewImage streamName={currentStreamName} isStreamOnline={isStreamOnline} /></div></CardContent>
                    <CardFooter className="flex-col items-start gap-3 border-t bg-muted/20 p-4">
                        <div className="w-full"><Label className="text-xs text-muted-foreground">כתובת שרת (RTMP)</Label><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm truncate" dir="ltr">{rtmpUrl}</span><Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleCopyProtocolUrl('rtmp')}>{copiedProtocol === 'rtmp' ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button></div></div>
                        <div className="w-full"><Label className="text-xs text-muted-foreground">מפתח הזרמה</Label><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm truncate" dir="ltr">{streamKey}</span><Button variant="ghost" size="icon" onClick={() => {navigator.clipboard.writeText(streamKey); toast({title: "הועתק"});}}><Copy className="h-4 w-4" /></Button></div></div>
                    </CardFooter>
                </Card>
                
                {permissions.canViewStats && (
                    <Card data-tour="stream-stats-card" className="flex flex-col h-full lg:col-span-2">
                        <CardHeader><CardTitle>סטטיסטיקות שידור</CardTitle></CardHeader>
                        <CardContent className="p-0 flex-grow"><div className="p-2 h-full w-full">{isStreamOnline ? <StreamStatsChart streamName={currentStreamName} initialData={liveData.details} /> : <div className="flex items-center justify-center h-full text-muted-foreground">השידור אינו פעיל</div>}</div></CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {permissions.canManageDVR && (
                    <Card data-tour="stream-dvr-card" className="flex flex-col h-full">
                        <CardHeader><h3 className="text-lg font-semibold text-right flex items-center justify-end gap-2"><Video className="h-5 w-5"/>הקלטות DVR</h3></CardHeader>
                        <CardContent className="flex-grow space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg"><Switch id="dvr-switch" checked={isDvrSwitchOn} onCheckedChange={handleDvrSwitchToggle} disabled={isSaving}/><div className="text-right"><Label htmlFor="dvr-switch" className="font-medium flex items-center gap-2 justify-end">הקלטת DVR</Label><p className="text-xs text-muted-foreground">שמור את השידור לארכיון.</p></div></div>
                            {isDvrSwitchOn && (
                                <div className="grid gap-6 md:grid-cols-1 pt-2">
                                      <div className="space-y-2"><Label htmlFor="dvr-profile">פרופיל DVR</Label><Select dir="rtl" value={typeof liveData.details.dvr?.reference === 'string' ? liveData.details.dvr.reference : ''} onValueChange={handleDvrProfileSelect} disabled={isSaving || !isDvrSwitchOn}><SelectTrigger id="dvr-profile"><SelectValue placeholder="בחר פרופיל..." /></SelectTrigger><SelectContent>{dvrConfigs.length > 0 ? (dvrConfigs.map((config) => (<SelectItem key={config.name} value={config.name}>{config.name}</SelectItem>))) : (<SelectItem value="" disabled>לא נמצאו תצורות</SelectItem>)}</SelectContent></Select></div>
                                </div>
                            )}
                        </CardContent>
                        {isDvrSwitchOn && <CardFooter><Button asChild variant="secondary" size="sm"><Link href={`/client/${clientIdFromUrl}/streams/${currentStreamName}/dvr`}>פתח נגן DVR<Clapperboard className="mr-2 h-4 w-4" /></Link></Button></CardFooter>}
                    </Card>
                )}

                {permissions.canViewStats && (
                    <Card data-tour="stream-info-card" className="col-span-full lg:col-span-1">
                        <CardHeader><CardTitle>נתוני שידור</CardTitle><CardDescription>מידע טכני מהשרת</CardDescription></CardHeader>
                        <CardContent className="p-0 flex-grow"><div className="p-2 h-full w-full"><StreamInfoCard stream={liveData.details} /></div></CardContent>
                    </Card>
                )}
            </div>
            
            {permissions.canPush && (
                <Card><CardHeader>
                    <div className="flex justify-between items-center"><Button variant="outline" onClick={() => setEditablePushes(p => p.length < maxPushDestinations ? [...p, {id: `new_${Date.now()}`, url: '', comment: 'יעד חדש', rtmp_url: '', stream_key: ''}] : p)}><PlusCircle className="ml-2 h-4 w-4" />הוסף יעד</Button><div className="space-y-1.5 text-right w-full"><h2 className="text-2xl font-bold tracking-tight">הזרמה למקור אחר (Push)</h2><p className="text-muted-foreground">הוסף והסר יעדים. השינויים יישמרו רק בלחיצה על "שמור שינויים" בסוף העמוד.</p></div></div>
                </CardHeader><CardContent className="space-y-4">
                    {editablePushes.length > 0 ? editablePushes.map((push, index) => (
                        <Card key={push.id} className="bg-muted/30 p-4 space-y-3"><div className="flex items-center justify-between"><Button variant="destructive" size="icon" onClick={() => setEditablePushes(p => p.filter(item => item.id !== push.id))}><Trash2 className="h-4 w-4" /></Button><span className="font-semibold truncate">{push.name || "יעד חדש"}</span></div><div className="space-y-2"><Label htmlFor={`push-name-${index}`}>שם היעד</Label><Input id={`push-name-${index}`} value={push.name || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, name: e.target.value} : item))} dir="rtl"/></div><div className="space-y-2"><Label htmlFor={`push-url-${index}`}>כתובת הזרמה</Label><Input id={`push-url-${index}`} placeholder="rtmp://..." value={push.rtmp_url || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, rtmp_url: e.target.value} : item))} className="font-mono text-xs" dir="ltr"/></div><div className="space-y-2"><Label htmlFor={`push-key-${index}`}>מפתח הזרמה</Label><Input id={`push-key-${index}`} placeholder="stream key" value={push.stream_key || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, stream_key: e.target.value} : item))} className="font-mono text-xs" dir="ltr"/></div></Card>
                    )) : (<p className="text-center text-muted-foreground py-8">לא הוגדרו יעדי הזרמה.</p>)}
                </CardContent></Card>
            )}

            {permissions.canManageProtocols && (
                <Card data-tour="stream-protocols-card"><CardHeader>
                    <div className="flex flex-col gap-2 text-right"><CardTitle className="flex items-center justify-end gap-2"><Settings2 className="h-5 w-5"/>שליטה בפרוטוקולים</CardTitle><CardDescription>הפעל או כבה את כל פרוטוקולי הפלט עבור השידור. שינויים יתבצעו מיד.</CardDescription></div>
                </CardHeader><CardContent>
                    <div className="flex flex-wrap justify-end gap-3 mb-4"><Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleProtocolsUpdate('enable')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}<Power className="ml-2 h-4 w-4" />הפעל הכל</Button><Button variant="destructive" onClick={() => handleProtocolsUpdate('disable')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}<PowerOff className="ml-2 h-4 w-4" />כבה הכל</Button></div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {ALL_PROTOCOLS.map((protocolKey) => {
                            const protocols = liveData.details?.protocols as Record<string, boolean> | undefined;
                            const isProtocolActive = protocols?.[protocolKey] === true;
                            return (
                                <Card key={protocolKey} className="bg-muted/30"><CardHeader className="p-3 flex-row justify-between items-center"><div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyProtocolUrl(protocolKey)}>{copiedProtocol === protocolKey ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button><Badge variant={isProtocolActive ? 'default' : 'secondary'} className={isProtocolActive ? 'bg-green-600 text-white' : ''}>{isProtocolActive ? 'פעיל' : 'כבוי'}</Badge></div><CardTitle className="text-base">{protocolKey.toUpperCase()}</CardTitle></CardHeader></Card>
                            );
                        })}
                    </div>
                </CardContent></Card>
            )}

            <div className="flex justify-start pt-6 mt-6 border-t"><Button onClick={() => updateLiveConfig({ pushes: editablePushes.map(p => ({ url: combinePushUrl(p.rtmp_url, p.stream_key), comment: p.name || '' })) }, "יעדי ה-Push עודכנו בהצלחה.")} disabled={isSaving} className="w-full md:w-auto">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} שמור יעדי Push <Save className="mr-2 h-4 w-4" /></Button></div>
        </div>
    )
}

