
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Megaphone, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecentVersionUpdates, type VersionUpdate } from '@/services/versions';
import { format } from 'date-fns';

export default function WhatsNewClientPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [updates, setUpdates] = useState<VersionUpdate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUpdates = async () => {
            setIsLoading(true);
            const fetchedUpdates = await getRecentVersionUpdates();
            setUpdates(fetchedUpdates);
            setIsLoading(false);
        };
        fetchUpdates();
    }, []);

    return (
        <div className="space-y-8 text-right p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                 <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">מה חדש?</h1>
                    <p className="text-muted-foreground">עדכונים וחידושים במערכת מהחודש האחרון.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href={`/client/${clientId}/dashboard`}>
                        חזרה לדף הבית
                        <ArrowRight className="mr-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
            
            {isLoading ? (
                <div className="space-y-6">
                    {Array.from({length: 2}).map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                        </Card>
                    ))}
                </div>
            ) : updates.length > 0 ? (
                <div className="space-y-6">
                    {updates.map(update => (
                        <Card key={update.id} className="border-primary/20">
                            <CardHeader>
                                <div className="flex justify-between items-baseline">
                                     <h3 className="font-bold">גרסה {update.version}: {update.title}</h3>
                                    <span className="text-xs text-muted-foreground">{format(new Date(update.createdAt), 'dd/MM/yyyy')}</span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-invert prose-sm max-w-none text-right whitespace-pre-wrap text-foreground">
                                    {update.content.split('\n').map((line, index) => {
                                        const trimmedLine = line.trim();
                                        if (trimmedLine.startsWith('*') || trimmedLine.startsWith('-')) {
                                            return (
                                                <div key={index} className="flex items-start justify-end gap-2 mt-1">
                                                    <p className="m-0">{trimmedLine.substring(1).trim()}</p>
                                                    <CheckCircle className="h-4 w-4 text-green-500 mt-1 shrink-0" />
                                                </div>
                                            );
                                        }
                                        return <p key={index} className="m-0">{line}</p>;
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="flex items-center justify-center p-16 text-muted-foreground">
                        <p>אין עדכונים חדשים מהחודש האחרון.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
