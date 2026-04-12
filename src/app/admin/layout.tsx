
'use client';

import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/dashboard/admin-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardFooter } from '@/components/dashboard/footer';
import { VersionUpdateDialog } from '@/components/dashboard/version-update-dialog';
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useCallback, useState } from "react";
import { NewReceiptNotification } from "@/components/dashboard/new-receipt-notification";
import { useInactivityTimeout } from "@/hooks/use-inactivity-timeout";
import { InactivityWarningDialog } from "@/components/dashboard/inactivity-warning-dialog";
import { validateSession } from "@/services/auth";
import { Loader2 } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(0);
  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isLiveBroadcastPage = pathname.startsWith('/admin/live-broadcast');

  const handleLogout = useCallback((message?: string) => {
    const role = sessionStorage.getItem('userRole');
    const entryPoint = localStorage.getItem('loginEntryPoint') || 'standard';
    
    // Determine the base login path to return to
    const baseLoginPath = entryPoint === 'uh' ? '/uh' : '/login';
    
    // If the user is a broadcaster, always send them back to the broadcast login page.
    const redirectPath = role === 'broadcaster' ? '/live-broadcast' : baseLoginPath;

    sessionStorage.clear();
    toast({
      title: "נותקת מהמערכת",
      description: message || "הועברת לדף הכניסה.",
    });
    router.push(redirectPath);
  }, [router, toast]);
  
  // Conditionally apply the inactivity hook
  const { resetInactivityTimers } = useInactivityTimeout(
    () => handleLogout("נותקת עקב חוסר פעילות."),
    (countdown) => {
      setWarningCountdown(countdown);
      setIsWarningOpen(true);
    },
    () => setIsWarningOpen(false),
    isLiveBroadcastPage && userRole === 'broadcaster' // Disable only for broadcasters on the live page
  );
  
  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    
    setUserRole(role);
    
    // The lobby is now accessible to broadcasters, so we allow that role here.
    if (role === 'broadcaster' && pathname.startsWith('/admin/live-broadcast')) {
        setIsAuthorizing(false);
        // Broadcaster doesn't need further validation here as their specific page will handle it.
        return; 
    }
    
    if (!role || !userId || !sessionId) {
        handleLogout();
        return;
    }
    
    // Prevent non-admins/editors from accessing admin pages
    if (!['super-admin', 'admin', 'editor'].includes(role)) {
        handleLogout('אין לך הרשאת גישה לאזור זה.');
        return;
    }

    const checkAuthorization = async () => {
        const result = await validateSession(userId, role, sessionId);
        if (!result.isValid) {
            handleLogout(result.reason || "החיבור שלך נסגר. ייתכן שהתחברת ממכשיר אחר.");
        } else {
             if (isAuthorizing) {
                setIsAuthorizing(false);
            }
        }
    };
    
    checkAuthorization(); // Initial check
    const intervalId = setInterval(checkAuthorization, 15000); // Check every 15 seconds

    return () => clearInterval(intervalId);
  }, [handleLogout, isAuthorizing, pathname]);


  // If we are on the live broadcast pages AND the user is a broadcaster, use the clean layout.
  // Admins will see the full dashboard layout.
  if (isLiveBroadcastPage && userRole === 'broadcaster') {
    return <>{children}</>;
  }
  
  if (isAuthorizing) {
     return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AdminSidebar handleLogout={() => handleLogout()} />
        <SidebarInset>
            <DashboardHeader userType="admin" handleLogout={() => handleLogout()} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
            <DashboardFooter />
            <VersionUpdateDialog />
            <NewReceiptNotification />
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
