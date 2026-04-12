
"use client";

import { cn } from "@/lib/utils";
import type { LucideProps } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "./ui/skeleton";
import { getClientById } from "@/services/clients";
import { useParams } from "next/navigation";

const UH_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Ff2ab28a1-9ed3-4c7c-8120-75ed9dbb5894.png?alt=media&token=a6d81473-5fa3-4869-b8d1-a6277e01033a";
const HARDCODED_MAIN_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

type LogoProps = React.HTMLAttributes<HTMLDivElement> & {
  iconProps?: LucideProps;
  clientId?: string; 
};

export function Logo({ className, ...props }: LogoProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();

  const getFallbackLogo = useCallback(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('uhdrones') || hostname.includes('school.1221.org.il')) {
        return UH_LOGO_URL;
      }
    }
    return HARDCODED_MAIN_LOGO_URL;
  }, []);

  const fetchAndSetLogo = useCallback(async () => {
    setIsLoading(true);
    let finalLogoUrl = getFallbackLogo();
    
    try {
        const userRole = sessionStorage.getItem('userRole');
        
        if (userRole === 'viewer') {
            const viewerClientId = sessionStorage.getItem('clientId') || params.clientId || props.clientId;
            if (viewerClientId && typeof viewerClientId === 'string') {
                 const clientData = await getClientById(decodeURIComponent(viewerClientId));
                 if (clientData?.customLogoUrl) {
                     finalLogoUrl = clientData.customLogoUrl;
                 }
            }
        } else if (userRole === 'client') {
            const clientDataString = sessionStorage.getItem('clientData');
            if (clientDataString) {
                const clientData = JSON.parse(clientDataString);
                if (clientData?.customLogoUrl) {
                    finalLogoUrl = clientData.customLogoUrl;
                }
            }
        }
    } catch (error) {
        console.error("Error determining logo to display:", error);
        finalLogoUrl = getFallbackLogo();
    }
    
    setLogoSrc(finalLogoUrl);
    setIsLoading(false);

  }, [params.clientId, props.clientId, getFallbackLogo]);

  useEffect(() => {
    fetchAndSetLogo();
    
    const handleDataUpdate = () => {
        fetchAndSetLogo();
    };

    window.addEventListener('clientDataUpdated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate); 

    return () => {
      window.removeEventListener('clientDataUpdated', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
    };
  }, [fetchAndSetLogo]);

  if (isLoading || !logoSrc) {
    return <Skeleton className={cn("bg-muted", className)} {...props} />;
  }
  
  return (
    <div className={cn("relative", className)} {...props}>
      <Image 
        key={logoSrc} 
        src={logoSrc} 
        alt="Company Logo" 
        fill 
        style={{ objectFit: 'contain' }} 
        unoptimized 
        priority 
        onError={() => setLogoSrc(getFallbackLogo())}
        data-ai-hint="logo"
      />
    </div>
  );
}
