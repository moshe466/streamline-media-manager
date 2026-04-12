
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioTower, ChevronLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FlussonicStream, getStreams } from '@/services/flussonic';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getClientById, type Client } from '@/services/clients';
import { useToast } from '@/hooks/use-toast';


export default function LiveBroadcastLobbyPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [authorizedChannels, setAuthorizedChannels] = useState<FlussonicStream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        const role = sessionStorage.getItem('userRole');
        const userId = sessionStorage.getItem('userId');
        setUserRole(role);

        if (!role || !userId) {
            toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'יש להתחבר כדי לגשת לעמוד זה.' });
            router.push('/login');
            return;
        }

        const fetchAndFilterStreams = async (isInitialLoad = false) => {
            if (isInitialLoad) {
                setIsLoading(true);
            }
            try {
                const allStreams = await getStreams();

                if (role === 'admin' || role === 'super-admin' || role === 'broadcaster') {
                    setAuthorizedChannels(allStreams);
                } else if (role === 'client') {
                    const clientDataString = sessionStorage.getItem('clientData');
                    if (!clientDataString) throw new Error("Client data not found");
                    const client: Client = JSON.parse(clientDataString);

                    if (!client.permissions?.canUseWebRTC) {
                         toast({ variant: 'destructive', title: 'אין הרשאה', description: 'אין לך הרשאה לשידור חי מהדפדפן.' });
                         // Close the window if it's a popup, otherwise redirect.
                         if (window.opener) {
                             window.close();
                         } else {
                             router.push(`/client/${userId}/dashboard`);
                         }
                         return;
                    }
                    
                    const permittedStreams = allStreams.filter(stream => 
                        client.permissions?.allowedStreams?.[stream.name]?.canBroadcastWebRTC
                    );
                    setAuthorizedChannels(permittedStreams);
                } else {
                     setAuthorizedChannels([]);
                }
            } catch (error) {
                console.error("Failed to fetch streams for live broadcast page:", error);
                setAuthorizedChannels([]);
            } finally {
                if (isInitialLoad) {
                    setIsLoading(false);
                }
            }
        };

        fetchAndFilterStreams(true); // Perform initial load with loading indicator
        const intervalId = setInterval(() => fetchAndFilterStreams(false), 10000); // Subsequent refreshes run in the background
        return () => clearInterval(intervalId);

    }, [router, toast]);

    const handleStartBroadcast = (streamName: string) => {
        router.push(`/live-broadcast/${streamName}`);
    };

    const pageTitle = (userRole === 'admin' || userRole === 'super-admin' || userRole === 'broadcaster')
        ? "כלל השידורים במערכת"
        : "שידור חי מהמכשיר";

    const pageDescription = (userRole === 'admin' || userRole === 'super-admin' || userRole === 'broadcaster')
        ? "בחר ערוץ כדי לצפות בשידור או להשתלט עליו במידת הצורך."
        : "בחר ערוץ יעד כדי להתחיל שידור ישיר מהמצלמה והמיקרופון של המכשיר שלך.";


    return (
        <div className="space-y-8 text-right">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
                <p className="text-muted-foreground">
                    {pageDescription}
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>בחר ערוץ לשידור</CardTitle>
                    <CardDescription>
                        רק ערוצים שהוגדרו עבורך זמינים לשידור מהדפדפן. ערוצים פעילים יסומנו ולא יהיה ניתן לשדר אליהם.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                    ) : authorizedChannels.length > 0 ? (
                        authorizedChannels.map(channel => (
                            <div key={channel.name} className="grid grid-cols-2 items-center gap-4 p-4 border rounded-lg">
                                <div className="col-span-2 sm:col-span-1 flex justify-start">
                                    <Button 
                                        onClick={() => handleStartBroadcast(channel.name)} 
                                        disabled={channel.status === 'online'}
                                        aria-label={channel.status === 'online' ? 'הערוץ תפוס' : `התחל שידור לערוץ ${channel.name}`}
                                        className="w-full sm:w-auto"
                                    >
                                        <ChevronLeft className="mr-2 h-4 w-4" />
                                        {channel.status === 'online' ? 'בשידור' : 'התחל שידור'}
                                    </Button>
                                </div>
                                <div className="col-span-2 sm:col-span-1 space-y-1 text-right">
                                    <h3 className="font-bold flex items-center justify-end gap-2">
                                        <Badge className={cn("border-transparent", channel.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground')}>
                                            {channel.status === 'online' ? 'אונליין' : 'אופליין'}
                                        </Badge>
                                        {channel.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{channel.title || 'ערוץ מוכן לשידור'}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground p-8">
                            <RadioTower className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-semibold">
                                {userRole === 'admin' || userRole === 'super-admin' ? 'לא נמצאו שידורים בשרת' : 'לא הוגדרו עבורך ערוצים'}
                            </h3>
                            <p className="mt-1 text-sm">
                                {userRole === 'admin' || userRole === 'super-admin' ? 'צור שידור חדש כדי להתחיל.' : 'פנה למנהל המערכת כדי שיקצה לך ערוצים לשידור מהדפדפן.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
