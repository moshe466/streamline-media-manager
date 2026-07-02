"use client";

import { Toaster } from "@/components/ui/toaster";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { getInstanceByDomain } from "@/services/instances";

const UH_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Ff2ab28a1-9ed3-4c7c-8120-75ed9dbb5894.png?alt=media&token=a6d81473-5fa3-4869-b8d1-a6277e01033a";
const DEFAULT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

export function RootClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [brandName, setBrandName] = useState("Mizrachi_TV");
  const [manifestUrl, setManifestUrl] = useState("/manifest.json");
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const domain = window.location.hostname;
    const isUh = pathname.startsWith("/uh");

    if (isUh) {
      setManifestUrl("/manifest-uh.json");
      setBrandName("יחידת הרחפנים");
      setLogoUrl(UH_LOGO_URL);
    } else {
      setManifestUrl("/manifest.json");
      setBrandName("Mizrachi_TV");
      setLogoUrl(DEFAULT_LOGO_URL);
    }

    getInstanceByDomain(domain).then(instance => {
      if (instance) {
        setBrandName(instance.name);
        if (instance.logoUrl) setLogoUrl(instance.logoUrl);
      }
    });
  }, [pathname]);

  useEffect(() => {
    document.title = brandName;

    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.setAttribute("href", manifestUrl);

    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.setAttribute("href", logoUrl);
  }, [brandName, manifestUrl, logoUrl]);


  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMaintenance = async () => {
      const currentPath = window.location.pathname;

      const excluded =
        currentPath.startsWith("/admin") ||
        currentPath.startsWith("/api") ||
        currentPath.startsWith("/maintenance") ||
        currentPath.startsWith("/_next");

      if (excluded) return;

      try {
        const res = await fetch("/api/maintenance/status", { cache: "no-store" });
        const data = await res.json();

        if (data?.enabled) {
          window.location.href = "/maintenance";
        }
      } catch {}
    };

    checkMaintenance();

    const maintenanceInterval = window.setInterval(checkMaintenance, 5000);

    return () => window.clearInterval(maintenanceInterval);
  }, [pathname]);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
