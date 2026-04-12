'use client';

import Image from 'next/image';
import { VideoOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type StreamPreviewImageProps = {
  streamName: string;
  isStreamOnline: boolean;
};

export function StreamPreviewImage({ streamName, isStreamOnline }: StreamPreviewImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isStreamOnline) {
        const uid = sessionStorage.getItem('userId');
        const sid = sessionStorage.getItem('activeSessionId');
        if (uid && sid) {
            setLoadError(false);
            const encodedUid = encodeURIComponent(uid);
            setImageUrl(`/api/streams/${streamName}/thumbnail?uid=${encodedUid}&sid=${sid}&t=${Date.now()}`);
        }
    } else {
        setImageUrl(null);
    }
  }, [isStreamOnline, streamName]);

  if (!isStreamOnline || loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-black text-muted-foreground">
        <VideoOff className="h-16 w-16" />
        <p className="mt-4 text-lg font-semibold">השידור אינו פעיל</p>
      </div>
    );
  }
  
  if (!imageUrl) {
      return (
        <div className="flex items-center justify-center h-full w-full bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="relative w-full h-full">
        <Image
            src={imageUrl}
            alt={`תצוגה מקדימה של ${streamName}`}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized 
            onError={() => setLoadError(true)}
            data-ai-hint="live stream broadcast"
        />
    </div>
  );
}
