
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

type BroadcastLogoProps = React.HTMLAttributes<HTMLDivElement>;

const BROADCAST_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2F%D7%A2%D7%99%D7%A6%D7%95%D7%91%20%D7%9C%D7%9C%D7%90%20%D7%A9%D7%9D%20(3).png?alt=media&token=3232ec8d-011d-4cba-91a7-77322139563f";

export function BroadcastLogo({ className, ...props }: BroadcastLogoProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <Image 
        src={BROADCAST_LOGO_URL} 
        alt="Broadcast Logo" 
        fill 
        style={{ objectFit: 'contain' }} 
        unoptimized 
        priority 
        data-ai-hint="logo broadcast"
      />
    </div>
  );
}
