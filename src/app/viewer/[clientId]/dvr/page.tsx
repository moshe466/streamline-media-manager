'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getViewerById } from '@/services/viewers-auth';
import { getStreams, type FlussonicStream, getFlussonicConnectionDetails } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowRight, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Client } from '@/services/clients';
import { StreamCardImage } from '@/components/dashboard/stream-card-image';

export default function ViewerDvrPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);
    
    const [viewer, setViewer] = useState<any>(null);
    const [dvrStreams, setDvrStreams] = useState<FlussonicStream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [client, setClient] = useState<Client | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const viewerId = sessionStorage.getItem('userId');
            const clientDataString = sessionStorage.getItem('clientData');
            
            if (!viewerId || !clientDataString) {
                throw new Error('שגיאת אימות. אנא התחבר מחדש.');
            }

            const clientData = JSON.parse(clientDataString);
            setClient(clientData);

            const [viewerData, allStreams] = await Promise.all([
                getViewerById(viewerId),
                getStreams()
            ]);
            
            if (!viewerData) throw new Error('לא ניתן למצוא את פרטי הצופה.');

            setViewer(viewerData);

            const streamsWithDvrPermission = allStreams.filter(stream => 
                viewerData.permissions && viewerData.permissions[stream.name]?.canWatchDVR
            );

            setDvrStreams(streamsWithDvrPermission);

        } catch (error) {
            console.error("Fetch data error:", error);
            toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading || !client) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-10 w-40" />
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-80" />
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="overflow-hidden flex flex-col group text-right">
                            <Skeleton className="aspect-video w-full" />
                            <div className="p-6 flex-1"><Skeleton className="h-6 w-3/4 mb-2" /></div>
                            <CardFooter className="bg-muted/50 p-3"><Skeleton className="h-9 w-full" /></CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
            <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href={`/viewer/${clientId}/lobby`}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה ללובי
                    </Link>
                </Button>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">ארכיון הקלטות (DVR)</h1>
                    <p className="text-muted-foreground">אלו השידורים שיש לך הרשאה לצפות בהקלטות שלהם.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>שידורים מוקלטים</CardTitle>
                </CardHeader>
                <CardContent>
                    {dvrStreams.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {dvrStreams.map((stream) => (
                                <Card key={stream.name} className="overflow-hidden flex flex-col group text-right border-border/50 hover:border-primary transition-colors">
                                    <Link href={`/viewer/${clientId}/dvr/${encodeURIComponent(stream.name)}`} className="flex flex-col h-full">
                                        <CardHeader className="p-0">
                                            <div className="aspect-video relative overflow-hidden bg-muted">
                                                <StreamCardImage stream={stream} client={client} />
                                            </div>
                                        </CardHeader>
                                        <div className="p-6 flex-1">
                                            <CardTitle className="text-lg">{stream.name}</CardTitle>
                                             <CardDescription className="mt-2">
                                                סטטוס נוכחי: <span className={cn('font-semibold', stream.status === 'online' ? 'text-green-400' : 'text-red-400')}>
                                                {stream.status === 'online' ? 'אונליין' : 'אופליין'}
                                                </span>
                                            </CardDescription>
                                        </div>
                                        <CardFooter className="bg-muted/50 p-3 mt-auto">
                                            <Button className="w-full" variant="secondary">
                                                <Video className="ml-2 h-4 w-4" />
                                                צפה בהקלטה
                                            </Button>
                                        </CardFooter>
                                    </Link>
                                </Card>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-16">
                            <VideoOff className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h2 className="mt-4 text-xl font-semibold">אין הקלטות זמינות</h2>
                            <p className="text-muted-foreground mt-2">
                                אין לך הרשאה לצפות בהקלטות DVR של שידורים כלשהם.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
