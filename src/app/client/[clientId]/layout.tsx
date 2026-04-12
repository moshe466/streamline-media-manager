
'use client';

import type { ReactNode } from "react";
import { useEffect, useCallback, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ClientSidebar } from "@/components/dashboard/client-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardFooter } from '@/components/dashboard/footer';
import { VersionUpdateDialog } from '@/components/dashboard/version-update-dialog';
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { getClientById, type Client } from "@/services/clients";
import { isEqual } from 'lodash';
import { ExpiryNotification } from "@/components/dashboard/expiry-notification";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { InactivityWarningDialog } from "@/components/dashboard/inactivity-warning-dialog";
import { Loader2 } from "lucide-react";
import { validateSession } from "@/services/auth";

const PERMISSIONS_REFETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export default function ClientLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const clientId = params.clientId as string;
  const [clientData, setClientData] = useState<Client | null>(null);
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

  useEffect(() => {
    const userRole = sessionStorage.getItem('userRole');
    const storedId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    const urlClientId = decodeURIComponent(params.clientId as string);

    if (!userRole || userRole !== 'client' || !storedId || storedId.toLowerCase() !== urlClientId.toLowerCase() || !sessionId) {
      handleLogout('שגיאת אימות. יש להתחבר מחדש.');
      return;
    }

    const fetchAndCacheClientData = async () => {
      const sessionResult = await validateSession(storedId, 'client', sessionId);
      if (!sessionResult.isValid) {
          handleLogout(sessionResult.reason || "החיבור שלך נסגר. ייתכן שהתחברת ממכשיר אחר.");
          return;
      }
      
      try {
        const fetchedClientData = await getClientById(urlClientId);
        if (fetchedClientData) {
          const currentCachedDataString = sessionStorage.getItem('clientData');
          const currentCachedData = currentCachedDataString ? JSON.parse(currentCachedDataString) : null;
          
          if (!isEqual(currentCachedData, fetchedClientData)) {
            setClientData(fetchedClientData);
            sessionStorage.setItem('clientData', JSON.stringify(fetchedClientData));
            window.dispatchEvent(new CustomEvent('clientDataUpdated'));
          } else if (!clientData) {
            setClientData(fetchedClientData);
          }
          if (isAuthorizing) setIsAuthorizing(false);
        } else {
          handleLogout('לא ניתן למצוא את פרטי הלקוח.');
        }
      } catch (error) {
        console.error("Failed to fetch client data:", error);
        handleLogout('שגיאה בטעינת נתוני לקוח.');
      }
    };

    fetchAndCacheClientData(); // Initial fetch
    const intervalId = setInterval(fetchAndCacheClientData, 15000); // Poll every 15 seconds
    return () => clearInterval(intervalId);

  }, [params.clientId, handleLogout, clientData, isAuthorizing]);
  
  if (isAuthorizing) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <ClientSidebar handleLogout={() => handleLogout()} />
        <SidebarInset>
          <DashboardHeader userType="client" handleLogout={() => handleLogout()} />
          <main className="flex-1 overflow-auto">
            {clientData && <ExpiryNotification client={clientData} />}
            <div className="p-4 sm:p-6 lg:p-8">
              {children}
            </div>
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
