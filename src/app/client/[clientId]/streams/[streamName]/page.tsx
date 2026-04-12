
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowRight, Power, PowerOff, Save, Loader2, PlusCircle, Trash2, Video, Clapperboard, Play, StopCircle, Edit, CheckSquare, FileSignature, Copy, ClipboardCheck, AlertTriangle, Settings2, Eye, EyeOff, Link2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getStreamDetails, updateStream, getDvrConfigs, updateStreamMetadata, generateSecureStreamLink, getFlussonicConnectionDetails } from '@/services/flussonic';
import type { StreamDetails, StreamPush, ProtocolOptions, DvrConfig } from '@/services/flussonic-types';
import { getClientById, type Client } from '@/services/clients';
import { StreamInfoCard } from "@/components/dashboard/stream-info-card";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from "@/components/ui/badge";
import { StreamStatsChart } from '@/components/dashboard/stream-stats-chart';
import { StreamPreviewImage } from '@/components/dashboard/stream-preview-image';
import { cn } from '@/lib/utils';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { getActiveLinksForStream, deleteSecureLink, type SecureLink } from '@/services/secure-links';

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

    const [dvrConfigs, setDvrConfigs] = useState<DvrConfig[]>([]);
    const [liveData, setLiveData] = useState<{ details: StreamDetails | null }>({ details: null });
    const [isDvrSwitchOn, setIsDvrSwitchOn] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [currentSourceUrl, setCurrentSourceUrl] = useState('');
    
    const [viewingStreamName, setViewingStreamName] = useState<string | null>(null);
    const [copiedProtocol, setCopiedProtocol] = useState<string | null>(null);

    const [showRtmp, setShowRtmp] = useState(false);
    const [showStreamKey, setShowStreamKey] = useState(false);
    const [flussonicPublicHost, setFlussonicPublicHost] = useState('');
    const [flussonicIngestHost, setFlussonicIngestHost] = useState('');
    const [activeLinks, setActiveLinks] = useState<SecureLink[]>([]);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

    const [editablePushes, setEditablePushes] = useState<EditableStreamPush[]>([]);

    const getAuthContext = useCallback(() => {
        const userId = sessionStorage.getItem('userId');
        const sessionId = sessionStorage.getItem('activeSessionId');
        if (!userId || !sessionId) return null;
        return { userId, sessionId };
    }, []);

    const handleRefetchDetails = useCallback(async () => {
        try {
            const instanceId = sessionStorage.getItem('instanceId') || 'default';
            const details = await getStreamDetails(currentStreamName, instanceId);
            if (!details) return;
            setLiveData({ details });
        } catch (error) {
            console.error("Error refreshing details:", error);
        }
    }, [currentStreamName]);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const clientDataString = sessionStorage.getItem('clientData');
            if (!clientDataString) throw new Error('נתוני לקוח לא נמצאו בסשן.');
            const clientData: Client = JSON.parse(clientDataString);

        const portalOrigin = localStorage.getItem('loginEntryPoint') || 'standard';
        const instanceId = portalOrigin === 'uh' ? 'uh' : (clientData?.instanceId || 'default');
            const [details, configs, links, connection] = await Promise.all([ 
                getStreamDetails(currentStreamName, instanceId), 
                getDvrConfigs(instanceId),
                getActiveLinksForStream(currentStreamName),
                getFlussonicConnectionDetails(instanceId)
            ]);
            
            if (!details) throw new Error('לא ניתן היה לטעון את פרטי השידור.');
            
            const hasGlobalAccess = clientData.permissions.hasAllStreamsAccess;
            const effectivePermissions = hasGlobalAccess 
                ? { 
                    canPush: true, 
                    canEditDetails: true, 
                    canViewStats: true, 
                    canManageDVR: true, 
                    canManageThumbnails: true, 
                    canManageProtocols: true,
                    canCreateSecureLink: clientData.permissions.canCreateSecureLinks 
                  }
                : clientData.permissions.allowedStreams[currentStreamName];

            setPermissions(effectivePermissions || null);
            setMaxPushDestinations(clientData.permissions.maxPushDestinations || 1);
            setDvrConfigs(configs);
            setActiveLinks(links);
            setLiveData({ details });
            setFlussonicPublicHost(connection.publicHost);
            setFlussonicIngestHost(connection.ingestHost);
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
            toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
            router.push(`/client/${clientIdFromUrl}/dashboard`);
        } finally {
            setIsLoading(false);
        }
    }, [currentStreamName, clientIdFromUrl, router, toast]);

    useEffect(() => {
        loadInitialData();
        const interval = setInterval(() => {
            if (!document.hidden) handleRefetchDetails();
        }, 5000);
        return () => clearInterval(interval);
    }, [loadInitialData, handleRefetchDetails]);
    
    const handleEditMetadata = async () => {
        const auth = getAuthContext();
        if (!auth) return;

        setIsSaving(true);
        const instanceId = sessionStorage.getItem('instanceId') || 'default';
        const result = await updateStreamMetadata(auth, currentStreamName, currentStreamName, currentSourceUrl, clientIdFromUrl, instanceId);
        setIsSaving(false);

        if (result.success) {
            toast({ title: "הצלחה", description: "פרטי המקור עודכנו בהצלחה." });
            setIsEditDialogOpen(false);
            handleRefetchDetails();
        } else {
            toast({ variant: "destructive", title: "שגיאה בעדכון", description: result.error });
        }
    };

    const updateLiveConfig = async (config: Partial<StreamDetails>, successMessage: string) => {
        const auth = getAuthContext();
        if (!auth) return;

        setIsSaving(true);
        const instanceId = sessionStorage.getItem('instanceId') || 'default';
        const result = await updateStream(auth, currentStreamName, config, clientIdFromUrl, instanceId);
        setIsSaving(false);
        if (result.success) {
            toast({ title: "הצלחה!", description: successMessage });
            await handleRefetchDetails();
        } else {
            toast({ variant: "destructive", title: "שגיאה", description: result.error });
        }
    };

    const handleDvrSwitchToggle = (checked: boolean) => {
        setIsDvrSwitchOn(checked);
        if (!checked) {
            updateLiveConfig({ dvr: null }, "הקלטת DVR כובתה.");
        }
    };

    const handleDvrProfileSelect = (profile: string) => {
        if (!isDvrSwitchOn) {
            toast({ variant: "destructive", title: "DVR כבוי" });
            return;
        }
        updateLiveConfig({ dvr: { reference: profile } }, `הקלטת DVR הופעלה עם פרופיל ${profile}.`);
    };

    const handleProtocolsUpdate = async (mode: 'enable' | 'disable') => {
        const obj: Record<string, boolean> = {};
        ALL_PROTOCOLS.forEach(p => { obj[p] = mode === 'enable'; });
        await updateLiveConfig({ protocols: obj }, `פרוטוקולים ${mode === 'enable' ? 'הופעלו' : 'כובו'}.`);
    };

    const handleCopyProtocolUrl = (protocolKey: string) => {
        const ingestHost = flussonicIngestHost;
        let url = '';
        switch (protocolKey) {
            case 'rtmp': url = `rtmp://${ingestHost}:1935/static/${currentStreamName}`; break;
            case 'hls': url = `https://${ingestHost}/${currentStreamName}/index.m3u8`; break;
            default: url = `https://${ingestHost}/${currentStreamName}/embed.html`;
        }
        navigator.clipboard.writeText(url);
        setCopiedProtocol(protocolKey);
        toast({ title: "הועתק" });
        setTimeout(() => setCopiedProtocol(null), 2000);
    };

    const handleGenerateSecureLink = async () => {
        const auth = getAuthContext();
        if (!auth) return;

        setIsGeneratingLink(true);
        const clientDataString = sessionStorage.getItem('clientData');
        const clientData = clientDataString ? JSON.parse(clientDataString) : null;
        const portalOrigin = localStorage.getItem('loginEntryPoint') || 'standard';
        const instanceId = portalOrigin === 'uh' ? 'uh' : (clientData?.instanceId || 'default');
        
        const result = await generateSecureStreamLink(auth, currentStreamName, instanceId);
        if (result.success && result.id) {
            const updatedLinks = await getActiveLinksForStream(currentStreamName);
            setActiveLinks(updatedLinks);
            toast({ title: "הקישור נוצר!" });
        }
        setIsGeneratingLink(false);
    };

    const handleDeleteSecureLink = async (id: string) => {
        setDeletingLinkId(id);
        const actorName = sessionStorage.getItem('userNickname') || 'לקוח';
        const result = await deleteSecureLink(id, actorName);
        if (result.success) {
            setActiveLinks(prev => prev.filter(l => l.id !== id));
            toast({ title: "הקישור נמחק" });
        }
        setDeletingLinkId(null);
    }

    if (isLoading || !permissions || !liveData.details) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    const isStreamOnline = liveData.details.stats?.alive ?? false;
    const rtmpUrl = `rtmp://${flussonicIngestHost}:1935`;
    const streamKey = `static/${currentStreamName}`;

    return (
        <div className="space-y-6 text-right">
             <div className="flex flex-col-reverse sm:flex-row-reverse items-center justify-between gap-4">
                <Button asChild variant="outline"><Link href={`/client/${clientIdFromUrl}/streams`}><ArrowRight className="ml-2 h-4 w-4" />חזרה לשידורים</Link></Button>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-4">
                     {permissions.canEditDetails && (
                        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <FileSignature className="h-5 w-5" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md text-right">
                                <DialogHeader className="items-end">
                                    <DialogTitle>עריכת פרטי שידור</DialogTitle>
                                    <DialogDescription>שנה את כתובת המקור (RTMP) של השידור.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="stream-name">שם השידור (לא ניתן לשינוי)</Label>
                                        <Input id="stream-name" value={currentStreamName} disabled dir="ltr" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="source-url">כתובת מקור (RTMP Source)</Label>
                                        <Input 
                                            id="source-url" 
                                            value={currentSourceUrl} 
                                            onChange={(e) => setCurrentSourceUrl(e.target.value)} 
                                            dir="ltr"
                                            placeholder="rtmp://..."
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="sm:justify-start">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline">ביטול</Button>
                                    </DialogClose>
                                    <Button onClick={handleEditMetadata} disabled={isSaving}>
                                        {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                        שמור שינויים
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                    <span>ניהול שידור: {currentStreamName}</span>
                </h1>
            </div>

            <Dialog open={!!viewingStreamName} onOpenChange={(isOpen) => !isOpen && setViewingStreamName(null)}>
                <DialogContent className="max-w-4xl p-0">
                    <div className="aspect-video">
                        {viewingStreamName && flussonicPublicHost && <iframe src={`https://${flussonicPublicHost}/${viewingStreamName}/embed.html`} allowFullScreen className="w-full h-full border-0"></iframe>}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card data-tour="stream-preview-card" className="flex flex-col h-full lg:col-span-1">
                    <CardHeader>
                        <div className="flex justify-between items-center"><CardTitle>תצוגה מקדימה</CardTitle><Badge variant={isStreamOnline ? 'default' : 'destructive'} className={cn("text-lg py-1 px-3", isStreamOnline ? 'bg-green-600' : 'bg-red-600')}>{isStreamOnline ? 'אונליין' : 'אופליין'}</Badge></div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <div className="aspect-video w-full rounded-md overflow-hidden bg-muted border relative">
                            <StreamPreviewImage streamName={currentStreamName} isStreamOnline={isStreamOnline} />
                        </div>
                        <Button variant="secondary" className="w-full mt-4" onClick={() => setViewingStreamName(currentStreamName)} disabled={!isStreamOnline}>
                            <Eye className="ml-2 h-4 w-4" />צפייה בנגן
                        </Button>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-3 border-t bg-muted/20 p-4">
                        <div className="w-full">
                            <Label className="text-xs text-muted-foreground text-right w-full block">כתובת שרת (RTMP)</Label>
                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <span className="font-mono text-sm truncate" dir="ltr">{showRtmp ? rtmpUrl : '••••••••••••••••'}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowRtmp(!showRtmp)}>{showRtmp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {navigator.clipboard.writeText(rtmpUrl); toast({title:"הועתק"})}}><Copy className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                        <div className="w-full">
                            <Label className="text-xs text-muted-foreground text-right w-full block">מפתח הזרמה</Label>
                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                <span className="font-mono text-sm truncate" dir="ltr">{showStreamKey ? streamKey : '••••••••••••••••'}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowStreamKey(!showStreamKey)}>{showStreamKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {navigator.clipboard.writeText(streamKey); toast({title:"הועתק"})}}><Copy className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    </CardFooter>
                </Card>
                
                {permissions.canViewStats && (
                    <Card data-tour="stream-stats-card" className="flex flex-col h-full lg:col-span-2">
                        <CardHeader><CardTitle>סטטיסטיקות שידור</CardTitle></CardHeader>
                        <CardContent className="p-0 flex-grow">{isStreamOnline ? <StreamStatsChart streamName={currentStreamName} initialData={liveData.details} /> : <div className="flex items-center justify-center h-full text-muted-foreground">שידור לא פעיל</div>}</CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {permissions.canManageDVR && (
                    <Card data-tour="stream-dvr-card" className="h-full">
                        <CardHeader><CardTitle className="flex items-center justify-end gap-2"><Video className="h-5 w-5"/>הקלטות DVR</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg"><Switch checked={isDvrSwitchOn} onCheckedChange={handleDvrSwitchToggle} /><Label>הקלטה פעילה</Label></div>
                            {isDvrSwitchOn && (
                                <Select dir="rtl" value={typeof liveData.details.dvr?.reference === 'string' ? liveData.details.dvr.reference : ''} onValueChange={handleDvrProfileSelect}>
                                    <SelectTrigger><SelectValue placeholder="בחר פרופיל..." /></SelectTrigger>
                                    <SelectContent>{dvrConfigs.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                        </CardContent>
                        {isDvrSwitchOn && (
                            <CardFooter>
                                <Button asChild variant="secondary" size="sm">
                                    <Link href={`/client/${clientIdFromUrl}/streams/${currentStreamName}/dvr`}>
                                        פתח נגן DVR
                                        <Clapperboard className="mr-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                )}
                
                {permissions.canCreateSecureLink && (
                    <Card className="h-full">
                        <CardHeader><CardTitle className="flex items-center justify-end gap-2"><Link2 className="h-5 w-5"/>קישורים זמניים</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleGenerateSecureLink} disabled={isGeneratingLink} className="w-full">
                                {isGeneratingLink ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlusCircle className="ml-2 h-4 w-4" />}
                                צור קישור ל-5 שעות
                            </Button>
                            <div className="space-y-2">
                                {activeLinks.map(link => {
                                    const baseUrl = link.appHost ? `https://${link.appHost}` : (link.instanceId === 'uh' ? 'https://mcr.uhdrones.org.il' : 'https://app.mizrachitv.co.il');
                                    const fullUrl = `${baseUrl}/watch/${link.id}`;
                                    return (
                                        <div key={link.id} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteSecureLink(link.id)} disabled={deletingLinkId === link.id}>
                                                    {deletingLinkId === link.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {navigator.clipboard.writeText(fullUrl); toast({title:"הקישור הועתק!"})}}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex flex-col items-end flex-1 truncate ml-2">
                                                <span className="text-[10px] font-mono truncate w-full text-left opacity-70" dir="ltr">{fullUrl}</span>
                                                <span className="text-[9px] text-muted-foreground">תוקף: {format(new Date(link.expiresAt), 'HH:mm dd/MM')}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {permissions.canManageProtocols && (
                <Card data-tour="stream-protocols-card">
                    <CardHeader>
                        <div className="flex flex-col gap-2 text-right">
                            <CardTitle className="flex items-center justify-end gap-2">
                                <Settings2 className="h-5 w-5"/>
                                שליטה בפרוטוקולים
                            </CardTitle>
                            <CardDescription>הפעל או כבה את כל פרוטוקולי הפלט עבור השידור. שינויים יתבצעו מיד.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap justify-end gap-3 mb-4">
                            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleProtocolsUpdate('enable')} disabled={isSaving}>
                                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                <Power className="ml-2 h-4 w-4" />
                                הפעל הכל
                            </Button>
                            <Button variant="destructive" onClick={() => handleProtocolsUpdate('disable')} disabled={isSaving}>
                                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                <PowerOff className="ml-2 h-4 w-4" />
                                כבה הכל
                            </Button>
                        </div>
                        <Separator className="my-4" />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {ALL_PROTOCOLS.map((protocolKey) => {
                                const protocols = liveData.details?.protocols as Record<string, boolean> | undefined;
                                const isProtocolActive = protocols?.[protocolKey] === true;
                                return (
                                    <Card key={protocolKey} className="bg-muted/30">
                                        <CardHeader className="p-3 flex-row justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyProtocolUrl(protocolKey)}>
                                                    {copiedProtocol === protocolKey ? <ClipboardCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                                <Badge variant={isProtocolActive ? 'default' : 'secondary'} className={isProtocolActive ? 'bg-green-600 text-white' : ''}>
                                                    {isProtocolActive ? 'פעיל' : 'כבוי'}
                                                </Badge>
                                            </div>
                                            <CardTitle className="text-base">{protocolKey.toUpperCase()}</CardTitle>
                                        </CardHeader>
                                    </Card>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {permissions.canPush && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <Button variant="outline" onClick={() => setEditablePushes(p => p.length < maxPushDestinations ? [...p, {id: `new_${Date.now()}`, url: '', comment: 'יעד חדש', rtmp_url: '', stream_key: ''}] : p)}><PlusCircle className="ml-2 h-4 w-4" />הוסף יעד</Button>
                            <div className="space-y-1.5 text-right w-full"><h2 className="text-2xl font-bold tracking-tight">הזרמה למקור אחר (Push)</h2><p className="text-muted-foreground">הוסף והסר יעדים. השינויים יישמרו רק בלחיצה על "שמור שינויים" בסוף העמוד.</p></div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {editablePushes.length > 0 ? editablePushes.map((push, index) => (
                            <Card key={push.id} className="bg-muted/30 p-4 space-y-3">
                                <div className="flex items-center justify-between"><Button variant="destructive" size="icon" onClick={() => setEditablePushes(p => p.filter(item => item.id !== push.id))}><Trash2 className="h-4 w-4" /></Button><span className="font-semibold truncate">{push.name || "יעד חדש"}</span></div>
                                <div className="space-y-2"><Label htmlFor={`push-name-${index}`}>שם היעד</Label><Input id={`push-name-${index}`} value={push.name || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, name: e.target.value} : item))} dir="rtl"/></div>
                                <div className="space-y-2"><Label htmlFor={`push-url-${index}`}>כתובת הזרמה</Label><Input id={`push-url-${index}`} placeholder="rtmp://..." value={push.rtmp_url || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, rtmp_url: e.target.value} : item))} className="font-mono text-xs" dir="ltr"/></div>
                                  <div className="space-y-2"><Label htmlFor={`push-key-${index}`}>מפתח הזרמה</Label><Input id={`push-key-${index}`} placeholder="stream key" value={push.stream_key || ''} onChange={(e) => setEditablePushes(p => p.map(item => item.id === push.id ? {...item, stream_key: e.target.value} : item))} className="font-mono text-xs" dir="ltr"/></div>
                            </Card>
                        )) : (<p className="text-center text-muted-foreground py-8">לא הוגדרו יעדי הזרמה.</p>)}
                    </CardContent>
                </Card>
            )}

            <Card data-tour="stream-info-card" className="col-span-full">
                <CardHeader><CardTitle>מידע טכני</CardTitle></CardHeader>
                <CardContent className="p-0"><StreamInfoCard stream={liveData.details} /></CardContent>
            </Card>

            <div className="flex justify-start pt-6 mt-6 border-t">
                <Button onClick={() => updateLiveConfig({ pushes: editablePushes.map(p => ({ url: combinePushUrl(p.rtmp_url, p.stream_key), comment: p.name || '' })) }, "יעדי ה-Push עודכנו בהצלחה.")} disabled={isSaving} className="w-full md:w-auto">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                    שמור יעדי Push 
                    <Save className="mr-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
