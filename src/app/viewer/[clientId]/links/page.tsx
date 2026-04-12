
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { getClientById, type Client, type ClientLink } from '@/services/clients';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function ViewerLinksPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;

    const [links, setLinks] = useState<ClientLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!clientId) return;

        const loadLinksFromSession = () => {
            setIsLoading(true);
            try {
                const clientDataString = sessionStorage.getItem('clientData');
                if (clientDataString) {
                    const clientData: Client = JSON.parse(clientDataString);
                    if (clientData?.links) {
                        setLinks(clientData.links.filter(link => link.showToViewers));
                    }
                } else {
                    // Fallback if session data is missing for some reason
                    throw new Error('לא ניתן היה לטעון את פרטי הלקוח.');
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
            } finally {
                setIsLoading(false);
            }
        };

        loadLinksFromSession();
    }, [clientId, toast]);


    if (isLoading) {
        return (
            <div className="space-y-4 p-8 text-right">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8 text-right p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">לינקים שימושיים</h1>
                    <p className="text-muted-foreground">
                        קישורים מהירים ששותפו עבורך.
                    </p>
                </div>
                 <div>
                    <Button asChild variant="outline">
                        <Link href={`/viewer/${clientId}/lobby`}>
                            <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה ללובי
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {links.length > 0 ? links.map((link) => (
                    <Card key={link.id} className="text-right">
                        <CardHeader className="flex-row gap-4 items-center justify-end">
                            <div className="flex-grow text-right">
                                <CardTitle className="text-lg">{link.name}</CardTitle>
                            </div>
                            <div className="p-3 rounded-lg bg-muted">
                                <LinkIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline" className="w-full justify-end">
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    <span>פתח קישור</span>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                )) : (
                     <div className="text-center py-16 text-muted-foreground">
                        <LinkIcon className="mx-auto h-12 w-12"/>
                        <p className="mt-4 text-lg">לא סופקו קישורים חיצוניים.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
