
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserNav } from './user-nav';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ArrowRight, Headphones, Languages } from 'lucide-react';
import { SidebarTriggerButton } from './sidebar-trigger-button';
import { ClientTour } from './client-tour';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"


interface DashboardHeaderProps {
    userType: 'admin' | 'client' | 'viewer';
    handleLogout: () => void;
}

const BackButton = () => {
    const pathname = usePathname();
    
    // Regular expressions to match dynamic stream detail pages
    const adminStreamRegex = /^\/admin\/streams\/[^/]+(\/.*)?$/;
    const clientStreamRegex = /^\/client\/[^/]+\/streams\/[^/]+(\/.*)?$/;

    if (adminStreamRegex.test(pathname)) {
        return (
            <Button asChild variant="outline" size="sm">
                <Link href="/admin/streams">
                    <span className="flex items-center">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לכל השידורים
                    </span>
                </Link>
            </Button>
        );
    }
    
    if (clientStreamRegex.test(pathname)) {
        const clientId = pathname.split('/')[2];
        return (
             <Button asChild variant="outline" size="sm">
                <Link href={`/client/${clientId}/streams`}>
                     <span className="flex items-center">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לכל השידורים
                    </span>
                </Link>
            </Button>
        );
    }

    return null;
}


export function DashboardHeader({ userType, handleLogout }: DashboardHeaderProps) {
    const { isMobile } = useSidebar();

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-md">
             <div className="flex items-center gap-4">
                 {isMobile ? <SidebarTriggerButton /> : <BackButton />}
                 {userType === 'client' && <ClientTour />}
             </div>
             <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Languages className="h-5 w-5" />
                            <span className="sr-only">Change language</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            עברית
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            אנגלית
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <UserNav handleLogout={handleLogout} />
             </div>
        </header>
    );
}
