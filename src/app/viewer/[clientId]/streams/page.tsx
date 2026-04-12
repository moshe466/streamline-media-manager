'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getViewerById } from '@/services/viewers-auth';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { VideoOff, Wifi } from 'lucide-react';
import { type Client } from '@/services/clients';
import { StreamCardImage } from '@/components/dashboard/stream-card-image';

export default function ViewerLiveStreamsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [liveStreams, setLiveStreams] = useState<FlussonicStream[]>([]);
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

            const viewerData = await getViewerById(viewerId);
            if (!viewerData) {
                throw new Error('לא ניתן למצוא את פרטי הצופה.');
            }

            const allStreams = await getStreams();
            
            const authorizedLiveStreams = allStreams.filter(stream => 
                stream.status === 'online' &&
                viewerData.permissions && 
                viewerData.permissions[stream.name]?.canWatchLive
            );

            setLiveStreams(authorizedLiveStreams);

        } catch (error) {
            console.error("Fetch data error:", error);
            toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 30000); 
        return () => clearInterval(intervalId);
    }, [fetchData]);
    

    if (isLoading || !client) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
                <div className="flex items-center justify-between">
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
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">שידורים חיים</h1>
                <p className="text-muted-foreground">אלו השידורים הפעילים כעת שיש לך הרשאה לצפות בהם.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>גלריית שידורים</CardTitle>
                </CardHeader>
                <CardContent>
                    {liveStreams.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {liveStreams.map((stream) => (
                                <Card key={stream.name} className="overflow-hidden flex flex-col group text-right border-border/50 hover:border-primary transition-colors">
                                    <CardHeader className="p-0 relative">
                                        <div className="aspect-video relative overflow-hidden bg-muted">
                                            <StreamCardImage stream={stream} client={client} />
                                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                                                <Wifi className="h-3 w-3" />
                                                LIVE
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 flex-1">
                                        <CardTitle className="truncate text-lg" title={stream.name}>{stream.name}</CardTitle>
                                    </CardContent>
                                    <CardFooter className="bg-muted/50 p-2 mt-auto">
                                        <Button asChild className="w-full" variant="secondary">
                                            <Link href={`/viewer/${clientId}/streams/${encodeURIComponent(stream.name)}`}>
                                                צפה עכשיו
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-16">
                            <VideoOff className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h2 className="mt-4 text-xl font-semibold">אין שידורים חיים כרגע</h2>
                            <p className="text-muted-foreground mt-2">
                                אין כרגע שידורים פעילים שאתה מורשה לראות.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
