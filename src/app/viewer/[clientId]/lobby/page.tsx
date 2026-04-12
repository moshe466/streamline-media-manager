

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clapperboard, Video, Grid, Link2, User, RefreshCw, Lock, Loader2, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Viewer } from '@/services/viewers';
import { requestPermissionRenewalForViewer } from '@/services/requests';
import { getClientById, type Client } from '@/services/clients';
import { format, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

type LobbyCardProps = {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  disabled?: boolean;
};

const LobbyCard = ({ href, title, description, icon: Icon, disabled = false }: LobbyCardProps) => {
    const content = (
        <Card className={cn("hover:border-primary transition-colors duration-200 flex flex-col w-full h-full", disabled && "bg-muted/50 border-dashed hover:border-dashed pointer-events-none opacity-60")}>
            <CardHeader>
                <div className="flex justify-end items-center gap-4">
                    <div className="text-right">
                        <CardTitle className={cn(disabled && "flex items-center gap-2")}>
                            {disabled && <Lock className="h-4 w-4" />}
                            {title}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm mt-1">{description}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                </div>
            </CardHeader>
        </Card>
    );

    if (disabled) {
        return <div>{content}</div>;
    }

    return <Link href={href} className="flex">{content}</Link>;
};

export default function ViewerLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.clientId as string;
  const viewerId = typeof window !== 'undefined' ? sessionStorage.getItem('userId') : null;

  const [isLoading, setIsLoading] = useState(true);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [clientData, setClientData] = useState<Client | null>(null);
  
  const handleLogout = useCallback(() => {
      sessionStorage.clear();
      router.push('/login');
  }, [router]);
  
  useEffect(() => {
    const handleStorageChange = () => {
        const viewerDataString = sessionStorage.getItem('viewerData');
        if (viewerDataString) {
            setViewer(JSON.parse(viewerDataString));
        }
    };
    
    // Initial load
    handleStorageChange();
    setIsLoading(false);
    
    // Listen for updates from layout
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };

  }, []);

  const handleRenewalRequest = async () => {
      if (!viewerId || !clientId) return;
      setIsSubmittingRequest(true);
      const result = await requestPermissionRenewalForViewer(viewerId, clientId);
      if (result.success) {
          toast({ title: "בקשה נשלחה", description: "בקשתך לחידוש הגישה נשלחה לאישור." });
          setRequestStatus('sent');
          // Fetch client data to show contact info
          const client = await getClientById(clientId);
          setClientData(client);
      } else {
          toast({ variant: 'destructive', title: "שליחה נכשלה", description: result.error });
          setRequestStatus('error');
      }
      setIsSubmittingRequest(false);
  };


  const menuItems = [
    { href: `/viewer/${clientId}/streams`, title: "שידורים חיים", description: "צפה בשידורים הפעילים כעת", icon: Clapperboard },
    { href: `/viewer/${clientId}/dvr`, title: "ארכיון (DVR)", description: "צפה בהקלטות של שידורים קודמים", icon: Video },
    { href: `/viewer/${clientId}/links`, title: "קישורים שימושיים", description: "קישורים חיצוניים ששותפו עבורך", icon: Link2 },
  ];

  const hasExpired = viewer?.expiresAt ? isPast(parseISO(viewer.expiresAt)) : false;
  
  if (isLoading) {
      return (
          <div className="p-8 space-y-8">
              <Skeleton className="h-10 w-3/4" />
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
              </div>
          </div>
      );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
        <div className="space-y-2 text-right">
            <h1 className="text-3xl font-bold tracking-tight">ברוך הבא, {viewer?.nickname}</h1>
            <p className="text-muted-foreground">
                זהו לובי הכניסה שלך. מכאן תוכל לנווט לאזורים השונים הפתוחים עבורך.
            </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {menuItems.map(item => <LobbyCard key={item.href} {...item} disabled={hasExpired} />)}
             <LobbyCard
                href={`/viewer/${clientId}/settings`}
                title="סטטוס החשבון"
                description={
                    hasExpired 
                        ? "ההרשאות שלך פגו."
                        : `ההרשאות שלך בתוקף עד: ${viewer?.expiresAt ? format(parseISO(viewer.expiresAt), 'dd/MM/yyyy HH:mm') : 'ללא הגבלה'}`
                }
                icon={User}
             />

            {hasExpired && (
                 <Card className="border-yellow-500/50 bg-yellow-500/10 flex flex-col w-full h-full">
                    <CardHeader>
                        <div className="flex justify-end items-center gap-4">
                            <div className="text-right">
                                <CardTitle className="text-yellow-300">בקשה לפתיחת הרשאות</CardTitle>
                                <p className="text-yellow-400/80 text-sm mt-1">לחץ על הכפתור כדי לבקש חידוש גישה</p>
                            </div>
                            <div className="p-3 bg-yellow-500/20 rounded-md">
                                <RefreshCw className="h-6 w-6 text-yellow-300" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-col gap-4">
                        <Button 
                            className="w-full" 
                            variant="secondary"
                            onClick={handleRenewalRequest} 
                            disabled={isSubmittingRequest || requestStatus === 'sent'}
                        >
                            {isSubmittingRequest && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {requestStatus === 'sent' ? 'בקשה נשלחה' : 'שלח בקשת חידוש'}
                        </Button>
                        {requestStatus === 'sent' && clientData && (
                            <div className="text-center text-xs text-yellow-200/80 p-2 bg-black/20 rounded-md">
                                <p>ליצירת קשר עם מנהל השידור:</p>
                                <p className="font-semibold">{clientData.nickname}, טלפון: {clientData.phone}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    </div>
  );
}
