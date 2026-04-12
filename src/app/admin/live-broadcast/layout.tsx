
'use client';

import type { ReactNode } from "react";
import { useCallback } from 'react';
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BroadcastLogo } from "@/components/broadcast-logo";

// This layout provides a "blank slate" for the broadcast lobby and stream pages,
// removing the default admin sidebar, header, and footer.
export default function BroadcastLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { toast } = useToast();

    const handleLogout = useCallback(() => {
        sessionStorage.clear();
        toast({
            title: "התנתקת מהמערכת",
            description: "הועברת לדף הכניסה.",
        });
        router.push('/live-broadcast');
    }, [router, toast]);


  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <LogOut className="ml-2 h-4 w-4" />
                        התנתקות
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="text-right">
                    <AlertDialogHeader>
                        <AlertDialogTitle>אזהרה</AlertDialogTitle>
                        <AlertDialogDescription>
                            בזמן שידור חי, לא ניתן להתנתק או לנווט מהעמוד.
                            יש להפסיק את השידור תחילה. האם אתה בטוח שברצונך להתנתק כעת?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLogout} className="bg-destructive hover:bg-destructive/90">התנתק</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <BroadcastLogo className="w-28 h-12" />
        </header>
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8">
            {children}
        </main>
    </div>
  );
}
