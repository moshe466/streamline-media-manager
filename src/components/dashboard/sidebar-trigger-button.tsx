'use client';

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * This component wraps the SidebarTrigger in a client component.
 * This is necessary because any component that uses interactivity (like a button click)
 * must be a client component in Next.js App Router. This keeps server components clean.
 */
export function SidebarTriggerButton() {
    return <SidebarTrigger />;
}
