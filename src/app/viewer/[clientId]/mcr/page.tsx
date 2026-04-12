
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getViewerById } from '@/services/viewers-auth';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { McrGrid } from '@/components/dashboard/mcr-grid';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ViewerMcrPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [authorizedStreams, setAuthorizedStreams] = useState<FlussonicStream[]>([]);

  useEffect(() => {
    const viewerId = sessionStorage.getItem('userId');
    if (!viewerId) {
        toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'לא ניתן לזהות את הצופה. אנא התחבר שנית.' });
        router.push('/login');
        return;
    }

    const fetchMcrData = async () => {
      setIsLoading(true);
      try {
        const viewerData = await getViewerById(viewerId);
        if (!viewerData || viewerData.clientId !== clientId) {
          throw new Error('Viewer not found or does not belong to this client.');
        }

        const streamsWithMcrPerms = Object.entries(viewerData.permissions || {})
          .filter(([_, perms]) => perms.canWatchMCR)
          .map(([streamName, _]) => streamName);

        if (streamsWithMcrPerms.length > 0) {
            const allStreams = await getStreams();
            const streamsForViewer = allStreams.filter(stream =>
                streamsWithMcrPerms.includes(stream.name)
            );
            setAuthorizedStreams(streamsForViewer);
        }

      } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'לא ניתן היה לטעון את רשימת השידורים.' });
        router.push(`/viewer/${clientId}/lobby`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMcrData();
  }, [clientId, router, toast]);

  if (isLoading) {
    return (
        <div className="space-y-8 text-right p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
                <div></div>
                <div className="space-y-2 text-right">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-4 w-80" />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                   <div key={i} className="aspect-video">
                     <Skeleton className="w-full h-full" />
                   </div>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-8 text-right p-4 sm:p-6 lg:p-8 h-full flex flex-col">
       <div className="flex items-center justify-between">
            <div>
                 <Button asChild variant="outline">
                    <Link href={`/viewer/${clientId}/lobby`}>
                       <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה ללובי
                    </Link>
                </Button>
            </div>
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">קונטרול NCR</h1>
                <p className="text-muted-foreground">
                    תצוגה חיה של השידורים המורשים לך.
                </p>
            </div>
        </div>
      
      <McrGrid streams={authorizedStreams} />
    </div>
  );
}
