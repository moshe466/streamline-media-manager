
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowRight, Clapperboard, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { getViewerById } from '@/services/viewers-auth';
import { useToast } from '@/hooks/use-toast';
import { getStreamDetails, getFlussonicConnectionDetails } from '@/services/flussonic';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';


function LiveVideoPlayer({ streamName, host, iframeRef }: { streamName: string, host: string, iframeRef: React.RefObject<HTMLIFrameElement> }) {
    const videoSrc = `https://${host}/${streamName}/embed.html?dvr=false&realtime=true&muted=true`;

    return (
        <div className="w-full h-full bg-black rounded-md overflow-hidden">
            <iframe
                ref={iframeRef}
                src={videoSrc}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; encrypted-media"
                className="w-full h-full"
            ></iframe>
        </div>
    );
}

export default function ViewerStreamPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const clientId = params.clientId as string;
    const streamName = decodeURIComponent(params.streamName as string);
    const viewerId = typeof window !== 'undefined' ? sessionStorage.getItem('userId') : null;

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isStreamOnline, setIsStreamOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [publicHost, setPublicHost] = useState('');
    
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isMobile = useIsMobile();


    useEffect(() => {
        if (!viewerId) {
            toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'לא ניתן לזהות את הצופה. אנא התחבר שנית.' });
            router.push('/login');
            return;
        }

        const checkPermissionsAndStatus = async () => {
            setIsLoading(true);
            try {
                const { publicHost: host } = await getFlussonicConnectionDetails();
                setPublicHost(host);
                
                const viewerData = await getViewerById(viewerId);
                const hasPermission = viewerData?.permissions?.[streamName]?.canWatchLive ?? false;
                
                if (!hasPermission) {
                    toast({ variant: 'destructive', title: 'אין הרשאה', description: 'אין לך הרשאה לצפות בשידור זה.' });
                    router.push(`/viewer/${clientId}/lobby`);
                    return;
                }
                setIsAuthorized(true);

                const streamDetails = await getStreamDetails(streamName);
                setIsStreamOnline(streamDetails?.stats?.alive ?? false);

            } catch (error) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את פרטי השידור.' });
            } finally {
                setIsLoading(false);
            }
        };

        checkPermissionsAndStatus();

    }, [viewerId, streamName, clientId, router, toast]);

    useEffect(() => {
        if (isMobile && iframeRef.current && isStreamOnline) {
            const openFullscreen = async () => {
                try {
                    await iframeRef.current?.requestFullscreen();
                } catch (err) {
                    console.error("Fullscreen request failed:", err);
                }
            };
            const timer = setTimeout(openFullscreen, 1000);
            return () => clearTimeout(timer);
        }
    }, [isMobile, isStreamOnline]);

    const handleFullscreenChange = () => {
        if (document.fullscreenElement === iframeRef.current) {
            try {
                if (screen.orientation && 'lock' in screen.orientation) {
                    (screen.orientation as ScreenOrientation & { lock: (orientation: string) => Promise<void> })                    .lock('landscape')                    .catch((err: unknown) => console.warn("Could not lock orientation:", err));
                }
            } catch (err) {
                console.error("Error attempting to lock screen orientation:", err);
            }
        } else {
             try {
                if (screen.orientation && 'unlock' in screen.orientation) {
                    (screen.orientation as ScreenOrientation & { unlock: () => void }).unlock();
                }
            } catch (err) {
                 console.error("Error attempting to unlock screen orientation:", err);
            }
        }
    };
    
    useEffect(() => {
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const backPath = `/viewer/${clientId}/lobby`;

    if (isLoading) {
        return (
             <div className="space-y-6 text-right p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-32" />
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-4 w-80" />
                    </div>
                </div>
                <Skeleton className="w-full aspect-video" />
            </div>
        )
    }

    return (
        <div className="space-y-6 text-right p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
                <div>
                     <Button asChild variant="outline">
                        <Link href={backPath}>
                           <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה ללובי
                        </Link>
                    </Button>
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{streamName}</h1>
                    <p className="text-muted-foreground">צפייה בשידור חי</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        נגן שידור חי
                        <Clapperboard className="h-5 w-5" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video w-full rounded-md overflow-hidden bg-black border relative">
                       {isAuthorized && isStreamOnline && publicHost ? (
                           <LiveVideoPlayer streamName={streamName} host={publicHost} iframeRef={iframeRef} />
                       ) : (
                           <div className="flex flex-col items-center justify-center h-full w-full bg-black text-muted-foreground">
                             <VideoOff className="h-16 w-16" />
                             <p className="mt-4 text-lg font-semibold">השידור אינו פעיל כעת</p>
                             <p className="text-sm">אנא נסה שוב מאוחר יותר.</p>
                           </div>
                       )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
