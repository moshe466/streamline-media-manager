

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2, Tv, AlertTriangle } from 'lucide-react';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { getAndConsumeMultiviewSettings } from '@/services/multiview-tokens';
import { type MultiviewSettings } from '@/services/users';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';

const VideoPlayer = ({ streamName, host }: { streamName: string, host: string }) => {
    if (!host) return <div className="w-full h-full bg-black rounded-md flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
    const videoSrc = `https://${host}/${streamName}/embed.html?dvr=false&realtime=true&muted=true`;
    return (
        <div className="w-full h-full bg-black rounded-sm overflow-hidden">
            <iframe
                src={videoSrc}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="autoplay"
                className="w-full h-full"
            ></iframe>
        </div>
    );
};

const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <Logo className="w-48 h-24 mb-8" />
        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
        <p className="mt-4 text-lg">אנחנו בונים עבורך את חדר הבקרה...</p>
        <p className="text-sm text-gray-400">הפעולה עשויה לקחת מספר שניות.</p>
    </div>
);

function MultiviewPlayerContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [settings, setSettings] = useState<MultiviewSettings | null>(null);
    const [publicHost, setPublicHost] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const requestId = searchParams.get('reqId');
        if (!requestId) {
            setError("מזהה בקשה לא סופק. לא ניתן לטעון את הנגן.");
            setIsLoading(false);
            return;
        }

        const pollForSettings = async () => {
            try {
                const fetchedSettings = await getAndConsumeMultiviewSettings(requestId);
                if (fetchedSettings) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    const connectionDetails = await getFlussonicConnectionDetails();
                    setSettings(fetchedSettings);
                    setPublicHost(connectionDetails.publicHost);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Polling error:", err);
                // Continue polling even on error
            }
        };

        // Start polling immediately and then every 2 seconds
        pollForSettings();
        pollingRef.current = setInterval(pollForSettings, 2000);

        // Timeout after 20 seconds
        const timeoutId = setTimeout(() => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                if (isLoading) { // Only set error if still loading
                     setError("לא ניתן היה לטעון את הגדרות הצפייה. אנא נסה שוב.");
                     setIsLoading(false);
                }
            }
        }, 20000);

        // Cleanup function
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            clearTimeout(timeoutId);
        };
    }, [searchParams, isLoading]); // Rerun only if searchParams change
    
    if (isLoading) {
        return <LoadingScreen />;
    }
    
    if (error) {
         return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <h1 className="mt-4 text-2xl font-bold">שגיאה</h1>
                <p className="mt-2 text-red-400">{error}</p>
                 <p className="text-sm text-gray-400 mt-4">אנא סגור חלון זה ונסה לפתוח אותו מחדש.</p>
            </div>
        );
    }

    if (!settings || settings.selectedStreams.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                <Tv className="h-12 w-12 text-gray-500" />
                <h1 className="mt-4 text-2xl font-bold">לא נבחרו שידורים</h1>
                 <p className="text-sm text-gray-400 mt-4">אנא סגור חלון זה וחזור לבחור שידורים בהגדרות.</p>
            </div>
        );
    }

    const gridTemplateColumns = `repeat(${settings.gridColumns}, minmax(0, 1fr))`;

    return (
        <div className="h-screen w-screen bg-black grid gap-0.5 p-0.5" style={{ gridTemplateColumns }}>
            {settings.selectedStreams.map(name => (
                 <div key={name} className="relative group bg-gray-800 rounded-sm">
                    <VideoPlayer streamName={name} host={publicHost} />
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {name}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function MultiviewPlayerPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <MultiviewPlayerContent />
        </Suspense>
    );
}
