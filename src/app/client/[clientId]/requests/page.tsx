

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MailQuestion, Check, X, ArrowRight, Clock, Edit } from 'lucide-react';
import { type PermissionRequest, getViewerRequestsByClientId, resolveRequest } from '@/services/requests';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export default function ClientRequestsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;

    const [requests, setRequests] = useState<PermissionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const fetchedRequests = await getViewerRequestsByClientId(clientId);
            setRequests(fetchedRequests); // Display all requests, not just pending
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את רשימת הבקשות.' });
        } finally {
            if (isLoading) {
                setIsLoading(false);
            }
        }
    }, [clientId, toast, isLoading]);

    useEffect(() => {
        setIsClient(true);
        fetchData(); // Initial fetch
        const intervalId = setInterval(fetchData, 10000); // Poll every 10 seconds

        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, [fetchData]);

    const handleReviewRequest = (viewerId: string) => {
        // Navigate to the viewers page with a query param to open the edit dialog
        router.push(`/client/${clientId}/viewers?edit=${viewerId}`);
    };
    
    const getStatusVariant = (status: PermissionRequest['status']) => {
        switch (status) {
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'pending': return 'secondary';
            case 'in_progress': return 'outline';
            default: return 'secondary';
        }
    };
    
     const getStatusText = (status: PermissionRequest['status']) => {
        switch (status) {
            case 'approved': return 'אושר';
            case 'rejected': return 'נדחה';
            case 'pending': return 'ממתין לטיפול';
            case 'in_progress': return 'בטיפול';
            default: return status;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
            <div className="flex items-center justify-between">
                <div className="space-y-2 text-left">
                    <h1 className="text-3xl font-bold tracking-tight">ניהול בקשות גישה</h1>
                    <p className="text-muted-foreground">
                        אשר או דחה בקשות גישה מצופים שתוקפם פג.
                    </p>
                </div>
                 <div>
                    <Button asChild variant="outline">
                        <Link href={`/client/${clientId}/dashboard`}>
                            <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה לדף הבית
                        </Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-start gap-2">
                        <MailQuestion className="h-5 w-5" />
                        בקשות מצופים
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table className="responsive-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right w-[150px]">פעולות</TableHead>
                                <TableHead className="text-right">סטטוס</TableHead>
                                <TableHead className="text-right">זמן בקשה</TableHead>
                                <TableHead className="text-right">אימייל</TableHead>
                                <TableHead className="text-right">שם הצופה</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : requests.length > 0 ? (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell data-label="פעולות">
                                            {req.status === 'pending' ? (
                                                <Button size="sm" onClick={() => handleReviewRequest(req.requestorId)} disabled={!!isProcessing}>
                                                    <Edit className="h-4 w-4 ml-2"/>
                                                    טפל בבקשה
                                                </Button>
                                            ) : 'טופל'}
                                        </TableCell>
                                        <TableCell data-label="סטטוס">
                                            <Badge variant={getStatusVariant(req.status)}>{getStatusText(req.status)}</Badge>
                                        </TableCell>
                                        <TableCell data-label="זמן בקשה">
                                            {isClient && formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true, locale: he })}
                                        </TableCell>
                                        <TableCell data-label="אימייל">{req.requestorEmail}</TableCell>
                                        <TableCell data-label="שם הצופה">{req.requestorNickname}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        אין בקשות גישה במערכת.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
