
'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from "@/components/auth/login-form";
import { DashboardFooter } from "@/components/dashboard/footer";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

/**
 * Branded login page for the /uh route.
 * Features a grayscale theme and a specific logo.
 */
const UH_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Ff2ab28a1-9ed3-4c7c-8120-75ed9dbb5894.png?alt=media&token=a6d81473-5fa3-4869-b8d1-a6277e01033a";

export default function UhLoginPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-black text-white selection:bg-white selection:text-black relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] z-0"></div>

      <div className="w-full max-w-sm space-y-8 z-10 flex-grow flex flex-col justify-center">
        <div className="flex flex-col items-center gap-4 mb-2">
          <div className="relative w-[220px] h-[110px]">
            <Image 
              src={UH_LOGO_URL} 
              alt="UH Logo" 
              fill 
              style={{ objectFit: 'contain' }} 
              unoptimized 
              priority
            />
          </div>
          
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white/90">יחידת הרחפנים - איחוד הצלה</h2>
          </div>
          
          {showInstallBtn && (
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all animate-bounce"
              onClick={handleInstallClick}
            >
              <Download className="ml-2 h-4 w-4" />
              התקן אפליקציית UH
            </Button>
          )}
        </div>
        
        <div className="grayscale contrast-[1.1] brightness-[1.1]">
            <LoginForm showSignUp={false} />
        </div>
      </div>
      
      <div className="w-full z-10 grayscale opacity-70 hover:opacity-100 transition-opacity">
         <DashboardFooter />
      </div>
    </main>
  );
}
