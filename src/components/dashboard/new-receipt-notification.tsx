
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getDocuments, type MorningDocument } from '@/services/morning';
import { getClients, type Client } from '@/services/clients';
import type { AuthContext } from '@/services/security';
import { Banknote, FileCheck2, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

const SEEN_RECEIPTS_KEY = 'seenReceipts';
const POLLING_INTERVAL = 60 * 1000; // 1 minute

export function NewReceiptNotification() {
  // Return null to disable the feature temporarily to resolve a ChunkLoadError.
  return null;

  const router = useRouter();
  const [newReceipt, setNewReceipt] = useState<{ doc: MorningDocument; client: Client } | null>(null);

  const auth: AuthContext = {
    userId: sessionStorage.getItem('userId') || '',
    sessionId: sessionStorage.getItem('activeSessionId') || ''
  };

  useEffect(() => {
    let isMounted = true;

    const checkForNewReceipts = async () => {
      try {
        const clients = await getClients(auth);
        if (!clients.length) return;

        const seenReceipts = JSON.parse(sessionStorage.getItem(SEEN_RECEIPTS_KEY) || '[]');
        
        for (const client of clients) {
          if (!client.idNumber) continue;

          // Fetch only recent documents to be efficient
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
          
          const documents = await getDocuments(client.idNumber, threeDaysAgo.toISOString());
          
          const receipt = documents.find(doc => 
            (doc.type === 400 || doc.type === 320) && // Receipt or Invoice-Receipt
            !seenReceipts.includes(doc.id)
          );

          if (isMounted && receipt) {
            setNewReceipt({ doc: receipt, client });
            sessionStorage.setItem(SEEN_RECEIPTS_KEY, JSON.stringify([...seenReceipts, receipt.id]));
            // Stop checking once we find one
            return; 
          }
        }
      } catch (error) {
        console.warn("Could not check for new receipts:", error);
      }
    };

    checkForNewReceipts(); // Initial check
    const intervalId = setInterval(checkForNewReceipts, POLLING_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const handleClose = () => {
    setNewReceipt(null);
  };

  const handleGoToClient = () => {
    if (newReceipt) {
        router.push(`/admin/clients/${encodeURIComponent(newReceipt.client.id)}/billing`);
    }
    handleClose();
  };

  if (!newReceipt) {
    return null;
  }

  if (!newReceipt) return null;
  const receipt = newReceipt!
  return (
    <AlertDialog open={!!newReceipt} onOpenChange={handleClose}>
      <AlertDialogContent className="text-right">
        <AlertDialogHeader className="items-center">
            <div className="p-4 rounded-full bg-green-500/10 mb-4">
                 <FileCheck2 className="h-10 w-10 text-green-400" />
            </div>
          <AlertDialogTitle>💰 התקבלה קבלה חדשה!</AlertDialogTitle>
          <AlertDialogDescription>
            זוהתה קבלה חדשה במערכת עבור הלקוח:
            <br/>
            <strong className="text-lg text-foreground">{receipt.client.nickname}</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-center text-sm p-4 bg-muted/50 rounded-md">
            מסמך מספר {receipt.doc.id} | סך: {new Intl.NumberFormat('he-IL', { style: 'currency', currency: receipt.doc.currency }).format(receipt.doc.total)}
        </div>
        <AlertDialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleClose}>
                סגור
            </Button>
            <AlertDialogAction onClick={handleGoToClient} className="bg-primary hover:bg-primary/90">
                 צפה בחשבון הלקוח
                 <ArrowLeft className="mr-2 h-4 w-4" />
            </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
