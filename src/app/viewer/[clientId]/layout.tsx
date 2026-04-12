
'use client';

import type { ReactNode } from "react";
import { useEffect, useCallback, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ViewerSidebar } from "@/components/dashboard/viewer-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardFooter } from '@/components/dashboard/footer';
import { VersionUpdateDialog } from '@/components/dashboard/version-update-dialog';
import { useParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getViewerById, type Viewer } from "@/services/viewers-auth";
import { isPast, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { InactivityWarningDialog } from "@/components/dashboard/inactivity-warning-dialog";
import { validateSession } from "@/services/auth";
import { getClientById } from "@/services/clients";


export default function ViewerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const params = useParams();
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(0);

  const handleLogout = useCallback((message?: string) => {
    const entryPoint = localStorage.getItem('loginEntryPoint') || 'standard';
    const redirectPath = entryPoint === 'uh' ? '/uh' : '/login';

    sessionStorage.clear();
    toast({
      title: "נותקת מהמערכת",
      description: message || "הועברת לדף הכניסה.",
    });
    router.push(redirectPath);
  }, [router, toast]);
  
  const { resetInactivityTimers } = useInactivityTimeout(
     () => handleLogout("נותקת עקב חוסר פעילות."),
    (countdown) => {
      setWarningCountdown(countdown);
      setIsWarningOpen(true);
    },
    () => setIsWarningOpen(false)
  );

  const handleAccessDenied = useCallback((message: string) => {
    handleLogout(message);
  }, [handleLogout]);
  
  useEffect(() => {
    const userRole = sessionStorage.getItem('userRole');
    const viewerId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    const urlClientId = params.clientId as string;
    
    if (!userRole || userRole !== 'viewer' || !viewerId || !sessionId || !urlClientId) {
        handleAccessDenied('יש להתחבר מחדש למערכת.');
        return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const checkAuthorization = async () => {
        const sessionResult = await validateSession(viewerId, 'viewer', sessionId);
        if (!sessionResult.isValid) {
            if (intervalId) clearInterval(intervalId);
            handleAccessDenied(sessionResult.reason || "החיבור שלך נסגר. ייתכן שהתחברת ממכשיר אחר.");
            return;
        }

        try {
            const [viewerData, clientData] = await Promise.all([
                getViewerById(viewerId),
                getClientById(decodeURIComponent(urlClientId))
            ]);

            if (!viewerData) {
                if (intervalId) clearInterval(intervalId);
                handleAccessDenied('לא נמצאו פרטי צופה. יש להתחבר מחדש.');
                return;
            }
             if (!clientData) {
                if (intervalId) clearInterval(intervalId);
                handleAccessDenied('לא נמצאו פרטי הלקוח המשוייך. יש להתחבר מחדש.');
                return;
            }

            sessionStorage.setItem('viewerData', JSON.stringify(viewerData));
            sessionStorage.setItem('clientData', JSON.stringify(clientData)); // Cache client data
            window.dispatchEvent(new Event('storage')); // Notify all components of data update

            const hasExpired = viewerData.expiresAt ? isPast(parseISO(viewerData.expiresAt)) : false;
            
            const allowedPaths = [
                `/viewer/${params.clientId}/lobby`,
                `/viewer/${params.clientId}/settings`
            ];

            if (hasExpired && !allowedPaths.includes(pathname)) {
                 toast({
                    variant: "destructive",
                    title: "הגישה פגה",
                    description: "תוקף הגישה שלך פג. אתה מועבר לדף הבית.",
                });
                router.replace(`/viewer/${params.clientId}/lobby`);
                return;
            }

            if (isAuthorizing) {
                setIsAuthorizing(false);
            }

        } catch (error) {
            if (intervalId) clearInterval(intervalId);
            handleAccessDenied('שגיאה באימות פרטים. יש להתחבר מחדש.');
        }
    };
    
    checkAuthorization();
    intervalId = setInterval(checkAuthorization, 15000); // Check every 15 seconds

    return () => {
        if (intervalId) {
            clearInterval(intervalId);
        }
    };

  }, [pathname, params.clientId, handleAccessDenied, router, toast, isAuthorizing]);

  if (isAuthorizing) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <ViewerSidebar handleLogout={() => handleLogout()} />
        <SidebarInset>
            <DashboardHeader userType="viewer" handleLogout={() => handleLogout()} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
            <DashboardFooter />
            <VersionUpdateDialog />
            <InactivityWarningDialog 
                isOpen={isWarningOpen}
                countdown={warningCountdown}
                onStay={() => {
                    setIsWarningOpen(false);
                    resetInactivityTimers();
                }}
                onLogout={() => handleLogout()}
            />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
