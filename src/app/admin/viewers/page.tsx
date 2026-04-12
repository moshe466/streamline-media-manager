

'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { type Viewer, addViewer, updateViewer, deleteViewer, resendViewerVerificationEmail, type NewViewerData, type ViewerDetailsUpdate, getAllViewers, updateViewersPermissions, deleteMultipleViewers, type ViewerPermissions } from '@/services/viewers';
import { type Client, getClients } from '@/services/clients';
import type { AuthContext } from '@/services/security';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCheck, Users, Search, MoreHorizontal, Edit, Send, Trash2, PlusCircle, Loader2, ShieldCheck, Video, Tv, SlidersHorizontal, ArrowRight, CalendarIcon, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/logo';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, addHours, isPast, set } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { resolveRequestByViewerId } from '@/services/requests';


interface ClientWithViewers extends Client {
  viewers: Viewer[];
}

type DialogMode = 'create' | 'edit';
type EditingViewer = Viewer | null;
type TargetClient = Client | null;

function AdminViewersPageComponent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<ClientWithViewers[]>([]);
  const [availableStreams, setAvailableStreams] = useState<FlussonicStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingViewer, setEditingViewer] = useState<EditingViewer>(null);
  const [targetClient, setTargetClient] = useState<TargetClient>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actioningViewer, setActioningViewer] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Permissions state
  const [selectedViewerIds, setSelectedViewerIds] = useState<string[]>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<ViewerPermissions>({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const auth: AuthContext = {
    userId: sessionStorage.getItem('userId') || '',
    sessionId: sessionStorage.getItem('activeSessionId') || ''
  };


  const fetchData = useCallback(async () => {
      setIsLoading(true);
      try {
        const [clients, allViewers, streams] = await Promise.all([
          getClients(auth),
          getAllViewers(),
          getStreams(),
        ]);
        
        setAvailableStreams(streams);
        
        const viewersByClientId = allViewers.reduce((acc, viewer) => {
          (acc[viewer.clientId] = acc[viewer.clientId] || []).push(viewer);
          return acc;
        }, {} as Record<string, Viewer[]>);
        
        const clientsWithViewers = clients.map(client => ({
          ...client,
          viewers: viewersByClientId[client.id] || []
        })).sort((a,b) => a.nickname.localeCompare(b.nickname));

        setData(clientsWithViewers);
      } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את הנתונים.' });
      } finally {
        setIsLoading(false);
      }
    }, [toast]);

  useEffect(() => {
    const userRole = sessionStorage.getItem('userRole');
    if (userRole !== 'super-admin' && userRole !== 'admin' && !sessionStorage.getItem('canAccessUsers')) {
      toast({ variant: 'destructive', title: 'אין הרשאה', description: 'אין לך גישה לעמוד זה.' });
      router.push('/admin/dashboard');
      return;
    }
    fetchData();
  }, [router, toast, fetchData]);


  const resetForm = () => {
    setFirstName(''); setLastName(''); setNickname(''); setPhone(''); setEmail('');
    setEditingViewer(null); setTargetClient(null);
  }

  const openDialog = (mode: DialogMode, client: TargetClient, viewer: EditingViewer = null) => {
    resetForm();
    setDialogMode(mode);
    setTargetClient(client);

    if (mode === 'edit' && viewer) {
        setEditingViewer(viewer); setFirstName(viewer.firstName); setLastName(viewer.lastName);
        setNickname(viewer.nickname); setPhone(viewer.phone); setEmail(viewer.email);
    }
    setDialogOpen(true);
  }
  
  const handleDialogSubmit = async () => {
    if (!firstName || !lastName || !phone || !email || (dialogMode === 'create' && !targetClient)) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא מלא את כל שדות החובה." });
      return;
    }
    setIsProcessing(true);
    
    try {
      if (dialogMode === 'create' && targetClient) {
        const finalNickname = nickname.trim() === '' ? `${firstName} ${lastName}` : nickname;
        await addViewer({ clientId: targetClient.id, firstName, lastName, nickname: finalNickname, phone, email, expiresAt: null });
        toast({ title: "הצלחה", description: `מייל אימות עם קוד חד-פעמי נשלח לצופה "${finalNickname}".` });
      } else if (dialogMode === 'edit' && editingViewer) {
        const finalNickname = nickname.trim() === '' ? `${firstName} ${lastName}` : nickname;
        await updateViewer(editingViewer.id, { firstName, lastName, nickname: finalNickname, phone });
        toast({ title: "הצלחה", description: "פרטי הצופה עודכנו." });
      }
      setDialogOpen(false); resetForm(); fetchData();
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
    } finally { setIsProcessing(false); }
  }

  const handleDeleteViewer = async (viewer: Viewer) => {
     setActioningViewer(viewer.id);
     try {
        await deleteViewer(viewer.id);
        toast({ variant: "destructive", title: "צופה נמחק" });
        fetchData();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הצופה." });
     } finally { setActioningViewer(null); }
  }

  const handleBulkDelete = async () => {
     setIsProcessing(true);
     try {
        await deleteMultipleViewers(selectedViewerIds);
        toast({ variant: "destructive", title: "צופים נמחקו", description: `${selectedViewerIds.length} צופים הוסרו מהמערכת.` });
        setSelectedViewerIds([]); fetchData();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הצופים." });
     } finally { setIsProcessing(false); }
  };
  
  const handleResendOtp = async (viewer: Viewer) => {
    setActioningViewer(viewer.id);
    try {
        await resendViewerVerificationEmail(viewer.id);
        toast({ title: "הצלחה", description: `קוד אימות חדש נשלח ל-${viewer.email}.` });
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח את המייל." });
    } finally { setActioningViewer(null); }
  }

  const openPermissionsDialog = (client: Client, viewer?: Viewer) => {
    let viewersToEdit: Viewer[] = [];
    if (viewer) {
      viewersToEdit = [viewer];
      setSelectedViewerIds([viewer.id]);
    } else {
      if (selectedViewerIds.length === 0) return;
      viewersToEdit = ((client as Client & { viewers?: Viewer[] }).viewers ?? []).filter(v => selectedViewerIds.includes(v.id));
    }
    
    if (viewersToEdit.length > 0) {
      setPermissionState(viewersToEdit[0].permissions || {});
    }
    setTargetClient(client);
    setPermissionsDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
        await updateViewersPermissions(selectedViewerIds, permissionState);
        toast({ title: 'ההרשאות עודכנו', description: `הרשאות הצפייה עודכנו עבור ${selectedViewerIds.length} צופים.` });
        setPermissionsDialogOpen(false);
        setSelectedViewerIds([]);
        fetchData();
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה בעדכון הרשאות", description: (error as Error).message });
    } finally { setIsSavingPermissions(false); }
  };

  const handlePermissionChange = (streamName: string, type: 'canWatchLive' | 'canWatchDVR' | 'canWatchMCR', checked: boolean) => {
    setPermissionState(prev => {
      const newPermissions = { ...prev };
      if (!newPermissions[streamName]) newPermissions[streamName] = { canWatchLive: false, canWatchDVR: false, canWatchMCR: false };
      newPermissions[streamName][type] = checked;
      return newPermissions;
    });
  };

  const filteredData = useMemo(() => {
    return data.map(client => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return client;
      
      const clientNameMatch = client.nickname.toLowerCase().includes(query);
      const filteredViewers = client.viewers.filter(viewer => 
          viewer.nickname.toLowerCase().includes(query) ||
          `${viewer.firstName} ${viewer.lastName}`.toLowerCase().includes(query) ||
          viewer.email.toLowerCase().includes(query)
      );

      if (clientNameMatch || filteredViewers.length > 0) {
        return {...client, viewers: clientNameMatch ? client.viewers : filteredViewers };
      }
      return null;
    }).filter(Boolean) as ClientWithViewers[];
  }, [data, searchQuery]);

  const getPermissionCount = (viewer: Viewer): string => {
      const perms = viewer.permissions || {};
      const liveCount = Object.values(perms).filter(p => p.canWatchLive).length;
      const dvrCount = Object.values(perms).filter(p => p.canWatchDVR).length;
      const mcrCount = Object.values(perms).filter(p => p.canWatchMCR).length;
      return `L:${liveCount}, D:${dvrCount}, M:${mcrCount}`;
  }

  if (isLoading) return <div className="p-8"><Skeleton className="w-full h-96" /></div>;

  return (
    <div className="space-y-8 text-right">
        {/* DIALOGS */}
        <Dialog open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setDialogOpen(isOpen); }}>
            <DialogContent className="sm:max-w-[425px] text-right">
              <DialogHeader><DialogTitle>{dialogMode === 'create' ? `הוספת צופה חדש עבור ${targetClient?.nickname}` : `עריכת פרטי צופה`}</DialogTitle><DialogDescription>{dialogMode === 'create' ? 'מלא את הפרטים ליצירת חשבון צופה חדש.' : `ערוך את הפרטים עבור ${editingViewer?.nickname}.`}</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Input id="firstName" placeholder="שם פרטי (חובה)" className="col-span-3" dir="rtl" value={firstName} onChange={(e) => setFirstName(e.target.value)} /><Label htmlFor="firstName" className="text-right">שם פרטי</Label></div>
                <div className="grid grid-cols-4 items-center gap-4"><Input id="lastName" placeholder="שם משפחה (חובה)" className="col-span-3" dir="rtl" value={lastName} onChange={(e) => setLastName(e.target.value)} /><Label htmlFor="lastName" className="text-right">שם משפחה</Label></div>
                <div className="grid grid-cols-4 items-center gap-4"><Input id="nickname" placeholder="כינוי (רשות)" className="col-span-3" dir="rtl" value={nickname} onChange={(e) => setNickname(e.target.value)} /><Label htmlFor="nickname" className="text-right">כינוי</Label></div>
                <div className="grid grid-cols-4 items-center gap-4"><Input id="phone" type="tel" placeholder="מספר טלפון (חובה)" className="col-span-3" dir="rtl" value={phone} onChange={(e) => setPhone(e.target.value)} /><Label htmlFor="phone" className="text-right">טלפון</Label></div>
                <div className="grid grid-cols-4 items-center gap-4"><Input id="email" type="email" placeholder="viewer@example.com (חובה)" className="col-span-3" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} disabled={dialogMode === 'edit'}/><Label htmlFor="email" className="text-right">אימייל</Label></div>
              </div>
              <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleDialogSubmit} disabled={isProcessing}>{isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{dialogMode === 'create' ? 'הוסף צופה' : 'שמור שינויים'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
            <DialogContent className="sm:max-w-lg text-right">
                <DialogHeader><DialogTitle>ניהול הרשאות צפייה</DialogTitle><DialogDescription>בחר לאילו שידורים תהיה גישה ל-{selectedViewerIds.length} הצופים שנבחרו.</DialogDescription></DialogHeader>
                <div className="py-4"><ScrollArea className="h-72 w-full rounded-md border p-4"><div className="space-y-4">
                    {availableStreams.map((stream) => (
                        <div key={stream.name}><h4 className="font-semibold text-right mb-2">{stream.name}</h4><div className="space-y-2 pr-4">
                            <div className="flex items-center justify-between"><Checkbox id={`live-${stream.name}`} checked={permissionState[stream.name]?.canWatchLive || false} onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchLive', !!checked)} /><Label htmlFor={`live-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה בשידור חי <Tv className="h-4 w-4 text-green-500" /></Label></div>
                            <div className="flex items-center justify-between"><Checkbox id={`dvr-${stream.name}`} checked={permissionState[stream.name]?.canWatchDVR || false} onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchDVR', !!checked)} /><Label htmlFor={`dvr-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה ב-DVR <Video className="h-4 w-4 text-blue-500" /></Label></div>
                            <div className="flex items-center justify-between"><Checkbox id={`mcr-${stream.name}`} checked={permissionState[stream.name]?.canWatchMCR || false} onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchMCR', !!checked)} /><Label htmlFor={`mcr-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה ב-MCR <SlidersHorizontal className="h-4 w-4 text-purple-500" /></Label></div>
                        </div>{availableStreams.indexOf(stream) < availableStreams.length - 1 && <Separator className="mt-4" />}</div>
                    ))}
                </div></ScrollArea></div>
                <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleSavePermissions} disabled={isSavingPermissions}>{isSavingPermissions && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}שמור שינויים</Button></DialogFooter>
            </DialogContent>
        </Dialog>

       <div className="flex items-center justify-between">
            <div></div>
            <div className="space-y-2 text-right"><h1 className="text-3xl font-bold tracking-tight">רשימת צופים (לפי לקוח)</h1><p className="text-muted-foreground">סקירה כללית של כל הצופים במערכת, מקובצים לפי הלקוח שיצר אותם.</p></div>
        </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">כל הצופים<UserCheck className="h-5 w-5" /></CardTitle>
          <CardDescription>לחץ על שם לקוח כדי להציג או להסתיר את רשימת הצופים שלו.</CardDescription>
           <div className="relative pt-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="חיפוש לפי שם לקוח או פרטי צופה..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <Accordion type="multiple" value={openAccordionItems} onValueChange={setOpenAccordionItems} className="w-full">
              {filteredData.map(client => (
                <AccordionItem value={client.id} key={client.id}>
                    <AccordionTrigger><div className="flex items-center gap-2"><span className="text-xs font-normal text-muted-foreground">({client.viewers.length} צופים)</span><span className="font-semibold">{client.nickname}</span><Users className="h-4 w-4" /></div></AccordionTrigger>
                    <AccordionContent><div className="space-y-4">
                        <div className="flex justify-between">
                            <Button size="sm" variant="outline" onClick={() => openDialog('create', client)}><PlusCircle className="ml-2 h-4 w-4"/>הוסף צופה ללקוח זה</Button>
                            {selectedViewerIds.filter(id => client.viewers.some(v => v.id === id)).length > 0 && (
                                <div className="flex gap-2">
                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="ml-2 h-4 w-4" />מחק נבחרים</Button></AlertDialogTrigger><AlertDialogContent className="text-right"><AlertDialogHeader><AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle><AlertDialogDescription>פעולה זו תמחק לצמיתות {selectedViewerIds.filter(id => client.viewers.some(v => v.id === id)).length} צופים. לא ניתן לבטל פעולה זו.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">כן, מחק צופים</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                    <Button size="sm" onClick={() => openPermissionsDialog(client)}><ShieldCheck className="ml-2 h-4 w-4"/>ניהול הרשאות</Button>
                                </div>
                            )}
                        </div>
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="w-[50px]"><Checkbox
                                    checked={client.viewers.length > 0 && client.viewers.every(v => selectedViewerIds.includes(v.id))}
                                    onCheckedChange={(checked) => { const viewerIds = client.viewers.map(v => v.id); setSelectedViewerIds(prev => checked ? [...new Set([...prev, ...viewerIds])] : prev.filter(id => !viewerIds.includes(id)) ); }}
                                /></TableHead>
                                <TableHead className="w-[50px] text-right">פעולות</TableHead>
                                <TableHead className="text-right">כינוי</TableHead>
                                <TableHead className="text-right">אימייל</TableHead>
                                <TableHead className="text-right">הרשאות</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>{client.viewers.length > 0 ? client.viewers.map(viewer => (
                                <TableRow key={viewer.id} data-state={selectedViewerIds.includes(viewer.id) && "selected"}>
                                    <TableCell><Checkbox checked={selectedViewerIds.includes(viewer.id)} onCheckedChange={(checked) => setSelectedViewerIds(prev => checked ? [...prev, viewer.id] : prev.filter(id => id !== viewer.id))} /></TableCell>
                                    <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningViewer === viewer.id}>{actioningViewer === viewer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}</Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="text-right">
                                            <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => openDialog('edit', client, viewer)}><Edit className="ml-2 h-4 w-4" /><span>ערוך פרטים</span></DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openPermissionsDialog(client, viewer)}><ShieldCheck className="ml-2 h-4 w-4"/><span>הרשאות</span></DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleResendOtp(viewer)}><Send className="ml-2 h-4 w-4" /><span>שלח קוד חדש</span></DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialog><AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /><span>מחק צופה</span></DropdownMenuItem></AlertDialogTrigger><AlertDialogContent className="text-right"><AlertDialogHeader><AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle><AlertDialogDescription>פעולה זו תמחק את הצופה <strong>{viewer.nickname}</strong> לצמיתות.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteViewer(viewer)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">כן, מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu></TableCell>
                                    <TableCell className="font-medium">{viewer.nickname}</TableCell>
                                    <TableCell>{viewer.email}</TableCell>
                                    <TableCell className="font-mono text-center text-xs">{getPermissionCount(viewer)}</TableCell>
                                </TableRow>
                            )) : ( <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">ללקוח זה אין עדיין צופים.</TableCell></TableRow> )}
                            </TableBody>
                        </Table>
                    </div></AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <UserCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold">לא נמצאו לקוחות או צופים</h3>
              <p className="mt-1 text-sm">{searchQuery ? `החיפוש "${searchQuery}" לא הניב תוצאות.` : 'אין לקוחות עם צופים רשומים במערכת.'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminViewersPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="w-full h-96" /></div>}>
            <AdminViewersPageComponent />
        </Suspense>
    )
}
