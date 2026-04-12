
"use client";

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCurrentAppVersion } from '@/services/versions';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export function VersionUpdateDialog() {
  const [showDialog, setShowDialog] = useState(false);
  const [liveVersion, setLiveVersion] = useState('');
  const params = useParams();

  useEffect(() => {
    // Guard against running on the server
    if (typeof window === 'undefined') {
        return;
    }

    const checkVersion = async () => {
        const lastVersion = localStorage.getItem('appVersion');
        const currentLiveVersion = await getCurrentAppVersion();
        
        setLiveVersion(currentLiveVersion);

        if (lastVersion && lastVersion !== currentLiveVersion) {
            setShowDialog(true);
        } else if (!lastVersion) {
            // If it's the first visit, just set the version without showing the dialog
            localStorage.setItem('appVersion', currentLiveVersion);
        }
    };
    checkVersion();
  }, []);
  
  const handleAction = (path?: string) => {
    localStorage.setItem('appVersion', liveVersion);
    if (path) {
      window.location.href = path;
    } else {
      window.location.reload();
    }
  };
  
  const getWhatsNewPath = () => {
    if (typeof window === 'undefined') return null;
    
    const isAdmin = window.location.pathname.startsWith('/admin');
    if (isAdmin) {
      return '/admin/whats-new';
    }
    const clientId = params.clientId as string;
    if (clientId) {
      return `/client/${clientId}/whats-new`;
    }
    return null;
  }

  const whatsNewPath = getWhatsNewPath();

  return (
    <AlertDialog open={showDialog}>
      <AlertDialogContent className="text-center max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>🚀 עדכון חדש זמין</AlertDialogTitle>
          <AlertDialogDescription>
            המערכת התעדכנה לגרסה חדשה עם שיפורים ותיקונים.
            <br/>
            כדי להמשיך להנות מפעולה יציבה ותקינה, יש לרענן את הדף.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center sm:gap-2">
           <AlertDialogAction onClick={() => handleAction()}>רענן עכשיו</AlertDialogAction>
           {whatsNewPath && (
             <Button onClick={() => handleAction(whatsNewPath)} variant="outline">
                <Rocket className="ml-2 h-4 w-4" />
                מה חדש?
             </Button>
           )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
