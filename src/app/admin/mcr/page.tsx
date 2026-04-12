
'use client';

import { useState, useEffect } from 'react';
import { getStreams, type FlussonicStream } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { McrGrid } from '@/components/dashboard/mcr-grid';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminMcrPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [streams, setStreams] = useState<FlussonicStream[]>([]);

  useEffect(() => {
    const fetchAllStreams = async () => {
      setIsLoading(true);
      try {
        const allStreams = await getStreams();
        setStreams(allStreams);
      } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'לא ניתן היה לטעון את רשימת השידורים.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllStreams();
  }, [toast]);

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
                {Array.from({ length: 12 }).map((_, i) => (
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
            <div></div>
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">קונטרול NCR - מנהל</h1>
                <p className="text-muted-foreground">
                    תצוגה חיה של כל השידורים במערכת.
                </p>
            </div>
        </div>
      
      <McrGrid streams={streams} />
    </div>
  );
}
