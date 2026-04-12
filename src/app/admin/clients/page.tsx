
"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Edit, Send, Search, ShieldCheck, Video, Save, ArrowUpDown, FileText, UserCog, Link2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { getClients, addClient, deleteClient, updateClientDetails, resendVerificationEmail, deleteMultipleClients, updateClientsPermissions, type Client, type ClientPermissions } from '@/services/clients';
import type { AuthContext } from '@/services/security';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sendInvitationEmail } from '@/services/email';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { getInstances, type AppInstance } from '@/services/instances';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DialogMode = 'create' | 'edit';
type EditingClient = Client | null;

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

const defaultPermissions: ClientPermissions = {
  canCreateStreams: false,
  canDeleteStreams: false,
  canCreateViewers: true,
  canUseWebRTC: false,
  canCreateSecureLinks: false,
  hasAllStreamsAccess: false,
  maxPushDestinations: 1,
  maxStreams: 1,
  maxConcurrentBroadcasts: 1,
  allowedStreams: {},
};

function ClientPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [streams, setStreams] = useState<FlussonicStream[]>([]);
  const [instances, setInstances] = useState<AppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreatingAndRedirecting, setIsCreatingAndRedirecting] = useState(false);
  const [actioningClient, setActioningClient] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [isClientSide, setIsClientSide] = useState(false);

  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingClient, setEditingClient] = useState<EditingClient>(null);

  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionState, setPermissionState] = useState<ClientPermissions>(defaultPermissions);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [instanceId, setInstanceId] = useState('default');

  const editParamHandled = useRef(false);

  const resetForm = useCallback(() => {
    setFirstName('');
    setLastName('');
    setNickname('');
    setPhone('');
    setEmail('');
    setIdNumber('');
    setInstanceId('default');
    setEditingClient(null);
  }, []);

  const openDialog = useCallback((mode: DialogMode, client: EditingClient = null) => {
    setDialogMode(mode);

    if (mode === 'edit' && client) {
      setEditingClient(client);
      setFirstName(client.firstName);
      setLastName(client.lastName);
      setNickname(client.nickname);
      setPhone(client.phone);
      setEmail(client.email);
      setIdNumber(client.idNumber || '');
      setInstanceId(client.instanceId || 'default');
    } else {
      resetForm();
    }

    setDialogOpen(true);
  }, [resetForm]);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);

    const userId = typeof window !== 'undefined' ? sessionStorage.getItem('userId') : null;
    const sessionId = typeof window !== 'undefined' ? sessionStorage.getItem('activeSessionId') : null;

    if (!userId || !sessionId) {
        toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'אנא התחבר מחדש.' });
        router.push('/login');
        return;
    }

    const auth: AuthContext = { userId, sessionId };

    try {
      const [fetchedClients, fetchedStreams, fetchedInstances] = await Promise.all([
        getClients(auth),
        getStreams(),
        getInstances()
      ]);

      setClients(fetchedClients);
      setStreams(fetchedStreams);
      setInstances(fetchedInstances);

      const clientIdToEdit = searchParams.get('edit');
      if (clientIdToEdit && !editParamHandled.current) {
        const clientToEdit = fetchedClients.find(c => c.id === decodeURIComponent(clientIdToEdit));
        if (clientToEdit) {
          editParamHandled.current = true;
          openDialog('edit', clientToEdit);
          router.replace('/admin/clients', { scroll: false });
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים', description: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, router, openDialog, toast]);

  useEffect(() => {
    setIsClientSide(true);
    setUserRole(sessionStorage.getItem('userRole'));
    setCurrentAdminId(sessionStorage.getItem('userId'));
    fetchClients();
  }, [fetchClients]);

  const handleSendInvitation = async () => {
    if (!invitationEmail) {
      toast({ variant: 'destructive', title: 'כתובת מייל חסרה' });
      return;
    }

    setIsProcessing(true);
    const result = await sendInvitationEmail(invitationEmail, "משתמש יקר");

    if (result.success) {
      toast({ title: 'הזמנה נשלחה', description: `שאלון הרשמה נשלח אל ${invitationEmail}` });
      setDialogOpen(false);
      resetForm();
    } else {
      toast({ variant: "destructive", title: "שגיאה בשליחת מייל", description: result.error });
    }

    setIsProcessing(false);
  };

  const handleManualSubmit = async () => {
    if (!firstName || !lastName || !nickname || !phone || !email) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא מלא את כל הפרטים." });
      return;
    }

    setIsProcessing(true);

    try {
      if (dialogMode === 'create') {
        if (!currentAdminId) throw new Error("לא ניתן לזהות את המנהל המחובר.");

        setIsCreatingAndRedirecting(true);
        const result = await addClient({ firstName, lastName, nickname, phone, email, idNumber }, currentAdminId, instanceId);
        toast({ title: "הצלחה", description: `הלקוח "${nickname}" נוצר.` });
        router.push(`/admin/clients/${encodeURIComponent(result.newClient.id)}/permissions`);
      } else if (dialogMode === 'edit' && editingClient) {
        await updateClientDetails(editingClient.id, { firstName, lastName, nickname, phone, idNumber });
        toast({ title: "הצלחה", description: "פרטי הלקוח עודכנו." });
        setDialogOpen(false);
        resetForm();
        fetchClients();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
      setIsCreatingAndRedirecting(false);
      if (dialogMode === 'create') setDialogOpen(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    setActioningClient(client.id);
    
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return;
    const auth: AuthContext = { userId, sessionId };

    try {
      await deleteClient(auth, client.id);
      toast({ variant: "destructive", title: "לקוח נמחק", description: `${client.nickname} הוסר מהמערכת.` });
      fetchClients();
    } catch (error) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הלקוח." });
    } finally {
      setActioningClient(null);
    }
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return;
    const auth: AuthContext = { userId, sessionId };

    try {
      await deleteMultipleClients(auth, selectedClientIds);
      toast({
        title: 'הלקוחות נמחקו',
        variant: 'destructive',
        description: `${selectedClientIds.length} לקוחות נמחקו.`,
      });
      setSelectedClientIds([]);
      fetchClients();
    } catch (error) {
      toast({ variant: 'destructive', title: 'שגיאה במחיקה קבוצתית' });
    } finally {
      setIsProcessing(false);
    }
  };

  const openBulkPermissionsDialog = () => {
    if (selectedClientIds.length === 0) return;
    const firstClient = clients.find(c => c.id === selectedClientIds[0]);
    setPermissionState(firstClient?.permissions || defaultPermissions);
    setPermissionsDialogOpen(true);
  };

  const handleSaveBulkPermissions = async () => {
    setIsSavingPermissions(true);
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return;
    const auth: AuthContext = { userId, sessionId };

    try {
      const result = await updateClientsPermissions(auth, selectedClientIds, permissionState);
      if (result.success) {
        toast({ title: 'ההרשאות עודכנו', description: `עודכנו הרשאות עבור ${selectedClientIds.length} לקוחות.` });
        setPermissionsDialogOpen(false);
        setSelectedClientIds([]);
        fetchClients();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'שגיאה בעדכון הרשאות', description: (error as Error).message });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleStreamAccessChange = (streamName: string, value: 'off' | 'custom' | 'full') => {
    setPermissionState(prev => {
      const newAllowedStreams = { ...prev.allowedStreams };

      if (value === 'off') {
        delete newAllowedStreams[streamName];
      } else if (value === 'custom') {
        newAllowedStreams[streamName] = {
          ...DEFAULT_STREAM_PERMISSIONS,
          ...(newAllowedStreams[streamName] || {})
        };
      } else if (value === 'full') {
        newAllowedStreams[streamName] = { ...ALL_STREAM_PERMISSIONS };
      }

      return { ...prev, allowedStreams: newAllowedStreams };
    });

    if (value === 'custom') {
      setOpenAccordionItems(prev => [...prev, streamName]);
    } else {
      setOpenAccordionItems(prev => prev.filter(item => item !== streamName));
    }
  };

  const handleSpecificPermissionToggle = (
    streamName: string,
    key: keyof ClientPermissions['allowedStreams'][string],
    checked: boolean
  ) => {
    setPermissionState(prev => ({
      ...prev,
      allowedStreams: {
        ...prev.allowedStreams,
        [streamName]: {
          ...(prev.allowedStreams[streamName] || DEFAULT_STREAM_PERMISSIONS),
          [key]: checked
        }
      }
    }));
  };

  const handleResendOtp = async (client: Client) => {
    setActioningClient(client.id);
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return;
    const auth: AuthContext = { userId, sessionId };

    try {
      await resendVerificationEmail(auth, client.id);
      toast({ title: "הצלחה", description: `קוד אימות חדש נשלח ל-${client.email}.` });
      fetchClients();
    } catch (error) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח את המייל." });
    } finally {
      setActioningClient(null);
    }
  };

  const canDeleteClients = userRole === 'super-admin' || userRole === 'admin';

  const filteredClients = useMemo(() => clients.filter(client => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();

    return (
      fullName.includes(query) ||
      client.nickname.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.phone.includes(query)
    );
  }), [clients, searchQuery]);

  const isAllInFilteredSelected = useMemo(
    () => filteredClients.length > 0 && filteredClients.every(c => selectedClientIds.includes(c.id)),
    [filteredClients, selectedClientIds]
  );

  const [invitationEmail, setInvitationEmail] = useState('');

  return (
    <div className="relative">
      {isCreatingAndRedirecting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-white p-8 bg-black/70 rounded-lg">
            <Loader2 className="h-12 w-12 animate-spin" />
            <p className="text-lg font-semibold">הלקוח נוצר, מיד תועבר לעמוד ההרשאות...</p>
          </div>
        </div>
      )}

      <div className="space-y-8 text-right">
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-3xl text-right">
            <DialogHeader>
              <DialogTitle>ניהול הרשאות קבוצתי</DialogTitle>
              <DialogDescription>הגדר הרשאות עבור {selectedClientIds.length} לקוחות שנבחרו.</DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-end gap-2">
                    הרשאות גלובליות <ShieldCheck className="h-5 w-5" />
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <Switch
                        checked={permissionState.canCreateStreams}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, canCreateStreams: v }))}
                        dir="ltr"
                      />
                      <Label>יצירת שידורים</Label>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <Switch
                        checked={permissionState.canDeleteStreams}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, canDeleteStreams: v }))}
                        dir="ltr"
                      />
                      <Label>מחיקת שידורים</Label>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <Switch
                        checked={permissionState.canCreateViewers}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, canCreateViewers: v }))}
                        dir="ltr"
                      />
                      <Label>יצירת צופים</Label>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <Switch
                        checked={permissionState.canUseWebRTC}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, canUseWebRTC: v }))}
                        dir="ltr"
                      />
                      <Label>שידור מהדפדפן (WebRTC)</Label>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-md">
                      <Switch
                        checked={permissionState.canCreateSecureLinks}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, canCreateSecureLinks: v }))}
                        dir="ltr"
                      />
                      <Label>יצירת קישורים מאובטחים</Label>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-md sm:col-span-2">
                      <Switch
                        checked={permissionState.hasAllStreamsAccess}
                        onCheckedChange={(v) => setPermissionState(s => ({ ...s, hasAllStreamsAccess: v }))}
                        dir="ltr"
                      />
                      <Label className="font-bold text-primary">גישה חופשית לכל השידורים</Label>
                    </div>
                  </div>
                </div>

                {!permissionState.hasAllStreamsAccess && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2 flex items-center justify-end gap-2">
                      גישה לשידורים ספציפיים <Video className="h-5 w-5" />
                    </h3>

                    <Accordion
                      type="multiple"
                      value={openAccordionItems}
                      onValueChange={setOpenAccordionItems}
                      className="w-full"
                    >
                      {streams.map(stream => {
                        const current = permissionState.allowedStreams[stream.name];
                        let toggleValue: 'off' | 'custom' | 'full' = 'off';

                        if (current) {
                          const isFull = Object.keys(ALL_STREAM_PERMISSIONS).every(
                            k => (current as any)[k] === true
                          );
                          toggleValue = isFull ? 'full' : 'custom';
                        }

                        return (
                          <AccordionItem value={stream.name} key={stream.name}>
                            <div className="flex items-center justify-between p-2 border-b gap-4">
                              <ToggleGroup
                                type="single"
                                value={toggleValue}
                                onValueChange={(v: any) => v && handleStreamAccessChange(stream.name, v)}
                                className="dir-ltr"
                              >
                                <ToggleGroupItem value="full" className="data-[state=on]:bg-green-600 data-[state=on]:text-white">
                                  מלא
                                </ToggleGroupItem>
                                <ToggleGroupItem value="custom" className="data-[state=on]:bg-orange-500 data-[state=on]:text-white">
                                  מותאם
                                </ToggleGroupItem>
                                <ToggleGroupItem value="off">כבוי</ToggleGroupItem>
                              </ToggleGroup>

                              <AccordionTrigger
                                className="flex-1 text-right py-0 pr-4"
                                disabled={toggleValue !== 'custom'}
                              >
                                {stream.name}
                              </AccordionTrigger>
                            </div>

                            <AccordionContent className="bg-muted/30 p-4 space-y-3">
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="flex items-center justify-between">
                                  <Switch
                                    checked={current?.canManageDVR ?? false}
                                    onCheckedChange={(v) => handleSpecificPermissionToggle(stream.name, 'canManageDVR', v)}
                                    dir="ltr"
                                  />
                                  <Label>ניהול DVR</Label>
                                </div>

                                <div className="flex items-center justify-between">
                                  <Switch
                                    checked={current?.canPush ?? false}
                                    onCheckedChange={(v) => handleSpecificPermissionToggle(stream.name, 'canPush', v)}
                                    dir="ltr"
                                  />
                                  <Label>הזרמה ליעדים (Push)</Label>
                                </div>

                                <div className="flex items-center justify-between">
                                  <Switch
                                    checked={current?.canViewStats ?? false}
                                    onCheckedChange={(v) => handleSpecificPermissionToggle(stream.name, 'canViewStats', v)}
                                    dir="ltr"
                                  />
                                  <Label>צפייה בסטטיסטיקות</Label>
                                </div>
                                <div className="flex items-center justify-between">
                                  <Switch
                                    checked={current?.canCreateSecureLink ?? false}
                                    onCheckedChange={(v) => handleSpecificPermissionToggle(stream.name, 'canCreateSecureLink', v)}
                                    dir="ltr"
                                  />
                                  <Label className="flex items-center gap-1">יצירת קישורים <Link2 className="h-3 w-3" /></Label>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="border-t pt-4">
              <DialogClose asChild>
                <Button variant="outline">ביטול</Button>
              </DialogClose>

              <Button onClick={handleSaveBulkPermissions} disabled={isSavingPermissions}>
                {isSavingPermissions && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Save className="ml-2 h-4 w-4" />
                עדכן את כל הלקוחות
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between">
          <Dialog
            open={dialogOpen}
            onOpenChange={(isOpen) => {
              if (!isOpen) resetForm();
              setDialogOpen(isOpen);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => openDialog('create')}>
                <PlusCircle className="ml-2 h-4 w-4" />
                הוסף לקוח
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg text-right">
              <DialogHeader>
                <DialogTitle>
                  {dialogMode === 'create' ? 'הוספת לקוח חדש' : 'עריכת פרטי לקוח'}
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">יצירה ידנית</TabsTrigger>
                  <TabsTrigger value="invite">שליחת הזמנה</TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="firstName"
                        className="col-span-3"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                      <Label htmlFor="firstName" className="text-right">שם פרטי</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="lastName"
                        className="col-span-3"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                      <Label htmlFor="lastName" className="text-right">שם משפחה</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="nickname"
                        className="col-span-3"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                      />
                      <Label htmlFor="nickname" className="text-right">כינוי</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="phone"
                        className="col-span-3"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <Label htmlFor="phone" className="text-right">טלפון</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="email"
                        className="col-span-3"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={dialogMode === 'edit'}
                      />
                      <Label htmlFor="email" className="text-right">אימייל</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Input
                        id="idNumber"
                        className="col-span-3"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                      />
                      <Label htmlFor="idNumber" className="text-right">מס' עוסק</Label>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Select dir="rtl" value={instanceId} onValueChange={setInstanceId}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="בחר שרת..." />
                        </SelectTrigger>
                        <SelectContent>
                          {instances.map(inst => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Label className="text-right">שיוך לשרת</Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">ביטול</Button>
                    </DialogClose>

                    <Button onClick={handleManualSubmit} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      {dialogMode === 'create' ? 'צור והמשך להרשאות' : 'שמור שינויים'}
                    </Button>
                  </DialogFooter>
                </TabsContent>

                <TabsContent value="invite">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">כתובת אימייל</Label>
                      <Input
                        id="invite-email"
                        dir="ltr"
                        value={invitationEmail}
                        onChange={(e) => setInvitationEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">ביטול</Button>
                    </DialogClose>

                    <Button onClick={handleSendInvitation} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      שלח הזמנה
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          <div className="space-y-2 text-left">
            <h1 className="text-3xl font-bold tracking-tight">ניהול לקוחות</h1>
            <p className="text-muted-foreground">הוספה, עריכה או הסרה של לקוחות.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                {selectedClientIds.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button onClick={openBulkPermissionsDialog} className="bg-orange-600 hover:bg-orange-700">
                      <ShieldCheck className="ml-2 h-4 w-4" />
                      ניהול הרשאות ({selectedClientIds.length})
                    </Button>

                    {canDeleteClients && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="ml-2 h-4 w-4" />
                            מחק ({selectedClientIds.length})
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent className="text-right">
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחיקה קבוצתית</AlertDialogTitle>
                            <AlertDialogDescription>
                              פעולה זו תמחק {selectedClientIds.length} לקוחות. האם להמשיך?
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                              מחק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ) : (
                  <CardTitle>כל הלקוחות</CardTitle>
                )}
              </div>

              <div className="relative w-full sm:max-w-xs pt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Table className="responsive-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllInFilteredSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedClientIds(filteredClients.map(c => c.id));
                        } else {
                          setSelectedClientIds([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[50px] text-right">פעולות</TableHead>
                  <TableHead className="text-right">כינוי</TableHead>
                  <TableHead className="text-right">אימייל</TableHead>
                  <TableHead className="text-right">קוד אימות</TableHead>
                  <TableHead className="text-right">שרת/מופע</TableHead>
                  <TableHead className="text-right">תוקף</TableHead>
                  <TableHead className="text-right">שידורים</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} data-state={selectedClientIds.includes(client.id) && "selected"}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClientIds.includes(client.id)}
                          onCheckedChange={(checked) => {
                            setSelectedClientIds(prev =>
                              checked ? [...prev, client.id] : prev.filter(id => id !== client.id)
                            );
                          }}
                        />
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={actioningClient === client.id}
                            >
                              {actioningClient === client.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="text-right">
                            <DropdownMenuLabel>פעולות</DropdownMenuLabel>

                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/admin/clients/${encodeURIComponent(client.id)}/permissions`)
                              }
                            >
                              <ShieldCheck className="ml-2 h-4 w-4" />
                              <span>הרשאות</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/admin/clients/${encodeURIComponent(client.id)}/uploads`)
                              }
                            >
                              <FileText className="ml-2 h-4 w-4" />
                              <span>מסמכים</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/admin/clients/${encodeURIComponent(client.id)}/billing`)
                              }
                            >
                              <FileText className="ml-2 h-4 w-4" />
                              <span>חיוב</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => openDialog('edit', client)}>
                              <Edit className="ml-2 h-4 w-4" />
                              <span>ערוך</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => handleResendOtp(client)}>
                              <Send className="ml-2 h-4 w-4" />
                              <span>שלח קוד</span>
                            </DropdownMenuItem>

                            {canDeleteClients && (
                              <>
                                <DropdownMenuSeparator />

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-destructive"
                                    >
                                      <span>מחק</span>
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>

                                  <AlertDialogContent className="text-right">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        מחיקת <strong>{client.nickname}</strong> לצמיתות.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>

                                    <AlertDialogFooter>
                                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteClient(client)}
                                        className="bg-destructive"
                                      >
                                        כן, מחק
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/clients/${encodeURIComponent(client.id)}/uploads`}
                          className="hover:underline"
                        >
                          {client.nickname}
                        </Link>
                      </TableCell>

                      <TableCell>{client.email}</TableCell>

                      <TableCell className="font-mono text-xs">
                        {client.otp || 'N/A'}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {instances.find(i => i.id === client.instanceId)?.name || client.instanceId || 'default'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {isClientSide && client.activeUntil
                          ? format(parseISO(client.activeUntil), 'dd/MM/yy')
                          : 'ללא הגבלה'}
                      </TableCell>

                      <TableCell className="text-center">
                        {client.permissions?.hasAllStreamsAccess ? '∞' : (client.streams || 0)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-transparent",
                            client.status === 'פעיל'
                              ? 'bg-green-600 text-white'
                              : client.status === 'לא פעיל'
                                ? 'bg-red-600 text-white'
                                : 'bg-yellow-500 text-white'
                          )}
                        >
                          {client.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      לא נמצאו לקוחות.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminClientsPage() {
  return (
    <Suspense fallback={<div>טוען...</div>}>
      <ClientPageContent />
    </Suspense>
  );
}
