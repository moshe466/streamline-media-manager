"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// This page is a simple redirect to the viewer's lobby.
export default function ViewerRootPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  useEffect(() => {
    if (clientId) {
        router.replace(`/viewer/${clientId}/lobby`);
    }
  }, [router, clientId]);

  return null; // Render nothing as the redirect happens
}
