import { getStreams, checkFlussonicStatus } from "@/services/flussonic";
import { testFirestoreConnectionAction } from "@/actions/test-firestore-action";
import { getSystemCredentials } from "@/services/users";
import { AdminDashboardV3 } from "@/components/dashboard-v3/admin-dashboard-v3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const creds = await getSystemCredentials();
  const isFlussonicConfigured =
    (creds.flussonicServers && creds.flussonicServers.length > 0) ||
    (creds.flussonicHost && creds.flussonicUsername);

  const [streams, initialServerStatus, firestoreResult] = await Promise.all([
    isFlussonicConfigured ? getStreams().catch(() => []) : Promise.resolve([]),
    isFlussonicConfigured
      ? checkFlussonicStatus()
      : Promise.resolve({ success: false, error: "Not configured" }),
    testFirestoreConnectionAction(),
  ]);

  return (
    <AdminDashboardV3
      streams={streams}
      initialServerStatus={initialServerStatus}
      firestoreResult={firestoreResult}
    />
  );
}
