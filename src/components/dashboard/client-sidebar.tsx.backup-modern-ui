
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Users,
  Grid,
  Link2,
  LogOut,
  Settings,
  Tv,
  User,
  MailQuestion,
  Lock,
  Check,
  X,
  Loader2,
  Target,
  Megaphone,
  Bell,
  ImageIcon,
  RadioTower,
} from 'lucide-react';
import { type Client } from '@/services/clients';
import { getViewerRequestsByClientId, resolveRequest, type PermissionRequest } from '@/services/requests';
import { Logo } from '../logo';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { isPast, parseISO } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';


interface ClientSidebarProps {
  handleLogout: () => void;
}

const HARDCODED_DEFAULT_MAIN_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";


function PendingRequestsPopover({ clientId }: { clientId: string }) {
    const { toast } = useToast();
    const [requests, setRequests] = useState<PermissionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        const allRequests = await getViewerRequestsByClientId(clientId);
        setRequests(allRequests.filter(r => r.status === 'pending'));
        setIsLoading(false);
    }, [clientId]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleResolve = async (requestId: string, action: 'approve' | 'reject') => {
        setIsProcessing(requestId);
        try {
            const result = await resolveRequest(requestId, action, 'client');
            if(result.success) {
                 toast({ title: 'הפעולה בוצעה בהצלחה' });
                 await fetchRequests(); // Refresh the list
                 window.dispatchEvent(new CustomEvent('clientDataUpdated')); // Notify other components
            } else {
                 toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
            }
        } catch(e) {
            toast({ variant: 'destructive', title: 'שגיאה', description: (e as Error).message });
        } finally {
            setIsProcessing(null);
        }
    }

    if (isLoading) {
        return <div className="p-4"><Loader2 className="h-4 w-4 animate-spin"/></div>;
    }

    if (requests.length === 0) {
        return <div className="p-4 text-sm text-muted-foreground">אין בקשות ממתינות.</div>
    }

    return (
        <div className="p-2 space-y-2">
            {requests.map(req => (
                <div key={req.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                    <div className="flex gap-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-500/10 hover:text-red-500" disabled={!!isProcessing} onClick={() => handleResolve(req.id, 'reject')}>
                            {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4"/>}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10 hover:text-green-500" disabled={!!isProcessing} onClick={() => handleResolve(req.id, 'approve')}>
                           {isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4"/>}
                        </Button>
                    </div>
                    <span className="text-sm font-medium">{req.requestorNickname}</span>
                </div>
            ))}
        </div>
    )
}


type ClientSidebarItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  disabled: boolean;
  tourId: string;
  badge?: number;
  onClick?: () => void;
};

export function ClientSidebar({ handleLogout }: ClientSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchSidebarData = useCallback(async () => {
    if (!clientId) return;
    try {
        const clientDataString = sessionStorage.getItem('clientData');
        if (clientDataString) {
            const parsedClient = JSON.parse(clientDataString);
            setClient(parsedClient);
            if (parsedClient.permissions?.canCreateViewers) {
                const allRequests = await getViewerRequestsByClientId(clientId);
                setPendingRequestsCount(allRequests.filter(r => r.status === 'pending').length);
            }
        }
    } catch (error) {
        console.error("Failed to fetch sidebar data:", error);
    } finally {
        setIsLoading(false);
    }
  }, [clientId]);


  useEffect(() => {
    fetchSidebarData(); // Initial load
    
    const handleClientDataUpdate = () => {
        fetchSidebarData();
    };

    window.addEventListener('clientDataUpdated', handleClientDataUpdate);
    
    const intervalId = setInterval(fetchSidebarData, 10000); 

    return () => {
        window.removeEventListener('clientDataUpdated', handleClientDataUpdate);
        clearInterval(intervalId);
    };
  }, [fetchSidebarData]);

  const handleLiveBroadcastClick = () => {
    const liveBroadcastUrl = `${window.location.origin}/live-broadcast`;
    window.open(liveBroadcastUrl, '_blank');

    if (isMobile) {
        navigator.clipboard.writeText(liveBroadcastUrl)
            .then(() => {
                toast({ title: "הקישור לשידור הועתק!" });
            })
            .catch(err => {
                console.error('Failed to copy link: ', err);
                toast({ variant: "destructive", title: "שגיאה בהעתקת הקישור" });
            });
    }
    setOpenMobile(false);
  };

  if (isLoading) {
      return (
          <Sidebar side="left" className="border-r border-border/50">
            <SidebarHeader><div className="flex items-center justify-center p-4"><Skeleton className="h-[75px] w-[150px] rounded-md" /></div></SidebarHeader>
             <SidebarMenu className="flex-1 px-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </SidebarMenu>
            <SidebarFooter className="p-4">
                 <Skeleton className="h-8 w-full" />
                 <Skeleton className="h-8 w-full" />
            </SidebarFooter>
          </Sidebar>
      );
  }

  const isClientInactive = client?.status !== 'פעיל' || (client?.activeUntil && isPast(parseISO(client.activeUntil)));
  const logoToShow = client?.customLogoUrl || HARDCODED_DEFAULT_MAIN_LOGO_URL;

  const menuItems: ClientSidebarItem[] = [
    { href: `/client/${clientId}/dashboard`, label: 'דף הבית', icon: Home, disabled: false, tourId: 'sidebar-home' },
    { href: `/client/${clientId}/profile`, label: 'מצב הפרופיל', icon: User, disabled: false, tourId: 'sidebar-profile' },
  ];

  if (client?.permissions?.canUseWebRTC) {
      menuItems.push({ 
          href: '#', // The href is now handled by the onClick
          onClick: handleLiveBroadcastClick,
          label: 'שידור חי מהדפדפן', 
          icon: RadioTower, 
          disabled: !!isClientInactive, 
          tourId: 'sidebar-live-broadcast' 
      });
  }

  menuItems.push(
    { href: `/client/${clientId}/streams`, label: 'ניהול שידורים', icon: Tv, disabled: !!isClientInactive, tourId: 'sidebar-streams' },
    { href: `/client/${clientId}/destinations`, label: 'בנק יעדים', icon: Target, disabled: !!isClientInactive, tourId: 'sidebar-destinations' },
    { href: `/client/${clientId}/mcr`, label: 'קונטרול NCR', icon: Grid, disabled: !!isClientInactive, tourId: 'sidebar-mcr' },
  );
  
  if (client?.permissions?.canCreateViewers) {
      menuItems.push({ href: `/client/${clientId}/viewers`, label: 'הצופים שלי', icon: Users, disabled: !!isClientInactive, tourId: 'sidebar-viewers' });
      menuItems.push({ href: `/client/${clientId}/requests`, label: 'בקשות גישה', icon: MailQuestion, badge: pendingRequestsCount, disabled: !!isClientInactive, tourId: 'sidebar-requests' });
  }

  menuItems.push({ href: `/client/${clientId}/notifications`, label: 'הגדרות התראות', icon: Bell, disabled: false, tourId: 'sidebar-notifications' });
  menuItems.push({ href: `/client/${clientId}/whats-new`, label: 'מה חדש?', icon: Megaphone, disabled: false, tourId: 'sidebar-whats-new' });
  menuItems.push({ href: `/client/${clientId}/links`, label: 'קישורים מהירים', icon: Link2, disabled: !!isClientInactive, tourId: 'sidebar-links' });


  return (
    <Sidebar side="left" className="border-r border-border/50">
      <SidebarHeader>
        <div className="flex items-center justify-center p-4">
            <Logo clientId={clientId} className="h-[75px] w-[150px]" />
        </div>
      </SidebarHeader>
      <SidebarMenu className="flex-1 px-4">
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.href} data-tour={item.tourId}>
             <div className="flex w-full items-center">
                 {item.badge && item.badge > 0 && !item.disabled ? (
                     <Popover>
                        <PopoverTrigger asChild>
                             <Badge className="mr-auto z-10 cursor-pointer bg-yellow-400 text-black hover:bg-yellow-400/80">{item.badge}</Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-0" align="start">
                            <PendingRequestsPopover clientId={clientId} />
                        </PopoverContent>
                     </Popover>
                 ) : (
                    item.badge && item.badge > 0 && !item.disabled && (
                        <Badge className="mr-auto bg-yellow-400 text-black hover:bg-yellow-400/80">{item.badge}</Badge>
                    )
                 )}
                 {item.onClick || item.disabled ? (
                    <SidebarMenuButton
                        onClick={item.onClick}
                        isActive={false}
                        className="justify-start flex-1"
                        aria-disabled={!!item.disabled}
                    >
                      {item.disabled ? <Lock className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                 ) : (
                    <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                        className="justify-start flex-1"
                        aria-disabled={false}
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                 )}
             </div>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter className="p-4">
        <SidebarSeparator />
         <SidebarMenuButton asChild isActive={pathname.startsWith(`/client/${clientId}/settings`)} className="mt-2 justify-start" data-tour="sidebar-settings">
            <Link href={`/client/${clientId}/settings`} onClick={() => setOpenMobile(false)}>
              <Settings className="h-5 w-5" />
              <span>הגדרות</span>
            </Link>
        </SidebarMenuButton>
         <SidebarMenuButton onClick={() => { handleLogout(); setOpenMobile(false); }} className="mt-2 justify-start">
            <LogOut className="h-5 w-5" />
            <span>התנתקות</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
