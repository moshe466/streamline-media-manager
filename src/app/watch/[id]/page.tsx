
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Tv, AlertTriangle } from 'lucide-react';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { getAndViewSecureLink } from '@/services/secure-links';
import { Logo } from '@/components/logo';
import { LinkViewHeartbeat } from '@/components/link-view-heartbeat';

const VideoPlayer = ({ streamName, host }: { streamName: string, host: string }) => {
    if (!host) return <div className="w-full h-full bg-black rounded-md flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
    const videoSrc = `https://${host}/${streamName}/embed.html?dvr=false&muted=true`;
    return (
        <div className="w-full h-full bg-black rounded-md overflow-hidden">
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

const StatusScreen = ({ icon: Icon, title, message, showHomeLink = false }: { icon: React.ElementType, title: string, message: string, showHomeLink?: boolean }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4 text-center">
        <Logo className="w-48 h-24 mb-8" />
        <Icon className="h-12 w-12 text-primary mb-4" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-gray-400">{message}</p>
        {showHomeLink && (
            <a href="/" className="mt-8 text-blue-400 hover:underline">חזרה לדף הבית</a>
        )}
    </div>
);

function WatchPageContent() {
    const params = useParams();
    const linkId = params.id as string;
    
    const [streamName, setStreamName] = useState<string | null>(null);
    const [publicHost, setPublicHost] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!linkId) {
            setError("מזהה קישור לא סופק.");
            setIsLoading(false);
            return;
        }

        const fetchLinkData = async () => {
            try {
                const linkData = await getAndViewSecureLink(linkId);

                if (linkData.error) {
                    setError(linkData.error);
                    setIsLoading(false);
                    return;
                }

                if (linkData.streamName) {
                    setStreamName(linkData.streamName);
                    // Fetch connection details using the instanceId stored in the link
                    // This will correctly resolve to ncr.uhdrones.org.il if instanceId is 'uh'
                    const connectionDetails = await getFlussonicConnectionDetails(linkData.instanceId);
                    setPublicHost(connectionDetails.publicHost);
                } else {
                    setError("אירעה שגיאה בטעינת נתוני הקישור.");
                }
            } catch (err) {
                console.error("Watch page error:", err);
                setError("לא ניתן היה להתחבר לשרת השידורים. ודא שהגדרות השרת תקינות.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchLinkData();
    }, [linkId]);

    if (isLoading) {
        return <StatusScreen icon={Loader2} title="טוען שידור..." message="אנא המתן מספר רגעים." />;
    }
    
    if (error) {
         return <StatusScreen icon={AlertTriangle} title="שגיאה" message={error} showHomeLink />;
    }

    if (!streamName || !publicHost) {
        return <StatusScreen icon={Tv} title="שידור לא זמין" message="השידור המבוקש אינו זמין כעת." showHomeLink />;
    }
    
    return (
        <div className="h-screen w-screen bg-black">
            <LinkViewHeartbeat linkId={linkId} />
            <VideoPlayer streamName={streamName} host={publicHost} />
        </div>
    );
}

export default function WatchPage() {
    return (
        <Suspense fallback={<StatusScreen icon={Loader2} title="טוען..." message="בודק את הקישור שלך..." />}>
            <WatchPageContent />
        </Suspense>
    );
}
