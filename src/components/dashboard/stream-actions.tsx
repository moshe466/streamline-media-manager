
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Settings, Tv, Search, List, Wifi, WifiOff, AlertTriangle, User, Eye, ArrowUpDown } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { createStream, deleteStream, type FlussonicStream, getFlussonicConnectionDetails } from '@/services/flussonic';
import { cn } from '@/lib/utils';
import { getClients, type Client, getClientById } from '@/services/clients';
import Link from 'next/link';
import { StreamCardImage } from './stream-card-image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"


interface StreamActionsProps {
    streams: FlussonicStream[];
    error?: string | null;
    userType?: 'admin' | 'client';
    clientId?: string;
}

type SortOption = 'offline-first' | 'online-first' | 'name-asc' | 'name-desc';

export function StreamActions({ streams: initialStreams, error = null, userType = 'admin', clientId }: StreamActionsProps) {
  const { toast } = useToast();
  const router = useRouter();

  const streams = initialStreams || [];

  const [clients, setClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<Client | null>(null);
  
  const [clientPermissions, setClientPermissions] = useState<{ canCreate: boolean, canDelete: boolean, streamLimit: number | typeof Infinity }>({ canCreate: false, canDelete: false, streamLimit: 0 });

  const [isProcessing, setIsProcessing] = useState(false);
  const [actioningStream, setActioningStream] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('offline-first');
  
  const [viewingStreamName, setViewingStreamName] = useState<string | null>(null);
  const [previewHost, setPreviewHost] = useState<string>('');


  const [dialogOpen, setDialogOpen] = useState(false);
  const [streamName, setStreamName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');

  const prevStreamsRef = useRef<Map<string, string>>(new Map());

  const getAuthContext = useCallback(() => {
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return null;
    return { userId, sessionId };
  }, []);

  useEffect(() => {
        // Initialize the previous streams map
        const initialMap = new Map();
        streams.forEach(stream => {
            initialMap.set(stream.name, stream.status);
        });
        prevStreamsRef.current = initialMap;
    }, []);


    useEffect(() => {
        const currentStreamsMap = new Map<string, string>();
        streams.forEach(stream => {
            currentStreamsMap.set(stream.name, stream.status);

            const prevStatus = prevStreamsRef.current.get(stream.name);
            const currentStatus = stream.status;

            if (prevStatus && prevStatus !== currentStatus) {
                if (currentStatus === 'online') {
                } else {
                }
            }
        });
        prevStreamsRef.current = currentStreamsMap;
        
        if (userType === 'admin') {
          // Note: getClients now requires auth too
          const auth = getAuthContext();
          if (auth) getClients(auth).then(setClients);
        }
        
        if (userType === 'client' && clientId) {
          const clientDataString = sessionStorage.getItem('clientData');
          if (clientDataString) {
              const client = JSON.parse(clientDataString);
              setClientData(client);
              setClientPermissions({
                canCreate: client.permissions.canCreateStreams,
                canDelete: client.permissions.canDeleteStreams,
                streamLimit: client.permissions.maxStreams,
              });
          }
        }
  }, [streams, userType, clientId, getAuthContext]);
  

  const resetForm = () => {
    setStreamName(''); setSourceUrl(''); setStreamTitle('');
  }

  const handleDialogSubmit = async () => {
    const auth = getAuthContext();
    if (!auth) {
        toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'יש להתחבר מחדש.' });
        return;
    }

    if (!streamName) {
      toast({ variant: "destructive", title: "שם שידור חסר" });
      return;
    }
     if (/[^a-zA-Z0-9_]/.test(streamName)) {
        toast({ variant: "destructive", title: "שם שידור לא תקין", description: "אותיות באנגלית, מספרים וקו תחתון (_)." });
        return;
    }

    if (userType === 'client' && clientId) {
      if (clientPermissions.streamLimit !== Infinity) {
          const streamsCreatedByClient = streams.filter(s => s.comment === clientData?.nickname).length;
          if (streamsCreatedByClient >= clientPermissions.streamLimit) {
               toast({ variant: "destructive", title: "מגבלת שידורים", description: `הגעת למכסת השידורים שאתה יכול ליצור (${clientPermissions.streamLimit}).` });
               return;
          }
      }
    }
    
    setIsProcessing(true);
    try {
        const creatorId = userType === 'client' ? clientId : auth.userId;
        const instanceId = clientData?.instanceId || 'default';
        const result = await createStream(auth, streamName, sourceUrl, streamTitle, creatorId, instanceId);
        if (result.success) {
            toast({ title: "הצלחה!", description: `השידור "${streamName}" נוצר.` });
            setDialogOpen(false);
            resetForm();
            
            if (userType === 'client' && result.updatedClient) {
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
            }

            router.push(getStreamManagementLink(streamName));

        } else {
            throw new Error(result.error || "אירעה שגיאה לא צפויה.");
        }
    } catch (error) {
        const errorMessage = (error as Error).message;
        toast({ variant: "destructive", title: "שגיאה ביצירת שידור", description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  }

  const handleDeleteStream = async (stream: FlussonicStream) => {
     const auth = getAuthContext();
     if (!auth) return;

     setActioningStream(stream.name);
     try {
        const instanceId = clientData?.instanceId || 'default';
        const result = await deleteStream(auth, stream.name, clientId, instanceId);
        if (result.success) {
            toast({ variant: "destructive", title: "שידור נמחק", description: `השידור ${stream.name} הוסר.` });
            
            if (userType === 'client' && result.updatedClient) {
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
            }
        } else {
             throw new Error(result.error || "לא ניתן היה למחוק את השידור.");
        }
     } catch (error) {
        const errorMessage = (error as Error).message;
        toast({ variant: "destructive", title: "שגיאה במחיקת שידור", description: errorMessage });
     } finally {
        setActioningStream(null);
     }
  }
  
  const handleOpenPreview = useCallback(async (name: string) => {
      const instanceId = clientData?.instanceId || 'default';
      const details = await getFlussonicConnectionDetails(instanceId);
      setPreviewHost(details.publicHost);
      setViewingStreamName(name);
  }, [clientData?.instanceId]);

  const onlineCount = useMemo(() => streams.filter(s => s.status === 'online').length, [streams]);
  const offlineCount = useMemo(() => streams.filter(s => s.status === 'offline').length, [streams]);
  
  const filteredStreams = useMemo(() => {
     return streams
        .filter(stream => {
            const statusMatch = statusFilter === 'all' || stream.status === statusFilter;
            
            let searchMatch = !searchQuery || stream.name.toLowerCase().includes(searchQuery.toLowerCase()) || (stream.title && stream.title.toLowerCase().includes(searchQuery.toLowerCase()));
            
            if (!searchMatch && stream.comment && stream.comment.toLowerCase().includes(searchQuery.toLowerCase())) {
                searchMatch = true;
            }

            return statusMatch && searchMatch;
        })
        .sort((a, b) => {
            switch (sortOption) {
                case 'offline-first':
                    if (a.status === 'offline' && b.status === 'online') return -1;
                    if (a.status === 'online' && b.status === 'offline') return 1;
                    return a.name.localeCompare(b.name);
                case 'online-first':
                    if (a.status === 'online' && b.status === 'offline') return -1;
                    if (a.status === 'offline' && b.status === 'online') return 1;
                    return a.name.localeCompare(b.name);
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                default:
                    return 0;
            }
        });
  }, [streams, statusFilter, searchQuery, sortOption]);
  
  const canCreateStreams = userType === 'admin' || (userType === 'client' && clientPermissions.canCreate);
  const canDeleteStreams = userType === 'admin' || (userType === 'client' && clientPermissions.canDelete);

  const getStreamManagementLink = (streamName: string) => {
      return `/${userType}/${userType === 'client' ? `${clientId}/` : ''}streams/${encodeURIComponent(streamName)}`;
  }


  return (
    <div className="space-y-8 text-right">
      <Dialog open={!!viewingStreamName} onOpenChange={(isOpen) => !isOpen && setViewingStreamName(null)}>
        <DialogContent className="max-w-4xl p-0">
          <div className="aspect-video">
            {viewingStreamName && previewHost && (
               <iframe
                  src={`https://${previewHost}/${viewingStreamName}/embed.html`}
                  allowFullScreen
                  className="w-full h-full border-0"
                ></iframe>
            )}
          </div>
        </DialogContent>
      </Dialog>


      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {canCreateStreams && (
          <Dialog open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setDialogOpen(isOpen); }}>
            <DialogTrigger asChild><Button data-tour="streams-create-button"><PlusCircle className="ml-2 h-4 w-4" />צור שידור חדש</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[425px] text-right">
              <DialogHeader><DialogTitle>יצירת שידור חדש</DialogTitle><DialogDescription>מלא את הפרטים ליצירת שידור חדש.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label htmlFor="stream-name">שם השידור (חובה)</Label><Input id="stream-name" placeholder="live_event_1" dir="ltr" value={streamName} onChange={(e) => setStreamName(e.target.value)} /><p className="text-xs text-muted-foreground">באנגלית בלבד, ללא רווחים.</p></div>
                <div className="space-y-2"><Label htmlFor="source-url">כתובת מקור (אופציונלי)</Label><Input id="source-url" placeholder="rtmp://..." dir="ltr" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /><p className="text-xs text-muted-foreground">במידה ויש לך RTMP מוכן מראש.</p></div>
                <div className="space-y-2"><Label htmlFor="stream-title">כותרת שידור (אופציונלי)</Label><Input id="stream-title" placeholder="שידור מהאולפן הראשי" dir="rtl" value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} /><p className="text-xs text-muted-foreground">תיאור שיווקי לצופים או לזיהוי פנימי.</p></div>
                {userType === 'client' && clientData && (
                   <div className="space-y-2">
                      <Label>יוצר השידור</Label>
                       <div className="flex items-center justify-end gap-2 p-2 border rounded-md bg-muted/50">
                          <span className="text-sm font-medium">{clientData.nickname}</span>
                          <User className="h-4 w-4 text-muted-foreground" />
                       </div>
                       <p className="text-xs text-muted-foreground">מזוהה אוטומטית לפי החשבון שלך.</p>
                   </div>
                )}
              </div>
              <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleDialogSubmit} disabled={isProcessing}>{isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}צור שידור</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <div className="space-y-2 text-left">
          <h1 className="text-3xl font-bold tracking-tight">ניהול שידורים</h1>
          <p className="text-muted-foreground">יצירה, ניהול ומחיקה של שידורים חיים בשרת.</p>
        </div>
      </div>

       <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
               <div className="flex justify-end items-center gap-2 flex-wrap">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                מיון
                                <ArrowUpDown className="mr-2 h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-right">
                             <DropdownMenuLabel>סדר מיון</DropdownMenuLabel>
                             <DropdownMenuSeparator/>
                             <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                                <DropdownMenuRadioItem value="offline-first">אופליין תחילה</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="online-first">אונליין תחילה</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="name-asc">שם (א-ת)</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="name-desc">שם (ת-א)</DropdownMenuRadioItem>
                             </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}><span className="bg-primary-foreground text-primary rounded-full px-2 py-0.5 text-xs ml-2">{streams.length}</span>הכל<List className="mr-2 h-4 w-4" /></Button>
                    <Button variant={statusFilter === 'online' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('online')}><span className="bg-green-600 text-primary-foreground rounded-full px-2 py-0.5 text-xs ml-2">{onlineCount}</span>אונליין<Wifi className="mr-2 h-4 w-4" /></Button>
                    <Button variant={statusFilter === 'offline' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('offline')}><span className="bg-red-600 text-destructive-foreground rounded-full px-2 py-0.5 text-xs ml-2">{offlineCount}</span>אופליין<WifiOff className="mr-2 h-4 w-4" /></Button>
               </div>
               <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="חיפוש לפי שם, כותרת או יוצר..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
           </div>
        </CardHeader>
        <CardContent>
            {filteredStreams.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredStreams.map(stream => {
                        const streamClient = clients.find(c => c.nickname === stream.comment) || clientData;
                        return (
                            <Card key={stream.name} className="overflow-hidden flex flex-col group text-right">
                               <CardHeader className="p-0 relative">
                                   <div className="aspect-video relative overflow-hidden bg-muted">
                                       <StreamCardImage stream={stream} client={streamClient} />
                                       <div className={cn("absolute top-2 right-2 flex items-center gap-1 text-white text-xs font-bold px-2 py-1 rounded-md", stream.status === 'online' ? 'bg-green-600' : 'bg-red-600')}>
                                           {stream.status === 'online' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                           {stream.status === 'online' ? 'אונליין' : 'אופליין'}
                                       </div>
                                   </div>
                               </CardHeader>
                                <CardContent className="p-4 flex-1">
                                    <CardTitle className="truncate" title={stream.name}>{stream.name}</CardTitle>
                                    <CardDescription className="mt-1 truncate" title={stream.title}>{stream.title || 'ללא כותרת'}</CardDescription>
                                    {stream.comment && userType === 'admin' && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 justify-end">
                                            <span>{stream.comment}</span>
                                            <User className="h-3 w-3" />
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="bg-muted/50 p-2 flex justify-between">
                                     <div className="flex items-center">
                                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPreview(stream.name)} disabled={stream.status !== 'online'}>
                                            <Eye className="h-4 w-4" />
                                         </Button>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actioningStream === stream.name}>
                                                    {actioningStream === stream.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="text-right">
                                                {canDeleteStreams && (
                                                     <AlertDialog>
                                                         <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                <Trash2 className="ml-2 h-4 w-4" />
                                                                <span>מחק שידור</span>
                                                            </DropdownMenuItem>
                                                         </AlertDialogTrigger>
                                                         <AlertDialogContent className="text-right">
                                                            <AlertDialogHeader><AlertDialogTitle>למחוק את {stream.name}?</AlertDialogTitle><AlertDialogDescription>פעולה זו לא ניתנת לביטול.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteStream(stream)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">כן, מחק</AlertDialogAction></AlertDialogFooter>
                                                         </AlertDialogContent>
                                                     </AlertDialog>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                     </div>
                                    <Button asChild variant="secondary" className="flex-1" size="sm">
                                        <Link href={getStreamManagementLink(stream.name)}>
                                            <Settings className="ml-2 h-4 w-4" />
                                            ניהול
                                        </Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <Tv className="mx-auto h-12 w-12" />
                    <h2 className="mt-4 text-xl font-semibold">
                        {error ? "שגיאה בטעינת שידורים" : "לא נמצאו שידורים"}
                    </h2>
                    <p className="mt-2 text-sm">
                       {error ? "לא ניתן היה להתחבר לשרת המדיה. ודא שפרטי ההתחברות נכונים." : (searchQuery ? `החיפוש "${searchQuery}" לא הניב תוצאות.` : "לא נמצאו שידורים התואמים לסינון.")}
                    </p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
