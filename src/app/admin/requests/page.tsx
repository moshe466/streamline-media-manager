

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MailQuestion, Check, X, ArrowRight, Clock, User, Users, Search as SearchIcon, FileText, Loader2, Info, Trash2, Eye } from 'lucide-react';
import { type PermissionRequest, getAllRequestsForAdmin, resolveRequest, cleanupRejectedRequests, forceDeleteRejectedRequest } from '@/services/requests';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


export default function AdminRequestsPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const [allRequests, setAllRequests] = useState<PermissionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    const fetchData = useCallback(async (isInitialLoad = false) => {
        if(isInitialLoad) setIsLoading(true);
        try {
            // Run cleanup first
            const cleanupResult = await cleanupRejectedRequests();
            if (!isInitialLoad && cleanupResult.deletedCount > 0) {
                toast({ title: "ניקוי אוטומטי", description: `נמחקו ${cleanupResult.deletedCount} בקשות שנדחו.` });
            }

            const fetchedRequests = await getAllRequestsForAdmin();
            setAllRequests(fetchedRequests);

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את רשימת הבקשות.' });
        } finally {
            if(isInitialLoad) setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        setIsClient(true);
        fetchData(true); // Initial fetch
        const intervalId = setInterval(() => fetchData(false), 10000); // Poll every 10 seconds
        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, [fetchData]);

    const handleResolve = async (requestId: string, action: 'approve' | 'reject') => {
        setIsProcessing(requestId);
        try {
            const result = await resolveRequest(requestId, action, 'admin');
            if (result.success) {
                toast({ title: 'הפעולה בוצעה בהצלחה' });
                // Manually trigger a sidebar data refresh after action
                window.dispatchEvent(new Event('sidebarDataUpdated'));
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
            }
        } catch(e) {
            toast({ variant: 'destructive', title: 'שגיאה', description: (e as Error).message });
        }
        setIsProcessing(null);
    };
    
    const handleReviewClient = async (request: PermissionRequest) => {
        setIsProcessing(request.id);
        try {
            // For existing clients, just navigate. For new clients, start the review process.
            if (request.requestorType === 'client') {
                 router.push(`/admin/clients/${encodeURIComponent(request.clientId)}/permissions?reqId=${request.id}`);
            } else {
                const result = await resolveRequest(request.id, 'review', 'admin');
                if (result.success && result.clientId) {
                    setAllRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'in_progress' } : r));
                    window.dispatchEvent(new Event('sidebarDataUpdated')); // Refresh sidebar count
                    router.push(`/admin/clients/${encodeURIComponent(result.clientId)}/permissions?reqId=${request.id}`);
                } else {
                    throw new Error(result.error || "Failed to start review process.");
                }
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה', description: (e as Error).message });
            setIsProcessing(null);
        }
    }

    const handleDelete = async (requestId: string) => {
        setIsProcessing(requestId);
        try {
            const result = await forceDeleteRejectedRequest(requestId);
            if(result.success) {
                toast({ title: "הבקשה נמחקה", variant: "destructive" });
                 window.dispatchEvent(new Event('sidebarDataUpdated'));
                await fetchData();
            } else {
                toast({ variant: 'destructive', title: 'שגיאה במחיקה', description: result.error });
            }
        } catch(e) {
             toast({ variant: 'destructive', title: 'שגיאה', description: (e as Error).message });
        }
        setIsProcessing(null);
    }
    
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
            case 'pending': return 'ממתין';
            case 'in_progress': return 'בטיפול';
            default: return status;
        }
    };

     const getRequestorTypeIcon = (type: PermissionRequest['requestorType']) => {
        switch (type) {
            case 'client': return <User className="h-4 w-4 text-amber-400" />;
            case 'viewer': return <Users className="h-4 w-4 text-sky-400" />;
            case 'new_client_questionnaire': return <FileText className="h-4 w-4 text-indigo-400" />;
            default: return <User className="h-4 w-4" />;
        }
     }
     
     const getRequestorTypeText = (type: PermissionRequest['requestorType']) => {
         switch(type) {
            case 'client': return 'לקוח קיים';
            case 'viewer': return 'צופה';
            case 'new_client_questionnaire': return 'טופס לקוח חדש';
            default: 'לא ידוע';
         }
     }
     
     const renderQuestionnaireChanges = (request: PermissionRequest) => {
        if (request.requestorType !== 'new_client_questionnaire' || !request.existingData) {
            return <p>לקוח חדש. כל הפרטים מולאו בטופס.</p>;
        }

        const changes = Object.keys(request.questionnaireData).filter(key => 
            request.questionnaireData[key] && request.questionnaireData[key] !== (request.existingData as any)[key]
        );

        if (changes.length === 0) {
            return <p>לא התבקשו שינויים בפרטים הקיימים.</p>;
        }
        
        return (
            <div className="space-y-2 text-sm">
                {changes.map(key => (
                     <div key={key} className="flex justify-between border-b pb-1">
                        <div className="text-left space-x-2">
                             <span className="text-red-400 line-through">{(request.existingData as any)[key] || 'ריק'}</span>
                             <span>&rarr;</span>
                             <span className="text-green-400">{request.questionnaireData[key]}</span>
                        </div>
                        <span className="font-semibold">{key}</span>
                     </div>
                ))}
            </div>
        )
     }
     
    const adminRequests = allRequests.filter(req => req.requestorType === 'client' || req.requestorType === 'new_client_questionnaire');
    const clientViewerRequests = allRequests.filter(req => req.requestorType === 'viewer');

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
            <div className="flex items-center justify-between">
                <div></div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">ניהול בקשות גישה</h1>
                    <p className="text-muted-foreground">
                       אשר או דחה בקשות גישה וצפה בפעילות המערכת.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        בקשות הממתינות לטיפול המנהל
                        <MailQuestion className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>אלו הן בקשות להצטרפות לקוחות חדשים או חידוש מנוי של לקוחות קיימים.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table className="responsive-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right w-[180px]">פעולות</TableHead>
                                <TableHead className="text-right">סטטוס</TableHead>
                                <TableHead className="text-right">זמן בקשה</TableHead>
                                <TableHead className="text-right">סוג</TableHead>
                                <TableHead className="text-right">מבקש</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : adminRequests.length > 0 ? (
                                adminRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell data-label="פעולות"><div className="flex items-center justify-end gap-2">
                                            {req.status === 'pending' && (
                                                <>
                                                    <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={!!isProcessing}><X className="h-4 w-4 ml-2"/>דחה</Button></AlertDialogTrigger><AlertDialogContent className="text-right"><AlertDialogHeader><AlertDialogTitle>לדחות את הבקשה?</AlertDialogTitle><AlertDialogDescription>הפעולה תסמן את הבקשה כדחויה ותאפשר למחוק אותה. היא תימחק אוטומטית לאחר 5 דקות.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleResolve(req.id, 'reject')} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">כן, דחה בקשה</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                                    <Button size="sm" onClick={() => handleReviewClient(req)} disabled={!!isProcessing}>{isProcessing === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <SearchIcon className="h-4 w-4 ml-2" />}{req.status === 'pending' ? 'בדוק בקשה' : 'המשך טיפול'}</Button>
                                                </>
                                            )}
                                            {req.status === 'rejected' && (
                                                <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={!!isProcessing}><Trash2 className="h-4 w-4 ml-2"/>מחק</Button></AlertDialogTrigger><AlertDialogContent className="text-right"><AlertDialogHeader><AlertDialogTitle>למחוק את הבקשה?</AlertDialogTitle><AlertDialogDescription>פעולה זו תמחק את הבקשה ואת הלקוח המשויך (אם נוצר מטופס) לצמיתות. לא ניתן לבטל פעולה זו.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(req.id)} className="bg-destructive hover:bg-destructive/90">כן, מחק</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                                            )}
                                            {req.status === 'approved' && <span className="text-xs text-muted-foreground">טופל</span>}
                                        </div></TableCell>
                                        <TableCell data-label="סטטוס"><Badge variant={getStatusVariant(req.status)}>{getStatusText(req.status)}</Badge></TableCell>
                                        <TableCell data-label="זמן בקשה">{isClient && formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true, locale: he })}</TableCell>
                                        <TableCell data-label="סוג"><div className="flex items-center justify-end gap-2"><span>{getRequestorTypeText(req.requestorType)}</span>{getRequestorTypeIcon(req.requestorType)}</div></TableCell>
                                        <TableCell data-label="מבקש"><div className="flex items-center justify-end gap-2">
                                            {req.requestorType === 'new_client_questionnaire' && (<TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-4 w-4 text-blue-400 cursor-pointer" /></TooltipTrigger><TooltipContent className="text-right max-w-sm" side="top"><h4 className="font-bold border-b mb-2 pb-1">פרטי הבקשה מהטופס:</h4>{renderQuestionnaireChanges(req)}</TooltipContent></Tooltip></TooltipProvider>)}
                                            <span>{req.requestorNickname}</span>
                                        </div></TableCell>
                                    </TableRow>
                                ))
                            ) : (<TableRow><TableCell colSpan={5} className="h-24 text-center">אין בקשות ממתינות במערכת.</TableCell></TableRow>)}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                       פעילות בקשות צופים (למעקב)
                        <Eye className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>טבלה זו מציגה את כל הבקשות שצופים שולחים ללקוחות השונים, ומאפשרת לך לעקוב אחר הפעילות.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table className="responsive-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">סטטוס</TableHead>
                                <TableHead className="text-right">זמן בקשה</TableHead>
                                <TableHead className="text-right">שם הלקוח</TableHead>
                                <TableHead className="text-right">שם הצופה</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : clientViewerRequests.length > 0 ? (
                                clientViewerRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell data-label="סטטוס"><Badge variant={getStatusVariant(req.status)}>{getStatusText(req.status)}</Badge></TableCell>
                                        <TableCell data-label="זמן בקשה">{isClient && formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true, locale: he })}</TableCell>
                                        <TableCell data-label="שם הלקוח">{req.clientId}</TableCell>
                                        <TableCell data-label="שם הצופה">{req.requestorNickname}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">אין בקשות מצופים.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
