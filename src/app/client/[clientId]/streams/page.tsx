
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { StreamActions } from '@/components/dashboard/stream-actions';

export default function ClientStreamsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [authorizedStreams, setAuthorizedStreams] = useState<FlussonicStream[]>([]);

    const fetchStreamData = useCallback(async () => {
        try {
            const clientDataString = sessionStorage.getItem('clientData');
            if (!clientDataString) {
                throw new Error("Client data not found in session. Please log in again.");
            }
            const clientData = JSON.parse(clientDataString);

            const allStreams = await getStreams();

            const streamsForClient = clientData.permissions.hasAllStreamsAccess
                ? allStreams
                : allStreams.filter((stream: FlussonicStream) => 
                    Object.keys(clientData.permissions.allowedStreams || {}).includes(stream.name)
                  );

            setAuthorizedStreams(streamsForClient);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה רשת', description: (error as Error).message });
            router.push(`/client/${clientId}/dashboard`);
        } finally {
            if (isLoading) {
                setIsLoading(false);
            }
        }
    }, [clientId, router, toast, isLoading]);

    useEffect(() => {
        if (!clientId) return;
        
        fetchStreamData();
        
        const intervalId = setInterval(fetchStreamData, 5000); 

        return () => clearInterval(intervalId);
    }, [clientId, fetchStreamData]);

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-40" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-80" />
                    </div>
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return <StreamActions streams={authorizedStreams} userType="client" clientId={clientId} />;
}
