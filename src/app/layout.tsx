"use client";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { getInstanceByDomain } from '@/services/instances';

const UH_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Ff2ab28a1-9ed3-4c7c-8120-75ed9dbb5894.png?alt=media&token=a6d81473-5fa3-4869-b8d1-a6277e01033a";
const DEFAULT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [brandName, setBrandName] = useState('Mizrachi_TV');
  const [manifestUrl, setManifestUrl] = useState('/manifest.json');
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    const domain = window.location.hostname;
    const isUh = pathname.startsWith('/uh');

    // Set manifest and basic branding based on path
    if (isUh) {
      setManifestUrl('/manifest-uh.json');
      setBrandName('יחידת הרחפנים');
      setLogoUrl(UH_LOGO_URL);
    } else {
      setManifestUrl('/manifest.json');
      setBrandName('Mizrachi_TV');
      setLogoUrl(DEFAULT_LOGO_URL);
    }

    // Fetch dynamic branding based on domain
    getInstanceByDomain(domain).then(instance => {
      if (instance) {
        setBrandName(instance.name);
        if (instance.logoUrl) setLogoUrl(instance.logoUrl);
      }
    });
  }, [pathname]);

  useEffect(() => {
    document.title = brandName;
  }, [brandName]);

  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        <title>{brandName}</title>
        <meta name="description" content="מערכת ניהול והזרמת מדיה רב-משתמשית."/>
        <link rel="manifest" href={manifestUrl} />
        <link rel="icon" href={logoUrl} />
        <meta name="theme-color" content="#020817" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
