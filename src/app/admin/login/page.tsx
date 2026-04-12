"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is a simple redirect to the main login page.
// It exists to catch any old links that might point to /admin/login.
export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null; // Render nothing as the redirect happens
}
