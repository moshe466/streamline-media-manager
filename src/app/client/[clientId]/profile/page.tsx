

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, RefreshCw } from 'lucide-react';
import { type Client } from '@/services/clients';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Separator } from '@/components/ui/separator';


export default function ClientProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const clientDataString = sessionStorage.getItem('clientData');
        if (clientDataString) {
            setClient(JSON.parse(clientDataString));
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את פרטי הלקוח.' });
            router.push(`/client/${clientId}/dashboard`);
        }
        setIsLoading(false);
    }, [clientId, router, toast]);

    const handleRenewSubscription = () => {
        window.open('https://mrng.to/lAfc8WSZYy', '_blank');
    };

    const shouldShowRenewButton = () => {
        if (!client || !client.activeUntil) {
            return false;
        }

        const expiryDate = parseISO(client.activeUntil);
        const today = new Date();
        const daysUntilExpiry = differenceInDays(expiryDate, today);

        if (client.status === 'לא פעיל') {
            return true;
        }

        if (daysUntilExpiry <= 30) {
            return true;
        }

        return false;
    };


    if (isLoading || !client) {
        return (
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Button asChild variant="outline">
                        <Link href={`/client/${clientId}/dashboard`}>
                           <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה ללוח הבקרה
                        </Link>
                    </Button>
                </div>
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
             <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href={`/client/${clientId}/dashboard`}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה ללוח הבקרה
                    </Link>
                </Button>
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold tracking-tight">מצב הפרופיל</h1>
                    <p className="text-muted-foreground">
                        סקירה כללית של סטטוס החשבון וההרשאות העיקריות שלך.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">
                        פרטי חשבון
                        <User className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>
                        ההרשאות והמגבלות שלך עשויות להשתנות על ידי מנהל המערכת.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex justify-between items-center p-3 border rounded-lg">
                        <Badge 
                            variant={client.status === 'פעיל' ? 'default' : 'destructive'} 
                            className={client.status === 'פעיל' ? 'bg-green-600' : 'bg-red-600'}
                        >
                            {client.status}
                        </Badge>
                        <span className="font-semibold">:סטטוס חשבון</span>
                    </div>
                     <div className="flex justify-between items-center p-3 border rounded-lg">
                        <span className="font-mono">{client.activeUntil ? format(parseISO(client.activeUntil), 'dd/MM/yyyy') : 'ללא הגבלה'}</span>
                        <span className="font-semibold">:בתוקף עד</span>
                    </div>
                     <div className="flex justify-between items-center p-3 border rounded-lg">
                       <span className="font-mono">{client.permissions.maxStreams === Infinity ? 'ללא הגבלה' : client.permissions.maxStreams}</span>
                       <span className="font-semibold">:מקסימום שידורים ליצירה</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                       <span className="font-mono">{client.permissions.maxPushDestinations}</span>
                       <span className="font-semibold">:מקסימום יעדי Push לשידור</span>
                    </div>
                     <div className="flex justify-between items-center p-3 border rounded-lg">
                        <Badge variant={client.permissions.canCreateStreams ? 'default' : 'secondary'} className={client.permissions.canCreateStreams ? 'bg-green-600' : 'bg-muted-foreground'}>
                            {client.permissions.canCreateStreams ? 'מורשה' : 'לא מורשה'}
                        </Badge>
                       <span className="font-semibold">:יצירת שידורים חדשים</span>
                    </div>
                     <div className="flex justify-between items-center p-3 border rounded-lg">
                        <Badge variant={client.permissions.canDeleteStreams ? 'default' : 'secondary'} className={client.permissions.canDeleteStreams ? 'bg-green-600' : 'bg-muted-foreground'}>
                            {client.permissions.canDeleteStreams ? 'מורשה' : 'לא מורשה'}
                        </Badge>
                       <span className="font-semibold">:מחיקת שידורים</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border rounded-lg">
                        <Badge variant={client.permissions.canCreateViewers ? 'default' : 'secondary'} className={client.permissions.canCreateViewers ? 'bg-green-600' : 'bg-muted-foreground'}>
                            {client.permissions.canCreateViewers ? 'מורשה' : 'לא מורשה'}
                        </Badge>
                       <span className="font-semibold">:יצירת צופים</span>
                    </div>
                     {shouldShowRenewButton() && (
                        <div className="flex justify-between items-center p-3 border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                            <Button onClick={handleRenewSubscription}>
                                <RefreshCw className="ml-2 h-4 w-4" />
                                חידוש מנוי
                            </Button>
                           <span className="font-semibold">:חידוש מנוי</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
