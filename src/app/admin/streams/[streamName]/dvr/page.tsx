
'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { ArrowRight, Clapperboard, Download, Info } from 'lucide-react';
import Link from 'next/link';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { useEffect, useState, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Admin DVR Page
 * Allows administrators to view historical recordings and provides info for downloading segments.
 */
export default function AdminStreamDvrPage() {
    const params = useParams();
    const streamName = decodeURIComponent(params.streamName as string);
    const [dvrEmbedUrl, setDvrEmbedUrl] = useState('');
    const [publicHost, setPublicHost] = useState('');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isMobile = useIsMobile();

    useEffect(() => {
        const setUrl = async () => {
            const { publicHost: host } = await getFlussonicConnectionDetails();
            setPublicHost(host);
            setDvrEmbedUrl(`https://${host}/${streamName}/embed.html?dvr=true`);
        };
        setUrl();
    }, [streamName]);

    // Handle orientation lock on mobile devices when entering fullscreen
    const handleFullscreenChange = () => {
        if (document.fullscreenElement === iframeRef.current) {
            try {
                if (screen.orientation && 'lock' in screen.orientation) {
                    (screen.orientation as ScreenOrientation & { lock: (orientation: string) => Promise<void> })
                        .lock('landscape')
                        .catch((err: unknown) => console.warn("Could not lock orientation:", err));
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

    if (!dvrEmbedUrl) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Clapperboard className="h-12 w-12 text-muted-foreground animate-pulse" />
                    <p className="text-lg font-medium">טוען נגן ארכיון...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-right">
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                <Button asChild variant="outline">
                    <Link href={`/admin/streams/${encodeURIComponent(streamName)}`}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לניהול השידור
                    </Link>
                </Button>

                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">ארכיון הקלטות: {streamName}</h1>
                    <p className="text-muted-foreground text-sm">ניהול וצפייה בהקלטות DVR מהשרת.</p>
                </div>
            </div>

            <Card className="overflow-hidden border-border/50">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center justify-end gap-2 text-lg">
                        נגן DVR אינטראקטיבי
                        <Clapperboard className="h-5 w-5 text-primary" />
                    </CardTitle>
                    <CardDescription>
                        ניתן לגלול אחורה בזמן באמצעות סרגל ההתקדמות בתחתית הנגן.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="aspect-video w-full bg-black relative">
                        <iframe
                            ref={iframeRef}
                            src={dvrEmbedUrl}
                            allowFullScreen
                            className="absolute inset-0 w-full h-full border-0"
                            title={`DVR Player for ${streamName}`}
                        ></iframe>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader>
                        <CardTitle className="text-blue-400 flex items-center justify-end gap-2 text-base">
                            מדריך להורדת קטעים
                            <Download className="h-5 w-5" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3 leading-relaxed">
                        <p>כדי להוריד קטע ספציפי כקובץ <b>MP4</b>, השתמש במבנה הכתובת הבא בדפדפן:</p>
                        <div className="p-3 bg-black/60 rounded-md font-mono text-[11px] dir-ltr text-left break-all text-blue-300 border border-blue-500/20">
                            https://{publicHost}/{streamName}/archive-<b>[UNIX_TIME]</b>-<b>[DURATION]</b>.mp4
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                            <li><b>UNIX_TIME:</b> זמן התחלה בשניות (Epoch)</li>
                            <li><b>DURATION:</b> אורך הקטע המבוקש בשניות</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-end gap-2 text-base">
                            מידע טכני
                            <Info className="h-5 w-5" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="font-mono">{streamName}</span>
                            <span className="text-muted-foreground">שם ערוץ:</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="font-mono" dir="ltr">{publicHost}</span>
                            <span className="text-muted-foreground">שרת מדיה:</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">פעיל</Badge>
                            <span className="text-muted-foreground">סטטוס DVR:</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
