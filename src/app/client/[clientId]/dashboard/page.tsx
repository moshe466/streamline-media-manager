import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tv, Users, Link2, User, Grid, BadgeCheck, CalendarClock, ListVideo, Wifi, WifiOff, UserX, ExternalLink, MailQuestion, Lock, CreditCard, Upload, CheckCircle, FileText } from 'lucide-react';
import { getClientById, type Client } from '@/services/clients';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { getViewersByClientId, type Viewer } from '@/services/viewers';
import { getViewerRequestsByClientId, type PermissionRequest } from '@/services/requests';
import { listClientDocuments } from '@/services/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isPast, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { DashboardCards } from '@/components/dashboard/client/dashboard-cards';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ClientDashboardPage({ params }: { params: { clientId: string } }) {
    const clientId = decodeURIComponent(params.clientId);

    // Fetch all data on the server
    const [client, allStreams, viewers, requests, documents] = await Promise.all([
        getClientById(clientId),
        getStreams().catch(() => []), // Gracefully handle API errors
        getViewersByClientId(clientId).catch(() => []),
        getViewerRequestsByClientId(clientId).catch(() => []),
        listClientDocuments(clientId).catch(() => []),
    ]);

    if (!client) {
        // This should be handled by the layout's auth check, but as a fallback:
        return (
            <div className="p-8">
                <Card>
                    <CardHeader><CardTitle>שגיאה</CardTitle></CardHeader>
                    <CardContent>
                        <p>לא ניתן היה לטעון את פרטי הלקוח.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    // Process data on the server
    const authorizedStreams = client.permissions.hasAllStreamsAccess
        ? allStreams
        : allStreams.filter((stream: FlussonicStream) => Object.keys(client.permissions.allowedStreams || {}).includes(stream.name));

    const onlineStreams = authorizedStreams.filter(s => s.status === 'online').length;
    const offlineStreams = authorizedStreams.length - onlineStreams;
    const inactiveViewers = viewers.filter(v => v.expiresAt && isPast(parseISO(v.expiresAt))).length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    
    const documentsCount = documents.length;
    const startOfCurrentMonth = startOfMonth(new Date());
    const newDocumentsCount = documents.filter(doc => new Date(doc.timeCreated) >= startOfCurrentMonth).length;
    
    const dashboardStats = {
        client,
        authorizedStreamsCount: authorizedStreams.length,
        onlineStreams,
        offlineStreams,
        viewersCount: viewers.length,
        inactiveViewers,
        pendingRequests,
        documentsCount,
        newDocumentsCount,
    };

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">ברוך הבא, {client?.nickname || 'לקוח'}</h1>
                <p className="text-muted-foreground">
                    זהו לוח הבקרה שלך. מכאן תוכל לנהל את השידורים, הצופים וההגדרות שלך.
                </p>
            </div>
            
            <DashboardCards stats={dashboardStats} />
        </div>
    );
}
