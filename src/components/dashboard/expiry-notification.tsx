
'use client';

import { useState, useEffect } from 'react';
import type { Client } from '@/services/clients';
import { differenceInDays, isPast, parseISO, format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Hourglass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ExpiryNotificationProps {
    client: Client | null;
}

export function ExpiryNotification({ client }: ExpiryNotificationProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [daysLeft, setDaysLeft] = useState(0);
    const [expiryDate, setExpiryDate] = useState('');

    useEffect(() => {
        if (!client || !client.activeUntil) {
            setIsVisible(false);
            return;
        }

        const expiry = parseISO(client.activeUntil);
        const today = new Date();
        const days = differenceInDays(expiry, today);

        const shouldShow = isPast(expiry) || (days >= 0 && days <= 5);

        if (shouldShow) {
            setIsVisible(true);
            setDaysLeft(days);
            setExpiryDate(format(expiry, 'dd/MM/yyyy'));
        } else {
            setIsVisible(false);
        }

    }, [client]);

    const handleDismiss = () => {
        setIsVisible(false);
    };

    const handleRenew = () => {
        window.open('https://mrng.to/lAfc8WSZYy', '_blank');
        handleDismiss();
    };

    const getMessage = () => {
        if (isPast(parseISO(client?.activeUntil || ''))) {
            return `תוקף המנוי שלך פג בתאריך ${expiryDate}.`;
        }
        if (daysLeft === 0) {
            return 'תוקף המנוי שלך יפוג היום.';
        }
        return `תוקף המנוי שלך יפוג בעוד ${daysLeft} ימים, בתאריך ${expiryDate}.`;
    };

    if (!isVisible) {
        return null;
    }

    return (
        <Alert variant="destructive" className="mb-6 border-yellow-500/50 bg-yellow-500/10 text-yellow-300 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Hourglass className="h-5 w-5 mr-4 animate-pulse" />
                    <div className="flex-grow">
                        <AlertTitle>תזכורת: חידוש מנוי</AlertTitle>
                        <AlertDescription className="text-yellow-400/80">
                           {getMessage()} לאחר תאריך זה, החשבון יועבר למצב לא פעיל.
                           <br/>
                           במידה ובוצע תשלום יש להעלות את החשבונית לאזור <Link href={`/client/${client?.id}/uploads`} className="underline font-bold">התשלומים</Link>.
                        </AlertDescription>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <Button onClick={handleRenew} size="sm" variant="secondary" className="bg-yellow-300 text-yellow-900 hover:bg-yellow-400">
                        לחידוש המנוי
                    </Button>
                    <Button onClick={handleDismiss} variant="ghost" size="icon" className="h-6 w-6 text-yellow-300 hover:text-yellow-100">
                        <X className="h-4 w-4" />
                        <span className="sr-only">הסתר התראה</span>
                    </Button>
                </div>
            </div>
        </Alert>
    );
}
