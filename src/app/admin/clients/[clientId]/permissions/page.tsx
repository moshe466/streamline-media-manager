
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getClientById, updateClientPermissionsAndStatus, type Client, type ClientPermissions } from '@/services/clients';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { getRequestById, type PermissionRequest, resolveRequest } from '@/services/requests';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Save, Shield, Video, Image as ImageIcon, Power, ShieldCheck, Edit, Settings2, Target, Hash, Calendar as CalendarIcon, X, Loader2, UserPlus, Download, Info, FileText, UserCog, RadioTower, KeyRound, Link2 } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';


const ALL_STREAM_PERMISSIONS = {
    canPush: true,
    canEditDetails: true,
    canViewStats: true,
    canManageDVR: true,
    canManageThumbnails: true,
    canManageProtocols: true,
    canBroadcastWebRTC: false, 
    canCreateSecureLink: true,
};

const DEFAULT_STREAM_PERMISSIONS = {
    canPush: true,
    canEditDetails: false,
    canViewStats: true,
    canManageDVR: false,
    canManageThumbnails: false,
    canManageProtocols: false,
    canBroadcastWebRTC: false,
    canCreateSecureLink: false,
};

const RequestInfoCard = ({ request }: { request: PermissionRequest }) => {
    const isUpdate = request.requestorType === 'new_client_questionnaire' && !!request.existingData;
    const changes = useMemo(() => {
        if (!isUpdate || !request.existingData || !request.questionnaireData) return [];
        
        const changeMap: { [key: string]: string } = {
            firstName: "שם פרטי",
            lastName: "שם משפחה",
            nickname: "כינוי",
            phone: "טלפון",
            idNumber: "ח.פ/ע.מ",
            companyName: "שם חברה",
            address: "כתובת",
        };

        return Object.keys(changeMap)
            .filter(key => 
                request.questionnaireData[key] && 
                request.questionnaireData[key] !== (request.existingData as any)[key]
            )
            .map(key => ({
                field: changeMap[key],
                oldValue: (request.existingData as any)[key] || 'ריק',
                newValue: request.questionnaireData[key]
            }));
    }, [request, isUpdate]);

    return (
        <Card className="border-blue-500/50 bg-blue-500/10 mb-8">
            <CardHeader>
                 <CardTitle className="flex items-center justify-end gap-2 text-blue-300">
                    <FileText className="h-5 w-5" />
                    פרטי בקשה מטופס הרשמה
                 </CardTitle>
                 <CardDescription className="text-blue-400/80">
                    {isUpdate 
                        ? `לקוח קיים ביקש לעדכן פרטים. להלן השינויים המבוקשים:`
                        : `בקשה מלקוח חדש. יש להגדיר הרשאות וסטטוס ולשמור.`
                    }
                 </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {changes.length > 0 ? (
                    changes.map(change => (
                         <div key={change.field} className="flex justify-between items-center border-b border-blue-400/20 pb-2">
                             <div className="text-left space-x-2 font-mono text-xs">
                                 <span className="text-red-400 line-through">{change.oldValue}</span>
                                 <span className="text-muted-foreground">&rarr;</span>
                                 <span className="text-green-400">{change.newValue}</span>
                            </div>
                            <span className="font-semibold">{change.field}</span>
                         </div>
                    ))
                ) : isUpdate ? (
                    <p>לא התבקשו שינויים בפרטים הקיימים. יש לאשר את הבקשה כדי להפעיל מחדש את החשבון.</p>
                ) : (
                    <p>כל הפרטים מולאו בטופס. ניתן לצפות בהם בעמוד הבקשות או בכרטיס הלקוח.</p>
                )}
            </CardContent>
        </Card>
    );
}

const defaultPermissions: ClientPermissions = {
    canCreateStreams: false,
    canDeleteStreams: false,
    canCreateViewers: false,
    canUseWebRTC: false,
    canCreateSecureLinks: false,
    hasAllStreamsAccess: false,
    maxPushDestinations: 1,
    maxStreams: 1,
    maxConcurrentBroadcasts: 1,
    allowedStreams: {},
};


export default function ClientPermissionsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [client, setClient] = useState<Client | null>(null);
    const [streams, setStreams] = useState<FlussonicStream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingWebRTCToggle, setIsSavingWebRTCToggle] = useState(false);
    const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);

    // Permissions State
    const [isActive, setIsActive] = useState(false);
    const [isManager, setIsManager] = useState(false);
    const [activeUntil, setActiveUntil] = useState<Date | null>(null);
    const [canCreateStreams, setCanCreateStreams] = useState(false);
    const [canDeleteStreams, setCanDeleteStreams] = useState(false);
    const [canCreateViewers, setCanCreateViewers] = useState(false);
    const [canUseWebRTC, setCanUseWebRTC] = useState(false);
    const [canCreateSecureLinks, setCanCreateSecureLinks] = useState(false);
    const [hasAllStreamsAccess, setHasAllStreamsAccess] = useState(false);
    
    // New WebRTC credentials state
    const [isWebRTCModalOpen, setIsWebRTCModalOpen] = useState(false);
    const [webrtcUsername, setWebrtcUsername] = useState('');
    const [webrtcPassword, setWebrtcPassword] = useState('');
    const [isSavingWebRTC, setIsSavingWebRTC] = useState(false);
    
    // New max streams state
    const [maxConcurrentBroadcasts, setMaxConcurrentBroadcasts] = useState(1);
    const [maxStreams, setMaxStreams] = useState(1);
    const [isUnlimitedStreams, setIsUnlimitedStreams] = useState(false);


    
    const [streamPermissions, setStreamPermissions] = useState<ClientPermissions['allowedStreams']>({});
    const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);


    useEffect(() => {
        if (!clientId) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const reqId = searchParams.get('reqId');
                if (reqId) {
                    const reqData = await getRequestById(reqId);
                    setPermissionRequest(reqData);
                }

                const [clientData, streamsData] = await Promise.all([
                    getClientById(clientId),
                    getStreams()
                ]);

                if (!clientData) {
                    toast({ variant: 'destructive', title: 'לקוח לא נמצא' });
                    router.push('/admin/clients');
                    return;
                }
                
                setClient(clientData);
                setStreams(streamsData);

                // Initialize permissions and status from client data or with defaults
                setIsManager(clientData.isManager || false);
                const perms = clientData.permissions || { ...defaultPermissions, allowedStreams: {} };
                setCanCreateStreams(perms.canCreateStreams);
                setCanDeleteStreams(perms.canDeleteStreams);
                setCanCreateViewers(perms.canCreateViewers);
                setCanUseWebRTC(perms.canUseWebRTC || false); 
                setCanCreateSecureLinks(perms.canCreateSecureLinks || false);
                setHasAllStreamsAccess(perms.hasAllStreamsAccess);
                
                setWebrtcUsername(clientData.webrtcUsername || '');
                setWebrtcPassword(clientData.webrtcPassword || '');
                
                setMaxConcurrentBroadcasts(clientData.permissions?.maxConcurrentBroadcasts || 1);
                
                const clientMaxStreams = clientData.permissions?.maxStreams;
                 if (clientMaxStreams === -1) {
                    setIsUnlimitedStreams(true);
                    setMaxStreams(1); 
                } else {
                    setIsUnlimitedStreams(false);
                    setMaxStreams(clientMaxStreams || 1);
                }
                
                setStreamPermissions(perms.allowedStreams || {});
                setIsActive(clientData.status === 'פעיל');
                setActiveUntil(clientData.activeUntil ? parseISO(clientData.activeUntil) : null);

            } catch (error) {
                toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientId, router, toast, searchParams]);
    
    const handleStreamAccessChange = (streamName: string, value: 'off' | 'custom' | 'full') => {
        setStreamPermissions(prev => {
            const newPermissions = { ...prev };
            if (value === 'off') {
                delete newPermissions[streamName];
            } else if (value === 'custom') {
                newPermissions[streamName] = { ...DEFAULT_STREAM_PERMISSIONS, ...(newPermissions[streamName] || {}) };
            } else if (value === 'full') {
                newPermissions[streamName] = { ...ALL_STREAM_PERMISSIONS, canBroadcastWebRTC: newPermissions[streamName]?.canBroadcastWebRTC || false };
            }
            return newPermissions;
        });

        if (value === 'custom') {
            setOpenAccordionItems(prev => [...prev, streamName]);
        } else {
            setOpenAccordionItems(prev => prev.filter(item => item !== streamName));
        }
    };
    
    const handleSpecificPermissionToggle = (streamName: string, permissionKey: keyof ClientPermissions['allowedStreams'][string], isEnabled: boolean) => {
        setStreamPermissions(prev => ({
            ...prev,
            [streamName]: {
                ...DEFAULT_STREAM_PERMISSIONS,
                ...(prev[streamName] || {}),
                [permissionKey]: isEnabled
            }
        }));
    };
    
    const handleWebRTCToggle = async (checked: boolean) => {
        if (!client) return;
        setIsSavingWebRTCToggle(true);
        setCanUseWebRTC(checked); 

        const finalPermissions = {
            ...(client.permissions || defaultPermissions),
            canUseWebRTC: checked,
        };

        const result = await updateClientPermissionsAndStatus(client.id, finalPermissions, client.status, client.activeUntil, client.isManager || false);

        if (result.success) {
            toast({
                title: `שידור WebRTC ${checked ? 'הופעל' : 'כובה'}.`,
                description: checked ? "המייל עם פרטי הגישה נשלח ללקוח." : undefined,
            });
            setClient(result.updatedClient); 
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את הרשאת ה-WebRTC.' });
            setCanUseWebRTC(!checked); 
        }
        setIsSavingWebRTCToggle(false);
    };

    const handleSave = async () => {
        if (!client) return;
        setIsSaving(true);
        
        const finalPermissions: ClientPermissions = {
            canCreateStreams,
            canDeleteStreams,
            canCreateViewers,
            canUseWebRTC,
            canCreateSecureLinks,
            hasAllStreamsAccess,
            maxPushDestinations: client.permissions?.maxPushDestinations || 1, 
            maxStreams: isUnlimitedStreams ? -1 : maxStreams,
            maxConcurrentBroadcasts: maxConcurrentBroadcasts,
            allowedStreams: hasAllStreamsAccess ? {} : streamPermissions,
        };

        const finalStatus = isActive ? "פעיל" : "לא פעיל";
        const finalActiveUntil = isActive && activeUntil ? format(activeUntil, 'yyyy-MM-dd') : null;
        
        const result = await updateClientPermissionsAndStatus(
            client.id, 
            finalPermissions, 
            finalStatus, 
            finalActiveUntil, 
            isManager,
            webrtcUsername, 
            webrtcPassword
        );

        if (result.success) {
            toast({
                title: "ההרשאות נשמרו",
                description: `ההרשאות והסטטוס עבור ${client?.nickname} עודכנו בהצלחה.`,
            });
            if (permissionRequest) {
                await resolveRequest(permissionRequest.id, 'approve', 'admin');
                router.push('/admin/requests');
            }
        } else {
             toast({
                variant: 'destructive',
                title: 'שגיאה בשמירה',
                description: result.error || 'לא ניתן היה לעדכן את פרטי הלקוח.',
            });
        }
        
        setIsSaving(false);
    };

    const handleSaveWebRTCDetails = async () => {
        if (!client) return;
        setIsSavingWebRTC(true);
        try {
            const finalPermissions = {
                ...(client.permissions || defaultPermissions),
                maxConcurrentBroadcasts,
            };
            const result = await updateClientPermissionsAndStatus(
                client.id, 
                finalPermissions, 
                client.status, 
                client.activeUntil, 
                isManager || false, 
                webrtcUsername, 
                webrtcPassword
            );
            if(result.success) {
                toast({ title: "פרטי שידור מהדפדפן נשמרו!" });
                setIsWebRTCModalOpen(false);
                 setClient(result.updatedClient); 
                if (result.updatedClient.permissions?.maxConcurrentBroadcasts) {
                    setMaxConcurrentBroadcasts(result.updatedClient.permissions.maxConcurrentBroadcasts);
                }
            } else {
                throw new Error(result.error || "Failed to save WebRTC details.");
            }
        } catch (error) {
            toast({ variant: "destructive", title: "שגיאה בשמירה", description: (error as Error).message });
        } finally {
            setIsSavingWebRTC(false);
        }
    };
    
    const handleBulkStreamAccess = (mode: 'full' | 'off') => {
        if (mode === 'off') {
            setStreamPermissions({});
        } else {
            const newPermissions: ClientPermissions['allowedStreams'] = {};
            streams.forEach(stream => {
                newPermissions[stream.name] = { ...ALL_STREAM_PERMISSIONS };
            });
            setStreamPermissions(newPermissions);
        }
    };

    const handleBulkWebRTC = (mode: 'enable' | 'disable') => {
        const newPermissions = { ...streamPermissions };
        Object.keys(newPermissions).forEach(streamName => {
            newPermissions[streamName].canBroadcastWebRTC = (mode === 'enable');
        });
        setStreamPermissions(newPermissions);
    };


    if (isLoading) {
        return (
             <div className="space-y-8 text-right">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-48" />
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-80" />
                    </div>
                </div>
                <Skeleton className="w-full h-12" />
                <Skeleton className="w-full h-48" />
                <Skeleton className="w-full h-96" />
            </div>
        )
    }

    if (!client) {
        return <div>טוען...</div>;
    }


    return (
        <div className="space-y-8 text-right">
             <div className="flex flex-col sm:flex-row-reverse items-center justify-between gap-4">
                <div className="space-y-2 text-center sm:text-right">
                    <h1 className="text-3xl font-bold tracking-tight">ניהול הרשאות</h1>
                    <p className="text-muted-foreground">
                        הגדר הרשאות עבור הלקוח: {client.firstName} {client.lastName} ({client.nickname})
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/admin/clients">
                       חזרה לכל הלקוחות
                       <ArrowRight className="mr-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
            
            {permissionRequest && <RequestInfoCard request={permissionRequest} />}

            <Card>
                <CardHeader>
                    <CardTitle>סטטוס וסוג לקוח</CardTitle>
                    <CardDescription>קבע האם חשבון הלקוח פעיל, מנהל, ותאריך תפוגה במידת הצורך.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col-reverse sm:flex-row items-start gap-4 sm:items-center sm:justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            {isActive && (
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full sm:w-[240px] justify-end text-right font-normal",
                                        !activeUntil && "text-muted-foreground"
                                    )}
                                    >
                                    {activeUntil ? format(activeUntil, "dd/MM/yyyy") : <span>בחר תאריך תפוגה</span>}
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                {activeUntil && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveUntil(null)}><X className="h-4 w-4"/></Button>}
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={activeUntil ?? undefined}
                                        onSelect={(date) => setActiveUntil(date ?? null)}
                                        initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
                            )}
                             <Switch id="client-status" checked={isActive} onCheckedChange={setIsActive} dir="ltr" />
                        </div>
                        <Label htmlFor="client-status" className="flex items-center gap-2">
                            חשבון פעיל
                             <Power className="ml-2 h-4 w-4" />
                        </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4 border-yellow-500/50 bg-yellow-500/10">
                        <Switch id="is-manager" checked={isManager} onCheckedChange={setIsManager} dir="ltr" />
                         <Label htmlFor="is-manager" className="flex items-center gap-2 text-yellow-300">
                            לקוח מנהל
                            <UserCog className="ml-2 h-4 w-4" />
                         </Label>
                    </div>
                     {client.receiptUrl && (
                        <div className="flex items-center justify-end gap-4 rounded-lg border p-4 border-blue-500/50 bg-blue-500/10">
                            <Button asChild variant="secondary">
                                <a href={client.receiptUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="ml-2 h-4 w-4" />
                                    הורד אישור תשלום
                                </a>
                            </Button>
                             <Label className="text-blue-300">הלקוח העלה אישור תשלום</Label>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>הרשאות גלובליות</CardTitle>
                    <CardDescription>הגדרות שחלות על כל השידורים.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <Switch id="create-streams" checked={canCreateStreams} onCheckedChange={setCanCreateStreams} dir="ltr" />
                        <Label htmlFor="create-streams" className="text-right">אפשר יצירת שידורים חדשים</Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch id="delete-streams" checked={canDeleteStreams} onCheckedChange={setCanDeleteStreams} dir="ltr" />
                        <Label htmlFor="delete-streams" className="text-right">אפשר מחיקת שידורים</Label>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch id="create-viewers" checked={canCreateViewers} onCheckedChange={setCanCreateViewers} dir="ltr" />
                        <Label htmlFor="create-viewers" className="flex items-center gap-2">
                            אפשר יצירת צופים
                            <UserPlus className="ml-2 h-4 w-4" />
                        </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className='flex items-center gap-2'>
                           <Dialog open={isWebRTCModalOpen} onOpenChange={setIsWebRTCModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">הגדר פרטים</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md text-right">
                                    <DialogHeader>
                                        <DialogTitle>פרטי התחברות לשידור WebRTC</DialogTitle>
                                        <DialogDescription>
                                            פרטים אלו ישמשו את הלקוח להתחברות והזרמת וידאו מהדפדפן ישירות לשרת.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="webrtc-username">שם משתמש לשידור</Label>
                                            <Input id="webrtc-username" value={webrtcUsername} onChange={(e) => setWebrtcUsername(e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="webrtc-password">סיסמת שידור</Label>
                                            <Input id="webrtc-password" value={webrtcPassword} onChange={(e) => setWebrtcPassword(e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="max-concurrent-broadcasts">מקסימום חיבורים במקביל</Label>
                                             <Input 
                                                id="max-concurrent-broadcasts" 
                                                type="number" 
                                                min="1"
                                                value={maxConcurrentBroadcasts}
                                                onChange={(e) => setMaxConcurrentBroadcasts(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                className="w-24 dir-ltr text-right"
                                            />
                                             <p className="text-xs text-muted-foreground">כמה מכשירים יכולים לשדר עם אותם פרטי התחברות בו-זמנית.</p>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" onClick={handleSaveWebRTCDetails} disabled={isSavingWebRTC}>
                                            {isSavingWebRTC ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                            שמור וסגור
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                             <Switch id="webrtc" checked={canUseWebRTC} onCheckedChange={handleWebRTCToggle} disabled={isSavingWebRTCToggle} dir="ltr" />
                        </div>
                         <Label htmlFor="webrtc" className="flex items-center gap-2">
                             שידור חי מהדפדפן (WebRTC)
                             <RadioTower className="ml-2 h-4 w-4" />
                         </Label>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch id="global-secure-links" checked={canCreateSecureLinks} onCheckedChange={setCanCreateSecureLinks} dir="ltr" />
                         <Label htmlFor="global-secure-links" className="flex items-center gap-2">
                             אפשר יצירת קישורים מאובטחים לכל הערוצים
                             <Link2 className="ml-2 h-4 w-4" />
                         </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch id="all-streams" checked={hasAllStreamsAccess} onCheckedChange={setHasAllStreamsAccess} dir="ltr" />
                         <Label htmlFor="all-streams" className="flex items-center gap-2">
                             גישה לכל השידורים
                             <ShieldCheck className="ml-2 h-4 w-4" />
                         </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="flex items-center gap-2">
                                <Input 
                                    id="max-streams" 
                                    type="number" 
                                    min="1"
                                    value={maxStreams}
                                    onChange={(e) => setMaxStreams(parseInt(e.target.value, 10))}
                                    className="w-20"
                                    disabled={isUnlimitedStreams}
                                />
                                <Label htmlFor="unlimited-streams">ללא הגבלה</Label>
                                 <Switch id="unlimited-streams" checked={isUnlimitedStreams} onCheckedChange={setIsUnlimitedStreams} dir="ltr" />
                            </div>
                        <Label>מקסימום שידורים ליצירה</Label>
                    </div>
                </CardContent>
            </Card>

             <Card className={cn(hasAllStreamsAccess && "bg-muted/30 opacity-60 pointer-events-none")}>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
                        <div className="flex gap-2">
                            <Button variant="destructive" size="sm" onClick={() => handleBulkStreamAccess('off')}>כבה גישה להכל</Button>
                            <Button variant="default" size="sm" className="bg-green-600" onClick={() => handleBulkStreamAccess('full')}>החל גישה מלאה על הכל</Button>
                        </div>
                        <div className="text-right">
                            <CardTitle>גישה לשידורים</CardTitle>
                            <CardDescription>בחר לאילו שידורים תהיה ללקוח גישה ומה יהיו ההרשאות שלו בכל שידור.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {hasAllStreamsAccess && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                            <p className="text-lg font-semibold text-foreground bg-background/80 p-4 rounded-md">
                                ללקוח זה יש גישה לכל השידורים.
                            </p>
                        </div>
                    )}
                    {streams.length > 0 ? (
                        <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full">
                            {streams.map(stream => {
                                const currentPermission = streamPermissions[stream.name];
                                const mainPermissions = { ...ALL_STREAM_PERMISSIONS };
                                delete (mainPermissions as Partial<typeof mainPermissions>).canBroadcastWebRTC;
                                
                                const isFullAccess = currentPermission && Object.keys(mainPermissions).every(key => 
                                    currentPermission[key as keyof typeof mainPermissions] === true
                                );

                                const hasSomeAccess = !!currentPermission;
                                
                                let toggleValue: 'off' | 'custom' | 'full' = 'off';
                                if (hasSomeAccess) {
                                    toggleValue = isFullAccess ? 'full' : 'custom';
                                }

                                const isAccordionDisabled = toggleValue !== 'custom';
                                const areSwitchesDisabled = toggleValue === 'full';

                                return (
                                <AccordionItem value={stream.name} key={stream.name}>
                                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b gap-4">
                                         <ToggleGroup 
                                            type="single"
                                            value={toggleValue}
                                            onValueChange={(value: 'off' | 'custom' | 'full') => {
                                                if (value) handleStreamAccessChange(stream.name, value);
                                            }}
                                            className="dir-ltr"
                                         >
                                            <ToggleGroupItem value="full" className="data-[state=on]:bg-green-600 data-[state=on]:text-white">מלא</ToggleGroupItem>
                                            <ToggleGroupItem value="custom" className="data-[state=on]:bg-orange-500 data-[state=on]:text-white">מותאם</ToggleGroupItem>
                                            <ToggleGroupItem value="off">כבוי</ToggleGroupItem>
                                        </ToggleGroup>
                                        <AccordionTrigger className="flex-1 text-right sm:pr-4 py-0 w-full" disabled={isAccordionDisabled}>
                                            <span className="font-medium">{stream.name}</span>
                                        </AccordionTrigger>
                                    </div>
                                    <AccordionContent>
                                        <div className={cn("p-4 pt-2 space-y-4 bg-muted/30", isAccordionDisabled && "opacity-50 pointer-events-none")}>
                                            <h4 className="font-semibold text-right">הרשאות ספציפיות לשידור:</h4>
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                <div className="flex items-center justify-between">
                                                    <Switch 
                                                        id={`dvr-${stream.name}`}
                                                        checked={streamPermissions[stream.name]?.canManageDVR ?? false}
                                                        onCheckedChange={(checked) => handleSpecificPermissionToggle(stream.name, 'canManageDVR', checked)}
                                                        disabled={areSwitchesDisabled}
                                                        dir="ltr"
                                                    />
                                                    <Label htmlFor={`dvr-${stream.name}`} className={cn("flex items-center gap-2", areSwitchesDisabled && "text-muted-foreground")}>ניהול DVR <Video className="h-4 w-4" /></Label>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Switch 
                                                        id={`thumbnails-${stream.name}`}
                                                        checked={streamPermissions[stream.name]?.canManageThumbnails ?? false}
                                                        onCheckedChange={(checked) => handleSpecificPermissionToggle(stream.name, 'canManageThumbnails', checked)}
                                                        disabled={areSwitchesDisabled}
                                                        dir="ltr"
                                                    />
                                                    <Label htmlFor={`thumbnails-${stream.name}`} className={cn("flex items-center gap-2", areSwitchesDisabled && "text-muted-foreground")}>ניהול תמונות ממוזערות <ImageIcon className="h-4 w-4" /></Label>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Switch 
                                                        id={`edit-${stream.name}`}
                                                        checked={streamPermissions[stream.name]?.canEditDetails ?? false}
                                                        onCheckedChange={(checked) => handleSpecificPermissionToggle(stream.name, 'canEditDetails', checked)}
                                                        disabled={areSwitchesDisabled}
                                                        dir="ltr"
                                                    />
                                                    <Label htmlFor={`edit-${stream.name}`} className={cn("flex items-center gap-2", areSwitchesDisabled && "text-muted-foreground")}>עריכת פרטי שידור <Edit className="h-4 w-4" /></Label>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Switch 
                                                        id={`protocols-${stream.name}`}
                                                        checked={streamPermissions[stream.name]?.canManageProtocols ?? false}
                                                        onCheckedChange={(checked) => handleSpecificPermissionToggle(stream.name, 'canManageProtocols', checked)}
                                                        disabled={areSwitchesDisabled}
                                                        dir="ltr"
                                                    />
                                                    <Label htmlFor={`protocols-${stream.name}`} className={cn("flex items-center gap-2", areSwitchesDisabled && "text-muted-foreground")}>ניהול פרוטוקולים <Settings2 className="h-4 w-4" /></Label>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <Switch 
                                                        id={`securelink-${stream.name}`}
                                                        checked={streamPermissions[stream.name]?.canCreateSecureLink ?? false}
                                                        onCheckedChange={(checked) => handleSpecificPermissionToggle(stream.name, 'canCreateSecureLink', checked)}
                                                        disabled={areSwitchesDisabled}
                                                        dir="ltr"
                                                    />
                                                    <Label htmlFor={`securelink-${stream.name}`} className={cn("flex items-center gap-2", areSwitchesDisabled && "text-muted-foreground")}>יצירת קישורים זמניים <Link2 className="h-4 w-4" /></Label>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            )})}
                        </Accordion>
                    ) : (
                        <p className="text-center text-muted-foreground p-8">לא נמצאו שידורים בשרת.</p>
                    )}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
                         <div className="flex gap-2">
                            <Button variant="destructive" size="sm" onClick={() => handleBulkWebRTC('disable')}>כבה שידור לכל הערוצים</Button>
                            <Button variant="default" size="sm" className="bg-green-600" onClick={() => handleBulkWebRTC('enable')}>הפעל שידור לכל הערוצים</Button>
                        </div>
                        <div className="text-right">
                            <CardTitle>הרשאות שידור מהדפדפן (WebRTC)</CardTitle>
                            <CardDescription>בחר אילו מהשידורים שללקוח יש גישה אליהם יהיו זמינים לו גם לשידור ישיר מהדפדפן.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {Object.keys(streamPermissions).length > 0 ? (
                        Object.keys(streamPermissions).map(streamName => (
                            <div key={streamName} className="flex items-center justify-between rounded-lg border p-3">
                                <Switch
                                    id={`webrtc-${streamName}`}
                                    checked={streamPermissions[streamName]?.canBroadcastWebRTC ?? false}
                                    onCheckedChange={(checked) => handleSpecificPermissionToggle(streamName, 'canBroadcastWebRTC', checked)}
                                    dir="ltr"
                                />
                                <Label htmlFor={`webrtc-${streamName}`} className="font-medium">{streamName}</Label>
                            </div>
                        ))
                    ) : (
                         <p className="text-center text-muted-foreground p-8">יש להעניק ללקוח גישה לשידורים תחילה בכרטיסייה "גישה לשידורים".</p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-start pt-4 mt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving}>
                   שמור את כל השינויים
                   {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}
