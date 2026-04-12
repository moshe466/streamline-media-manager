
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Grid,
  LogOut,
  Settings,
  Clapperboard,
  Lock,
} from 'lucide-react';
import { Logo } from '../logo';
import { isPast, parseISO } from 'date-fns';
import { type Viewer } from '@/services/viewers';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface ViewerSidebarProps {
  handleLogout: () => void;
}

export function ViewerSidebar({ handleLogout }: ViewerSidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const { setOpenMobile } = useSidebar();
  const clientId = params.clientId as string;
  const [viewer, setViewer] = useState<Viewer | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
        const viewerDataString = sessionStorage.getItem('viewerData');
        if (viewerDataString) {
            setViewer(JSON.parse(viewerDataString));
        }
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const hasExpired = viewer?.expiresAt ? isPast(parseISO(viewer.expiresAt)) : false;

  const menuItems = [
    { href: `/viewer/${clientId}/lobby`, label: 'דף הבית', icon: Home, disabled: false },
    { href: `/viewer/${clientId}/streams`, label: 'שידורים חיים', icon: Clapperboard, disabled: hasExpired },
    { href: `/viewer/${clientId}/dvr`, label: 'ארכיון (DVR)', icon: Clapperboard, disabled: hasExpired },
  ];

  if (!viewer) {
      return (
          <Sidebar side="left" className="border-r border-border/50">
               <SidebarHeader><div className="flex items-center justify-center p-4"><Skeleton className="h-[75px] w-[150px]" /></div></SidebarHeader>
               <SidebarMenu className="flex-1 px-4"><Skeleton className="h-24 w-full" /></SidebarMenu>
               <SidebarFooter className="p-4"><Skeleton className="h-16 w-full" /></SidebarFooter>
          </Sidebar>
      )
  }

  return (
    <Sidebar side="left" className="border-r border-border/50">
      <SidebarHeader>
        <div className="flex items-center justify-center p-4">
            <Logo clientId={clientId} className="h-[75px] w-[150px]" />
        </div>
      </SidebarHeader>
      <SidebarMenu className="flex-1 px-4">
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            {item.disabled ? (
              <SidebarMenuButton
                as="div"
                isActive={false}
                className="justify-start"
                aria-disabled={true}
              >
                <Lock className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                className="justify-start"
                onClick={() => setOpenMobile(false)}
              >
                <Link href={item.href}>
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarFooter className="p-4">
        <SidebarSeparator />
         <SidebarMenuButton asChild isActive={pathname.startsWith(`/viewer/${clientId}/settings`)} className="mt-2 justify-start">
            <Link href={`/viewer/${clientId}/settings`} onClick={() => setOpenMobile(false)}>
              <Settings className="h-5 w-5" />
              <span>הגדרות</span>
            </Link>
        </SidebarMenuButton>
         <SidebarMenuButton onClick={() => { handleLogout(); setOpenMobile(false); }} className="mt-2 justify-start">
            <LogOut className="h-5 w-5" />
            <span>התנתקות</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
