import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootClientShell } from "@/components/root-client-shell";

const DEFAULT_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";

export const metadata: Metadata = {
  title: "Mizrachi_TV",
  description: "מערכת ניהול והזרמת מדיה רב-משתמשית.",
  openGraph: {
    title: "Mizrachi_TV",
    description: "מערכת ניהול והזרמת מדיה רב-משתמשית.",
    url: "https://app.mizrachitv.co.il",
    siteName: "Mizrachi_TV",
    images: [
      {
        url: DEFAULT_LOGO_URL,
        width: 1200,
        height: 630,
        alt: "Mizrachi_TV",
      },
    ],
    locale: "he_IL",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#020817",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href={DEFAULT_LOGO_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <RootClientShell>{children}</RootClientShell>
      </body>
    </html>
  );
}
