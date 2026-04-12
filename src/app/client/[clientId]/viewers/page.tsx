
'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Edit, Users, Search, Send, Upload, ShieldCheck, Check, Tv, Video, SlidersHorizontal, ArrowRight, CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
import { getClientById, type Client } from '@/services/clients';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { getViewersByClientId, addViewer, updateViewer, deleteViewer, resendViewerVerificationEmail, bulkAddViewers, updateViewersPermissions, type Viewer, type NewViewerData, type ViewerDetailsUpdate, type ViewerPermissions, deleteMultipleViewers } from '@/services/viewers';
import * as XLSX from 'xlsx';


interface ClientWithViewers extends Client {
  viewers: Viewer[];
}

type DialogMode = 'create' | 'edit';
type EditingViewer = Viewer | null;
type TargetClient = Client | null;

function ViewersPageComponent() {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = decodeURIComponent(params.clientId as string);

  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [availableStreams, setAvailableStreams] = useState<FlussonicStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actioningViewer, setActioningViewer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClient, setIsClient] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingViewer, setEditingViewer] = useState<EditingViewer | null>(null);
  const [permissionDeniedDialogOpen, setPermissionDeniedDialogOpen] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Expiration state
  const [expiryType, setExpiryType] = useState<'24h' | 'custom' | 'none'>('24h');
  const [customExpiryDate, setCustomExpiryDate] = useState<Date | undefined>();
  const [customExpiryTime, setCustomExpiryTime] = useState('00:00');


  // Bulk upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Permissions state
  const [selectedViewerIds, setSelectedViewerIds] = useState<string[]>([]);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<ViewerPermissions>({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);


  const fetchPageData = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
        const clientDataString = sessionStorage.getItem('clientData');
        if (!clientDataString) throw new Error("Client data not found. Please log in again.");
        
        const clientData: Client = JSON.parse(clientDataString);

        if (!clientData.permissions?.canCreateViewers) {
            setPermissionDeniedDialogOpen(true);
            setIsLoading(false);
            return;
        }

        setClient(clientData);

        const [fetchedViewers, allStreams] = await Promise.all([
            getViewersByClientId(clientId),
            getStreams()
        ]);
        
        setViewers(fetchedViewers);
        
        const streamsForClient = clientData.permissions.hasAllStreamsAccess
            ? allStreams
            : allStreams.filter(stream => Object.keys(clientData.permissions.allowedStreams).includes(stream.name));

        setAvailableStreams(streamsForClient);
        
        // Check for edit query param
        const viewerIdToEdit = searchParams.get('edit');
        if (viewerIdToEdit) {
            const viewerToEdit = fetchedViewers.find(v => v.id === viewerIdToEdit);
            if (viewerToEdit) {
                openDialog('edit', viewerToEdit);
                // Remove param from URL to avoid re-opening on refresh
                router.replace(`/client/${clientId}/viewers`, { scroll: false });
            }
        }

    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
        router.push(`/client/${clientId}/dashboard`);
    } finally {
        setIsLoading(false);
    }
  }, [clientId, router, toast, searchParams]);

  useEffect(() => {
    setIsClient(true);
    fetchPageData();
  }, [fetchPageData]);
  
  const resetForm = () => {
    setFirstName(''); setLastName(''); setNickname(''); setPhone(''); setEmail(''); setEditingViewer(null);
    setExpiryType('24h'); setCustomExpiryDate(undefined); setCustomExpiryTime('00:00');
  };

  const openDialog = (mode: DialogMode, viewer: EditingViewer = null) => {
    resetForm();
    setDialogMode(mode);
    if (mode === 'edit' && viewer) {
        setEditingViewer(viewer); setFirstName(viewer.firstName); setLastName(viewer.lastName); setNickname(viewer.nickname); setPhone(viewer.phone); setEmail(viewer.email);
        if (viewer.expiresAt) {
            const expiry = parseISO(viewer.expiresAt);
            setExpiryType('custom');
            setCustomExpiryDate(expiry);
            setCustomExpiryTime(format(expiry, 'HH:mm'));
        } else {
            setExpiryType('none');
        }
        // If opening from a request, default to 24h expiration
        if(searchParams.get('edit')) {
             setExpiryType('24h');
             setCustomExpiryDate(undefined);
             setCustomExpiryTime('00:00');
        }
    }
    setDialogOpen(true);
  };
  
  const handleDialogSubmit = async () => {
    if (!firstName || !lastName || !phone || !email) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא מלא את כל שדות החובה." });
      return;
    }
    setIsProcessing(true);
    
    let expiresAt: string | null = null;
    if (expiryType === '24h') {
        expiresAt = addHours(new Date(), 24).toISOString();
    } else if (expiryType === 'custom' && customExpiryDate) {
        const [hours, minutes] = customExpiryTime.split(':').map(Number);
        const finalDate = set(customExpiryDate, { hours, minutes });
        expiresAt = finalDate.toISOString();
    }

    const portalOrigin = (localStorage.getItem('loginEntryPoint') as 'uh' | 'standard') || 'standard';

    try {
      if (dialogMode === 'create') {
        const finalNickname = nickname.trim() === '' ? `${firstName} ${lastName}` : nickname;
        await addViewer({ clientId, firstName, lastName, nickname: finalNickname, phone, email, expiresAt, portalOrigin });
        toast({ title: "הצלחה", description: `מייל אימות נשלח לצופה "${finalNickname}".` });
      } else if (dialogMode === 'edit' && editingViewer) {
        const finalNickname = nickname.trim() === '' ? `${firstName} ${lastName}` : nickname;
        await updateViewer(editingViewer.id, { firstName, lastName, nickname: finalNickname, phone, expiresAt });
        
        // If this edit came from a request, resolve the request
        if(searchParams.get('edit') === editingViewer.id) {
            await resolveRequestByViewerId(editingViewer.id, 'approve');
            toast({ title: "הבקשה אושרה!", description: `הגישה עבור ${finalNickname} חודשה.` });
        } else {
            toast({ title: "הצלחה", description: "פרטי הצופה עודכנו." });
        }
      }
      setDialogOpen(false); resetForm(); await fetchPageData();
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDeleteViewer = async (viewer: Viewer) => {
     setActioningViewer(viewer.id);
     try {
        await deleteViewer(viewer.id);
        toast({ variant: "destructive", title: "צופה נמחק" });
        await fetchPageData();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הצופה." });
     } finally {
        setActioningViewer(null);
     }
  };

  const handleBulkDelete = async () => {
     setIsProcessing(true);
     try {
        await deleteMultipleViewers(selectedViewerIds);
        toast({ variant: "destructive", title: "צופים נמחקו", description: `${selectedViewerIds.length} צופים הוסרו מהמערכת.` });
        setSelectedViewerIds([]);
        await fetchPageData();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הצופים." });
     } finally {
        setIsProcessing(false);
     }
  };
  
  const handleResendOtp = async (viewer: Viewer) => {
    setActioningViewer(viewer.id);
    try {
        await resendViewerVerificationEmail(viewer.id);
        toast({ title: "הצלחה", description: `קוד אימות חדש נשלח ל-${viewer.email}.` });
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח את המייל." });
    } finally {
        setActioningViewer(null);
    }
  };
  
  const handleFileUpload = async () => {
    if (!uploadFile) return toast({ variant: 'destructive', title: 'לא נבחר קובץ' });
    setIsUploading(true);
    const portalOrigin = (localStorage.getItem('loginEntryPoint') as 'uh' | 'standard') || 'standard';
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = event.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);
            const requiredCols = ['firstName', 'lastName', 'phone', 'email'];
            if (!json[0] || requiredCols.some(col => !Object.keys(json[0]).includes(col))) {
                throw new Error(`עמודות חסרות. ודא שהקובץ כולל: ${requiredCols.join(', ')}`);
            }
            const viewersToAdd: NewViewerData[] = json.map(row => ({
                clientId: clientId, 
                firstName: String(row.firstName || ''), 
                lastName: String(row.lastName || ''), 
                nickname: String(row.nickname || `${row.firstName} ${row.lastName}`), 
                phone: String(row.phone || ''), 
                email: String(row.email || ''), 
                expiresAt: null, 
                portalOrigin
            })).filter(v => v.email && v.firstName && v.lastName && v.phone);
            if (viewersToAdd.length === 0) throw new Error("לא נמצאו צופים תקינים בקובץ.");
            const result = await bulkAddViewers(viewersToAdd);
            toast({ title: 'העלאה הושלמה', description: `${result.successCount} נוספו, ${result.failureCount} נכשלו.` });
            setUploadDialogOpen(false); setUploadFile(null); await fetchPageData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בעיבוד הקובץ', description: (error as Error).message });
        } finally {
            setIsUploading(false);
        }
    };
    reader.readAsBinaryString(uploadFile);
  };
  
  const openPermissionsDialog = (viewer?: Viewer) => {
    let viewersToEdit: Viewer[] = [];
    
    if (viewer) {
      // Single viewer mode from dropdown
      viewersToEdit = [viewer];
      setSelectedViewerIds([viewer.id]);
    } else {
      // Bulk edit mode
      if (selectedViewerIds.length === 0) return;
      viewersToEdit = viewers.filter(v => selectedViewerIds.includes(v.id));
    }
    
    if (viewersToEdit.length > 0) {
      // Initialize with the permissions of the first selected viewer
      setPermissionState(viewersToEdit[0].permissions || {});
    }
    setPermissionsDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
        await updateViewersPermissions(selectedViewerIds, permissionState);
        toast({ title: 'ההרשאות עודכנו', description: `הרשאות הצפייה עודכנו עבור ${selectedViewerIds.length} צופים.` });
        setPermissionsDialogOpen(false);
        setSelectedViewerIds([]);
        await fetchPageData();
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה בעדכון הרשאות", description: (error as Error).message });
    } finally {
        setIsSavingPermissions(false);
    }
  };

  const handlePermissionChange = (streamName: string, type: 'canWatchLive' | 'canWatchDVR' | 'canWatchMCR', checked: boolean) => {
    setPermissionState(prev => {
      const newPermissions = { ...prev };
      if (!newPermissions[streamName]) {
        newPermissions[streamName] = { canWatchLive: false, canWatchDVR: false, canWatchMCR: false };
      }
      newPermissions[streamName][type] = checked;
      return newPermissions;
    });
  };

  const filteredViewers = useMemo(() => {
    return viewers.filter(viewer => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            `${viewer.firstName} ${viewer.lastName}`.toLowerCase().includes(query) ||
            viewer.nickname.toLowerCase().includes(query) ||
            viewer.email.toLowerCase().includes(query) ||
            viewer.phone.includes(query)
        );
    });
  }, [viewers, searchQuery]);
  
  const isAllInFilteredSelected = filteredViewers.length > 0 && filteredViewers.every(v => selectedViewerIds.includes(v.id));

  const handleSelectAllFiltered = (checked: boolean) => {
      if (checked) {
          setSelectedViewerIds(prev => {
              const idsToAdd = filteredViewers.map(v => v.id);
              return [...new Set([...prev, ...idsToAdd])];
          });
      } else {
          setSelectedViewerIds(prev => {
              const idsToRemove = new Set(filteredViewers.map(v => v.id));
              return prev.filter(id => !idsToRemove.has(id));
          });
      }
  };

  const getPermissionCount = (viewer: Viewer): string => {
      const perms = viewer.permissions || {};
      const liveCount = Object.values(perms).filter(p => p.canWatchLive).length;
      const dvrCount = Object.values(perms).filter(p => p.canWatchDVR).length;
      const mcrCount = Object.values(perms).filter(p => p.canWatchMCR).length;
      return `L:${liveCount}, D:${dvrCount}, M:${mcrCount}`;
  }


  if (isLoading) {
      return (
          <div className="p-8">
              <Skeleton className="w-full h-96" />
          </div>
      );
  }

  return (
    <div className="space-y-8 text-right p-4 sm:p-6 lg:p-8">
       {/* --- DIALOGS --- */}
        <AlertDialog open={permissionDeniedDialogOpen} onOpenChange={setPermissionDeniedDialogOpen}>
            <AlertDialogContent className="text-right">
                <AlertDialogHeader>
                    <div className="flex justify-center mb-4">
                        <Logo className="w-32 h-16" />
                    </div>
                    <AlertDialogTitle className="text-center">אין לך הרשאה</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                    יצירת צופים איננה מאפשרת בהגדרות הלקוח. לבירורים, פנה למנהל המערכת.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => router.push(`/client/${clientId}/dashboard`)}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזור לדף הבית
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       <Dialog open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setDialogOpen(isOpen); }}>
          <DialogContent className="sm:max-w-md text-right">
               <DialogHeader><DialogTitle>{dialogMode === 'create' ? 'הוספת צופה חדש' : 'עריכת פרטי צופה'}</DialogTitle></DialogHeader>
               <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label htmlFor="firstName">שם פרטי (חובה)</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="lastName">שם משפחה (חובה)</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1"><Label htmlFor="nickname">כינוי (רשות)</Label><Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label htmlFor="phone">טלפון (חובה)</Label><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr"/></div>
                    <div className="space-y-1"><Label htmlFor="email">אימייל (חובה)</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={dialogMode === 'edit'} dir="ltr"/></div>
                  </div>
                   <Separator className="my-4"/>
                  <div className="space-y-3">
                    <Label className="font-semibold">תוקף גישה</Label>
                    <RadioGroup defaultValue="24h" value={expiryType} onValueChange={(v: '24h' | 'custom' | 'none') => setExpiryType(v)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2 space-x-reverse p-2 border rounded-md"><RadioGroupItem value="24h" id="r1" /><Label htmlFor="r1">24 שעות</Label></div>
                        <div className="flex items-center space-x-2 space-x-reverse p-2 border rounded-md"><RadioGroupItem value="none" id="r3" /><Label htmlFor="r3">ללא הגבלת תוקף</Label></div>
                        <div className="flex items-center space-x-2 space-x-reverse p-2 border rounded-md sm:col-span-2"><RadioGroupItem value="custom" id="r2" /><Label htmlFor="r2">תאריך מותאם אישית</Label></div>
                    </RadioGroup>
                    {expiryType === 'custom' && (
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-full justify-end text-right font-normal",
                                !customExpiryDate && "text-muted-foreground"
                                )}
                            >
                                {customExpiryDate ? format(customExpiryDate, "dd/MM/yyyy") : <span>בחר תאריך</span>}
                                <CalendarIcon className="mr-2 h-4 w-4" />
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={customExpiryDate}
                                onSelect={setCustomExpiryDate}
                                disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                initialFocus
                            />
                             <div className="p-3 border-t border-border">
                                <Label htmlFor="expiry-time">שעת תפוגה</Label>
                                <Input
                                    id="expiry-time"
                                    type="time"
                                    value={customExpiryTime}
                                    onChange={(e) => setCustomExpiryTime(e.target.value)}
                                />
                            </div>
                            </PopoverContent>
                        </Popover>
                    )}
                  </div>
               </div>
               <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleDialogSubmit} disabled={isProcessing}>{isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}{dialogMode === 'create' ? 'הוסף צופה' : 'שמור שינויים'}</Button></DialogFooter>
          </DialogContent>
       </Dialog>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-lg text-right">
               <DialogHeader><DialogTitle>העלאת רשימת צופים מקובץ</DialogTitle></DialogHeader>
               <div className="py-4 space-y-4">
                  <div className="text-sm p-4 bg-muted/50 rounded-md border"><h4 className="font-bold mb-2">פורמט הקובץ הנדרש:</h4><p>השורה הראשונה בקובץ חייבת להיות שורת כותרת.</p><ul className="list-disc list-inside mt-2 font-mono text-xs"><li>firstName (שם פרטי)</li><li>lastName (שם משפחה)</li><li>phone (טלפון)</li><li>email (אימייל)</li><li>nickname (כינוי - אופציונלי)</li></ul><p className="mt-2 text-xs">צופים המועלים בקובץ מקבלים תוקף ברירת מחדל של 24 שעות.</p></div>
                  <div className="grid w-full max-w-sm items-center gap-1.5"><Label htmlFor="upload-file">בחר קובץ</Label><Input id="upload-file" type="file" accept=".xlsx, .xls, .csv" onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)} /></div>
               </div>
               <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleFileUpload} disabled={isUploading || !uploadFile}>{isUploading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}העלה וצור צופים</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
            <DialogContent className="sm:max-w-lg text-left">
                <DialogHeader><DialogTitle>ניהול הרשאות צפייה</DialogTitle><DialogDescription>בחר לאילו שידורים תהיה גישה ל-{selectedViewerIds.length} הצופים שנבחרו. שינויים כאן ידרסו את ההרשאות הקיימות שלהם.</DialogDescription></DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-72 w-full rounded-md border p-4">
                        <div className="space-y-4">
                            {availableStreams.map((stream) => (
                                <div key={stream.name}>
                                    <h4 className="font-semibold text-right mb-2">{stream.name}</h4>
                                    <div className="space-y-2 pr-4">
                                        <div className="flex items-center justify-between"><Checkbox
                                                id={`live-${stream.name}`}
                                                checked={permissionState[stream.name]?.canWatchLive || false}
                                                onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchLive', !!checked)}
                                            /><Label htmlFor={`live-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה בשידור חי <Tv className="h-4 w-4 text-green-500" /></Label></div>
                                        <div className="flex items-center justify-between"><Checkbox
                                                id={`dvr-${stream.name}`}
                                                checked={permissionState[stream.name]?.canWatchDVR || false}
                                                onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchDVR', !!checked)}
                                            /><Label htmlFor={`dvr-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה ב-DVR <Video className="h-4 w-4 text-blue-500" /></Label></div>
                                        <div className="flex items-center justify-between"><Checkbox
                                                id={`mcr-${stream.name}`}
                                                checked={permissionState[stream.name]?.canWatchMCR || false}
                                                onCheckedChange={(checked) => handlePermissionChange(stream.name, 'canWatchMCR', !!checked)}
                                            /><Label htmlFor={`mcr-${stream.name}`} className="flex-1 mr-4 flex items-center justify-end gap-2">צפייה ב-MCR <SlidersHorizontal className="h-4 w-4 text-purple-500" /></Label></div>
                                    </div>
                                    {availableStreams.indexOf(stream) < availableStreams.length - 1 && <Separator className="mt-4" />}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                    <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                        {isSavingPermissions && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        שמור שינויים
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-2">
            <Button data-tour="viewers-upload-button" variant="outline" onClick={() => setUploadDialogOpen(true)}><Upload className="ml-2 h-4 w-4"/>העלאת רשימה</Button>
            <Button data-tour="viewers-add-button" onClick={() => openDialog('create')}><PlusCircle className="ml-2 h-4 w-4" />הוסף צופה</Button>
        </div>
        <div className="space-y-2 text-left">
          <h1 className="text-3xl font-bold tracking-tight flex items-center justify-start gap-2">
            <Users className="h-7 w-7" />
            ניהול צופים
          </h1>
          <p className="text-muted-foreground">הוספה, עריכה ומחיקה של משתמשי קצה (צופים).</p>
        </div>
      </div>

       <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                 <div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="חיפוש לפי שם, אימייל או טלפון..." className="pr-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></div>
                {selectedViewerIds.length > 0 ? (
                    <div className="flex gap-2" data-tour="viewers-permissions-button">
                        <Button onClick={() => openPermissionsDialog()}><ShieldCheck className="ml-2 h-4 w-4"/>ניהול הרשאות ({selectedViewerIds.length})</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isProcessing}>
                                    <Trash2 className="ml-2 h-4 w-4" />
                                    מחק ({selectedViewerIds.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="text-right">
                                <AlertDialogHeader>
                                <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    פעולה זו תמחק לצמיתות {selectedViewerIds.length} צופים. לא ניתן לבטל פעולה זו.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">כן, מחק צופים</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ) : (
                    <CardTitle>כל הצופים</CardTitle>
                )}
            </div>
           
        </CardHeader>
        <CardContent>
          <Table className="responsive-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"><Checkbox 
                    checked={isAllInFilteredSelected}
                    onCheckedChange={(checked) => handleSelectAllFiltered(!!checked)}
                    aria-label="בחר את כל הצופים המוצגים"
                /></TableHead>
                <TableHead className="w-[50px] text-right">פעולות</TableHead>
                <TableHead className="text-right">כינוי</TableHead>
                <TableHead className="text-right">שם מלא</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">קוד אימות</TableHead>
                <TableHead className="text-right">הרשאות</TableHead>
                <TableHead className="text-right">תוקף</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))
              ) : filteredViewers.length > 0 ? (
                filteredViewers.map((viewer) => (
                  <TableRow key={viewer.id} data-state={selectedViewerIds.includes(viewer.id) && "selected"}>
                    <TableCell data-label="בחירה"><Checkbox 
                        checked={selectedViewerIds.includes(viewer.id)}
                        onCheckedChange={(checked) => {
                            setSelectedViewerIds(prev => checked ? [...prev, viewer.id] : prev.filter(id => id !== viewer.id));
                        }}
                        aria-label="Select row"
                    /></TableCell>
                    <TableCell data-label="פעולות">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningViewer === viewer.id}>{actioningViewer === viewer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}</Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-right">
                                <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openDialog('edit', viewer)}><Edit className="ml-2 h-4 w-4" /><span>ערוך פרטים</span></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPermissionsDialog(viewer)}><ShieldCheck className="ml-2 h-4 w-4"/><span>הרשאות</span></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleResendOtp(viewer)}><Send className="ml-2 h-4 w-4" /><span>שלח קוד חדש</span></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog><AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="ml-2 h-4 w-4" /><span>מחק צופה</span></DropdownMenuItem></AlertDialogTrigger>
                                    <AlertDialogContent className="text-right"><AlertDialogHeader><AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle><AlertDialogDescription>פעולה זו תמחק את הצופה <strong>{viewer.nickname}</strong> לצמיתות.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteViewer(viewer)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">כן, מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    <TableCell data-label="כינוי" className="font-medium">{viewer.nickname}</TableCell>
                    <TableCell data-label="שם מלא">{viewer.firstName} {viewer.lastName}</TableCell>
                    <TableCell data-label="אימייל">{viewer.email}</TableCell>
                    <TableCell data-label="קוד אימות" className="font-mono text-xs">{viewer.otp}</TableCell>
                    <TableCell data-label="הרשאות" className="font-mono text-center text-xs">{getPermissionCount(viewer)}</TableCell>
                    <TableCell data-label="תוקף">
                        {isClient && viewer.expiresAt ? (
                            <Badge variant={isPast(parseISO(viewer.expiresAt)) ? 'destructive' : 'secondary'}>
                                {format(parseISO(viewer.expiresAt), 'dd/MM/yy HH:mm')}
                            </Badge>
                        ) : 'ללא הגבלה'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">{searchQuery ? `לא נמצאו צופים התואמים לחיפוש "${searchQuery}".` : 'עדיין לא הוספת צופים.'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


export default function ViewersPage() {
    return (
        <Suspense fallback={<div className="p-8"><Skeleton className="w-full h-96" /></div>}>
            <ViewersPageComponent />
        </Suspense>
    )
}
