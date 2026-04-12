
'use client';

import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Hourglass, LogOut } from 'lucide-react';

interface InactivityWarningDialogProps {
  isOpen: boolean;
  countdown: number; // in milliseconds
  onStay: () => void;
  onLogout: () => void;
}

export function InactivityWarningDialog({ 
  isOpen, 
  countdown, 
  onStay, 
  onLogout 
}: InactivityWarningDialogProps) {
  const [remainingTime, setRemainingTime] = useState(countdown);

  useEffect(() => {
    if (isOpen) {
      setRemainingTime(countdown);
      const interval = setInterval(() => {
        setRemainingTime(prevTime => {
          if (prevTime <= 1000) {
            clearInterval(interval);
            return 0;
          }
          return prevTime - 1000;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, countdown]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formattedTime = formatTime(remainingTime);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="text-right">
        <AlertDialogHeader className="items-center">
            <div className="p-4 rounded-full bg-yellow-500/10 mb-4">
                 <Hourglass className="h-10 w-10 text-yellow-400 animate-pulse" />
            </div>
            <AlertDialogTitle>התראה: התנתקות אוטומטית בעוד {formattedTime}</AlertDialogTitle>
            <AlertDialogDescription>
                זוהתה חוסר פעילות ממושכת. מטעמי אבטחה, ההתחברות תסתיים אוטומטית.
                <br/>
                לחיצה על "הישאר/י מחובר/ת" תאפס את הטיימר.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-between pt-4">
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="ml-2 h-4 w-4"/>
            התנתק/י עכשיו
          </Button>
          <Button onClick={onStay} className="bg-primary hover:bg-primary/90">
             הישאר/י מחובר/ת
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
