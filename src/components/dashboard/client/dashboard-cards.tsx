
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tv, Users, Link2, Settings, User, Grid, BadgeCheck, CalendarClock, ListVideo, Wifi, WifiOff, UserX, ExternalLink, Server, Database, MailQuestion, Edit, RefreshCw, Loader2, Lock, CreditCard, Upload, CheckCircle, FileText } from 'lucide-react';
import { type Client, type ClientLink } from '@/services/clients';
import { type FlussonicStream } from '@/services/flussonic';
import { type Viewer } from '@/services/viewers';
import { type PermissionRequest, requestPermissionRenewalForClient } from '@/services/requests';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadReceiptAction } from '@/services/storage';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type DashboardCardProps = {
  title: string;
  icon: React.ElementType;
  permission?: boolean;
  children?: React.ReactNode;
  manageHref?: string;
  headerContent?: React.ReactNode;
  disabled?: boolean;
  tourId?: string;
};

const DashboardCard = ({ title, icon: Icon, permission = true, manageHref, headerContent, children, disabled = false, tourId }: DashboardCardProps) => {
  if (!permission) return null;

  const cardContent = (
      <Card data-tour={tourId} className={cn("flex flex-col h-full w-full hover:border-primary transition-colors duration-200", disabled && "bg-muted/50 border-dashed hover:border-dashed pointer-events-none opacity-60")}>
          <CardHeader>
              <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    {headerContent}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                      <div className="text-right">
                          <CardTitle className={cn(disabled && "flex items-center gap-2")}>
                              {disabled && <Lock className="h-4 w-4" />}
                              {title}
                          </CardTitle>
                      </div>
                      <div className="p-3 bg-muted rounded-md">
                          <Icon className="h-6 w-6 text-primary" />
                      </div>
                  </div>
              </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-end text-left">
              {children}
          </CardContent>
      </Card>
  );

  if (manageHref && !disabled) {
    return <Link href={manageHref} className="flex h-full">{cardContent}</Link>;
  }

  return <div>{cardContent}</div>;
};

type DashboardStats = {
    client: Client;
    authorizedStreamsCount: number;
    onlineStreams: number;
    offlineStreams: number;
    viewersCount: number;
    inactiveViewers: number;
    pendingRequests: number;
    documentsCount: number;
    newDocumentsCount: number;
};

export function DashboardCards({ stats }: { stats: DashboardStats }) {
    const { client } = stats;
    const { toast } = useToast();
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'error'>('idle');
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [currentClient, setCurrentClient] = useState<Client>(client);
    
    const handleRenewalRequest = async () => {
      if (!currentClient) return;
      setIsSubmittingRequest(true);
      try {
        const result = await requestPermissionRenewalForClient(currentClient.id);
        if (result.success) {
            toast({ title: "בקשה נשלחה", description: "בקשתך לחידוש החשבון נשלחה למנהל. כעת תועבר לדף התשלום." });
            setRequestStatus('sent');
            setTimeout(() => {
                window.open('https://mrng.to/lAfc8WSZYy', '_blank');
            }, 1500);
        } else {
            toast({ variant: 'destructive', title: "שליחה נכשלה", description: result.error });
            setRequestStatus('error');
        }
      } catch(e) {
          toast({ variant: 'destructive', title: "שגיאה", description: "אירעה שגיאה בלתי צפויה." });
          setRequestStatus('error');
      } finally {
        setIsSubmittingRequest(false);
      }
    };
    
    const handleReceiptUpload = async () => {
        if (!receiptFile || !currentClient) {
            toast({ variant: 'destructive', title: 'לא נבחר קובץ', description: 'אנא בחר קובץ PDF להעלאה.' });
            return;
        }
        setIsUploadingReceipt(true);
        const formData = new FormData();
        formData.append('receiptFile', receiptFile);
        formData.append('clientId', currentClient.id);

        try {
            const result = await uploadReceiptAction(formData);

            if (result.success && result.updatedClient) {
                setCurrentClient(result.updatedClient);
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
                window.dispatchEvent(new Event('clientDataUpdated'));

                toast({ title: 'הקובץ הועלה בהצלחה', description: 'אישור התשלום נשלח למנהל לבדיקה.' });
            } else {
                throw new Error(result.error || "An unknown error occurred during upload.");
            }
        } catch(e) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (e as Error).message });
        } finally {
            setIsUploadingReceipt(false);
        }
    };

    const getStatusVariant = () => {
        if (!currentClient) return 'secondary';
        switch (currentClient.status) {
            case 'פעיל': return 'default';
            case 'לא פעיל': return 'destructive';
            case 'בהמתנה': return 'secondary';
            default: return 'secondary';
        }
    };

    const getStatusColorClass = () => {
        if (!currentClient) return '';
        switch (currentClient.status) {
            case 'פעיל': return 'bg-green-600 text-primary-foreground';
            case 'בהמתנה': return 'bg-yellow-500 text-secondary-foreground';
            case 'לא פעיל': return 'bg-red-600 text-destructive-foreground';
            default: return 'bg-muted-foreground';
        }
    };
    
    const isClientInactive = currentClient?.status !== 'פעיל' || (currentClient?.activeUntil && isPast(parseISO(currentClient.activeUntil)));

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             <DashboardCard
                title="מצב הפרופיל"
                icon={User}
                manageHref={`/client/${currentClient?.id}/profile`}
                tourId="dashboard-profile-card"
            >
              <div className="space-y-2 text-sm text-left">
                <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                    <span className="font-medium flex items-center gap-1.5">מצב חשבון<BadgeCheck className="h-4 w-4"/></span>
                    <Badge variant={getStatusVariant()} className={cn("border-transparent", getStatusColorClass())}>{currentClient?.status || 'לא ידוע'}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                    <span className="font-medium flex items-center gap-1.5">תוקף<CalendarClock className="h-4 w-4"/></span>
                    <span>{currentClient?.activeUntil ? format(parseISO(currentClient.activeUntil), 'dd/MM/yyyy') : 'ללא הגבלה'}</span>
                </div>
                 <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                    <span className="font-medium flex items-center gap-1.5">שידורים<ListVideo className="h-4 w-4"/></span>
                    <span className="font-mono">
                        {currentClient?.permissions?.hasAllStreamsAccess ? 'גישה מלאה' : `${stats.authorizedStreamsCount}`}
                    </span>
                </div>
              </div>
            </DashboardCard>
            <DashboardCard
                title="קונטרול MCR"
                icon={Grid}
                manageHref={`/client/${currentClient?.id}/mcr`}
                disabled={!!isClientInactive}
            >
                 <div className="space-y-2 text-sm text-left">
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">שידורים פעילים<Wifi className="h-4 w-4 text-green-400"/></span>
                        <span className="font-mono font-bold text-green-400">{stats.onlineStreams}</span>
                    </div>
                </div>
            </DashboardCard>
             <DashboardCard
                title="ניהול שידורים"
                icon={Tv}
                manageHref={`/client/${currentClient?.id}/streams`}
                disabled={!!isClientInactive}
            >
                <div className="space-y-2 text-sm text-left">
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium">סך הכל שידורים</span>
                        <span className="font-mono font-bold text-lg">{stats.authorizedStreamsCount}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">אונליין<Wifi className="h-4 w-4 text-green-400"/></span>
                        <span className="font-mono font-bold text-green-400">{stats.onlineStreams}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">אופליין<WifiOff className="h-4 w-4 text-red-400"/></span>
                        <span className="font-mono font-bold text-red-400">{stats.offlineStreams}</span>
                    </div>
                </div>
            </DashboardCard>
             <DashboardCard
                title="הצופים שלי"
                icon={Users}
                permission={!!currentClient?.permissions?.canCreateViewers}
                manageHref={`/client/${currentClient?.id}/viewers`}
                disabled={!!isClientInactive}
            >
                 <div className="space-y-2 text-sm text-left">
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium">סך הכל צופים</span>
                        <span className="font-mono font-bold text-lg">{stats.viewersCount}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">לא פעילים<UserX className="h-4 w-4 text-red-400"/></span>
                        <span className="font-mono font-bold text-red-400">{stats.inactiveViewers}</span>
                    </div>
                </div>
            </DashboardCard>
             <DashboardCard
                title="תשלומים"
                icon={CreditCard}
                manageHref={`/client/${currentClient?.id}/uploads`}
                tourId="dashboard-payments-card"
            >
                <div className="space-y-2 text-sm text-left">
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">סה"כ מסמכים<FileText className="h-4 w-4"/></span>
                        <span className="font-mono font-bold text-lg">{stats.documentsCount}</span>
                    </div>
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium flex items-center gap-1.5">מסמכים חדשים (החודש)<Upload className="h-4 w-4"/></span>
                        <span className="font-mono font-bold text-lg text-primary">{stats.newDocumentsCount}</span>
                    </div>
                </div>
            </DashboardCard>
            <DashboardCard
                title="קישורים מהירים"
                icon={Link2}
                disabled={!!isClientInactive}
                headerContent={
                     <Button asChild variant="ghost" size="sm">
                        <Link href={`/client/${currentClient?.id}/links`}>
                            <Edit className="ml-2 h-4 w-4" />
                            ערוך
                        </Link>
                    </Button>
                }
            >
                 <div className="space-y-2">
                    {currentClient?.links && currentClient.links.length > 0 ? (
                        currentClient.links.slice(0, 3).map(link => (
                            <Button asChild variant="secondary" className="w-full justify-between" key={link.id}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <span>{link.name}</span>
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </Button>
                        ))
                    ) : (
                        <p className="text-sm text-center text-muted-foreground pt-4">לא הוגדרו קישורים.</p>
                    )}
                </div>
            </DashboardCard>
             <DashboardCard
                title="בקשות גישה"
                icon={MailQuestion}
                manageHref={`/client/${currentClient?.id}/requests`}
                permission={!!currentClient?.permissions?.canCreateViewers}
                disabled={!!isClientInactive}
            >
                 <div className="space-y-2 text-sm text-left">
                     <div className="flex justify-between items-center p-2 rounded-md bg-muted/30">
                        <span className="font-medium">בקשות ממתינות לאישור</span>
                        <span className="font-mono font-bold text-lg text-yellow-400">{stats.pendingRequests}</span>
                    </div>
                </div>
            </DashboardCard>
             {isClientInactive && (
                <Card className="border-yellow-500/50 bg-yellow-500/10 flex flex-col w-full h-full">
                    <CardHeader>
                        <div className="flex justify-end items-center gap-4">
                            <div className="text-right">
                                <CardTitle className="text-yellow-300">
                                    {currentClient?.receiptUrl ? "אישור ממתין לאישור" : "חידוש חשבון"}
                                </CardTitle>
                                <p className="text-yellow-400/80 text-sm mt-1">
                                   {currentClient?.receiptUrl ? "האישור הועלה בהצלחה ויטופל על ידי המנהל." : "חשבונך אינו פעיל. בצע תשלום והעלה אישור."}
                                </p>
                            </div>
                            <div className="p-3 bg-yellow-500/20 rounded-md">
                                <CreditCard className="h-6 w-6 text-yellow-300" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-col gap-4">
                        {currentClient?.receiptUrl ? (
                            <div className="flex items-center justify-center text-center p-4 bg-green-500/10 text-green-300 rounded-md">
                                <CheckCircle className="h-5 w-5 ml-2" />
                                <span>אישור התשלום הועלה בהצלחה</span>
                            </div>
                        ) : (requestStatus === 'sent' || currentClient?.status === 'בהמתנה') ? (
                            <div className="space-y-2">
                                 <Label htmlFor="receipt-upload">העלה אישור תשלום (PDF)</Label>
                                 <div className="flex items-center gap-2">
                                    <Input 
                                        id="receipt-upload" 
                                        type="file" 
                                        accept="application/pdf"
                                        className="flex-1"
                                        onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                    <Button onClick={handleReceiptUpload} disabled={isUploadingReceipt || !receiptFile}>
                                        {isUploadingReceipt && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                                        <Upload className="h-4 w-4"/>
                                    </Button>
                                 </div>
                            </div>
                        ) : (
                            <Button 
                                className="w-full" 
                                variant="secondary"
                                onClick={handleRenewalRequest} 
                                disabled={isSubmittingRequest}
                            >
                                {isSubmittingRequest && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                                בצע תשלום ושלח בקשת חידוש
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
