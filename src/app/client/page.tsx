
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is a simple redirect to the main login page
// in case someone navigates to /client without a specific ID.
export default function ClientRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null; // Render nothing as the redirect happens
}
