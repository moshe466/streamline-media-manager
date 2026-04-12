
"use client";

import { useState, useEffect } from 'react';
import { getCurrentAppVersion } from '@/services/versions';
import { PlaySquare, Phone, Shield, FileText } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Logo } from '../logo';
import Link from 'next/link';


const HARDCODED_DEFAULT_FOOTER_LOGO = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

export function DashboardFooter() {
  const [logoSrc, setLogoSrc] = useState(HARDCODED_DEFAULT_FOOTER_LOGO);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Use the hardcoded URL directly
    setLogoSrc(HARDCODED_DEFAULT_FOOTER_LOGO);
    
    // Fetch the version from Firestore
    getCurrentAppVersion().then(setAppVersion);
  }, []);

  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 text-xs text-muted-foreground border-t bg-background">
       <div className="flex items-center gap-2">
         <Dialog>
           <DialogTrigger asChild>
             <Button variant="outline" size="sm">
               <Phone className="ml-2 h-4 w-4" />
               תמיכה
             </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-md text-right">
             <DialogHeader className="items-center">
               <Logo className="h-[75px] w-[150px] mb-4" />
             </DialogHeader>
             <div className="space-y-2 text-center py-4">
               <p><strong>טלפון:</strong> <a href="tel:058-5948911" className="hover:underline">058-5948911</a></p>
               <p><strong>כתובת:</strong> <a href="https://waze.com/ul?q=%D7%91%D7%A8%D7%A0%D7%A8%207%20%D7%A8%D7%97%D7%95%D7%91%D7%95%D7%AA" target="_blank" rel="noopener noreferrer" className="hover:underline">ברנר 7 רחובות</a></p>
               <p><strong>אימייל:</strong> <a href="mailto:office@mizrachitv.co.il" className="hover:underline">office@mizrachitv.co.il</a></p>
              <div className="pt-4 flex flex-col items-center">
                  <Button variant="link" asChild>
                      <Link href="/privacy-policy" target="_blank">
                          <Shield className="ml-2 h-4 w-4" />
                          מדיניות הפרטיות
                      </Link>
                  </Button>
                  <Button variant="link" asChild>
                      <Link href="/terms-of-use" target="_blank">
                          <FileText className="ml-2 h-4 w-4" />
                          תנאי שימוש
                      </Link>
                  </Button>
              </div>
             </div>
           </DialogContent>
         </Dialog>
         <Button variant="link" size="sm" asChild>
            <Link href="/privacy-policy" target="_blank">מדיניות פרטיות</Link>
         </Button>
       </div>
       
       <div className="flex items-center gap-2">
         <div className="relative h-6 w-12">
            <Image 
                src={logoSrc} 
                alt="MIZRACHI-TV Logo" 
                fill
                style={{ objectFit: 'contain' }}
                data-ai-hint="logo"
                unoptimized
            />
         </div>
         <span>
           נוצר על ידי <strong>MIZRACHI-TV</strong> | 058-5948911
         </span>
       </div>
      <p>
        {appVersion ? `גרסה ${appVersion}` : ''}
      </p>
    </footer>
  );
}
