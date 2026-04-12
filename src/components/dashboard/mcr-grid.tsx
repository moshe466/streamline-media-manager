

'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VideoOff, Search, Wifi, WifiOff, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlussonicStream } from '@/services/flussonic';
import { getFlussonicConnectionDetails } from '@/services/flussonic';

const VideoPlayer = ({ streamName, host }: { streamName: string, host: string }) => {
    if (!host) return <div className="w-full h-full bg-black rounded-md flex items-center justify-center"><p className="text-xs text-muted-foreground">טוען...</p></div>;
    const videoSrc = `https://${host}/${streamName}/embed.html?dvr=false&realtime=true&muted=true`;

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

export function McrGrid({ streams }: { streams: FlussonicStream[] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('online');
    const [publicHost, setPublicHost] = useState('');

    useEffect(() => {
        getFlussonicConnectionDetails().then(details => setPublicHost(details.publicHost));
    }, []);

    const filteredStreams = useMemo(() => {
        return streams.filter(stream => {
            const statusMatch = statusFilter === 'all' || stream.status === statusFilter;
            const searchMatch = !searchQuery || stream.name.toLowerCase().includes(searchQuery.toLowerCase());
            return statusMatch && searchMatch;
        });
    }, [streams, searchQuery, statusFilter]);
    
    const onlineCount = useMemo(() => streams.filter(s => s.status === 'online').length, [streams]);
    const offlineCount = useMemo(() => streams.filter(s => s.status === 'offline').length, [streams]);

    return (
        <div className="flex-1 flex flex-col h-full">
             <Card className="mb-6">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
                        <div className="flex justify-end items-center gap-2 flex-wrap">
                            <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
                                <span className="bg-primary-foreground text-primary rounded-full px-2 py-0.5 text-xs ml-2">{streams.length}</span>
                                הכל
                                <List className="mr-2 h-4 w-4" />
                            </Button>
                            <Button variant={statusFilter === 'online' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('online')}>
                                <span className="bg-green-600 text-primary-foreground rounded-full px-2 py-0.5 text-xs ml-2">{onlineCount}</span>
                                פעילים
                                <Wifi className="mr-2 h-4 w-4" />
                            </Button>
                             <Button variant={statusFilter === 'offline' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('offline')}>
                                <span className="bg-destructive/80 text-destructive-foreground rounded-full px-2 py-0.5 text-xs ml-2">{offlineCount}</span>
                                לא פעילים
                                <WifiOff className="mr-2 h-4 w-4" />
                            </Button>
                        </div>
                        <div className="relative w-full sm:max-w-xs">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="חיפוש לפי שם שידור..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {filteredStreams.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto flex-1">
                    {filteredStreams.map(stream => (
                        <Card key={stream.name} className="flex flex-col aspect-video bg-card">
                            <CardHeader className="p-2 border-b">
                                <CardTitle className="text-sm font-medium truncate flex justify-between items-center" title={stream.name}>
                                    <span>{stream.name}</span>
                                    <span className={cn("h-2.5 w-2.5 rounded-full", stream.status === 'online' ? 'bg-green-500' : 'bg-red-500')}></span>
                                </CardTitle>
                            </CardHeader>
                             <CardContent className="flex-1 p-0 flex items-center justify-center">
                                {stream.status === 'online' && publicHost ? (
                                    <VideoPlayer streamName={stream.name} host={publicHost} />
                                ) : (
                                    <div className="text-muted-foreground text-center">
                                        <VideoOff className="h-8 w-8 mx-auto" />
                                        <p className="text-sm mt-2">השידור אינו פעיל</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                 <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <VideoOff className="mx-auto h-12 w-12" />
                        <h2 className="mt-4 text-xl font-semibold">לא נמצאו שידורים</h2>
                        <p className="mt-2 text-sm">
                           {searchQuery ? `לא נמצאו תוצאות לחיפוש "${searchQuery}"` : "לא נמצאו שידורים התואמים את הסינון הנוכחי."}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
