'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { FlussonicStream } from '@/services/flussonic-types';
import { type Client } from '@/services/clients';

const HARDCODED_DEFAULT_OFFLINE_LOGO = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Flogo%202.jpg?alt=media&token=f2b32f64-af8f-40ce-8372-5204fcc00e40";

interface StreamCardImageProps {
  stream: FlussonicStream;
  client?: Client | null;
}

export function StreamCardImage({ stream, client }: StreamCardImageProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        const uid = sessionStorage.getItem('userId');
        const sid = sessionStorage.getItem('activeSessionId');
        const offlineLogo = client?.customOfflineLogoUrl || HARDCODED_DEFAULT_OFFLINE_LOGO;

        if (stream.status === 'online' && uid && sid) {
            // Reset error state on status change
            setLoadError(false);
            // Use the secured thumbnail proxy
            const encodedUid = encodeURIComponent(uid);
            setImageUrl(`/api/streams/${stream.name}/thumbnail?uid=${encodedUid}&sid=${sid}&t=${Date.now()}`);
        } else {
            setImageUrl(offlineLogo);
        }
    }, [stream.status, stream.name, client]);

    const handleImageError = () => {
        if (!loadError) {
            setLoadError(true);
            const offlineLogo = client?.customOfflineLogoUrl || HARDCODED_DEFAULT_OFFLINE_LOGO;
            setImageUrl(offlineLogo);
        }
    };

    if (!imageUrl) return <div className="w-full h-full bg-muted animate-pulse" />;
    
    return (
        <Image
            key={imageUrl}
            src={imageUrl}
            alt={stream.name}
            fill
            className="group-hover:scale-105 transition-transform duration-300"
            style={{objectFit: 'cover'}}
            onError={handleImageError}
            unoptimized
            priority={stream.status === 'online'}
            data-ai-hint="stream preview"
        />
    );
}
