
'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowRight, Clapperboard } from 'lucide-react';
import Link from 'next/link';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { useEffect, useState, useRef } from 'react';


export default function ClientStreamDvrPage() {
    const params = useParams();
    const streamName = decodeURIComponent(params.streamName as string);
    const clientId = params.clientId as string;
    const [dvrEmbedUrl, setDvrEmbedUrl] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);


    useEffect(() => {
        const setUrl = async () => {
            const { publicHost } = await getFlussonicConnectionDetails();
            setDvrEmbedUrl(`https://${publicHost}/${streamName}/embed.html?dvr=true`);
        };
        setUrl();
    }, [streamName]);

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

    const streamDetailsPath = `/client/${clientId}/streams/${encodeURIComponent(streamName)}`;

    if (!dvrEmbedUrl) {
        return <div>טוען נגן...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                     <Button asChild variant="outline">
                        <Link href={streamDetailsPath}>
                           <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה לניהול השידור
                        </Link>
                    </Button>
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">נגן DVR: {streamName}</h1>
                    <p className="text-muted-foreground">צפה בהקלטות וגלול אחורה בזמן.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        נגן עם יכולות DVR
                        <Clapperboard className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>
                        השתמש בסרגל ההתקדמות בתחתית הנגן כדי לגלול אחורה בהקלטה.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video w-full rounded-md overflow-hidden bg-black border relative">
                        <iframe
                            ref={iframeRef}
                            key={dvrEmbedUrl}
                            src={dvrEmbedUrl}
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                            style={{border: 'none'}}
                        ></iframe>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

