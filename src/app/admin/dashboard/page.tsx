

import { StatsCards } from "@/components/dashboard/stats-cards";
import { StatusCards } from "@/components/dashboard/status-cards";
import { QuickLinksCard } from "@/components/dashboard/quick-links-card";
import { getStreams, checkFlussonicStatus } from "@/services/flussonic";
import { testFirestoreConnectionAction } from "@/actions/test-firestore-action";
import { RealtimeStatusGraphs } from "@/components/dashboard/realtime-status-graphs";
import { getSystemCredentials } from "@/services/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const creds = await getSystemCredentials();
  const isFlussonicConfigured = (creds.flussonicServers && creds.flussonicServers.length > 0) || (creds.flussonicHost && creds.flussonicUsername);

  // We only pre-fetch the initial data. The StatusCards component will handle periodic updates.
  const [streams, initialServerStatus, firestoreResult] = await Promise.all([
    isFlussonicConfigured ? getStreams().catch(() => []) : Promise.resolve([]),
    isFlussonicConfigured ? checkFlussonicStatus() : Promise.resolve({ success: false, error: "Not configured" }),
    testFirestoreConnectionAction()
  ]);

  const isDbConnected = firestoreResult.success;

  return (
    <div className="space-y-8 text-right">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">לוח מחוונים - מנהל</h1>
        <p className="text-muted-foreground">
          סקירה כללית של פורטל השידורים שלך.
        </p>
      </div>
      
      <RealtimeStatusGraphs 
        initialFlussonicStatus={initialServerStatus}
        initialDbStatus={firestoreResult}
      />
      <StatusCards 
        initialServerStatus={initialServerStatus} 
        isDbConnected={isDbConnected} 
      />
      <StatsCards streams={streams} />
      <QuickLinksCard />
    </div>
  );
}
