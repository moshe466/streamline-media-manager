
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
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
  SidebarContent,
} from '@/components/ui/sidebar';
import {
  Home,
  Users,
  Tv,
  Grid,
  Settings,
  LogOut,
  ImageIcon,
  FileText,
  History,
  Link2,
  UserCheck,
  Server,
  TestTube2,
  MailQuestion,
  UploadCloud,
  Code,
  Briefcase,
  LayoutGrid,
  KeyRound,
  Megaphone,
  Bell,
  Signal,
  RadioTower,
  Target,
} from 'lucide-react';
import Image from 'next/image';
import { Logo } from '../logo';
import { getPendingRequestsCount } from '@/services/requests';
import { Badge } from '../ui/badge';
import { getUserById, type User } from '@/services/users';

interface AdminSidebarProps {
  handleLogout: () => void;
}

export function AdminSidebar({ handleLogout }: AdminSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const fetchSidebarData = useCallback(async () => {
    try {
      const userId = sessionStorage.getItem('userId');
      if (userId) {
          const user = await getUserById(userId);
          setCurrentUser(user);
          if (user?.role === 'super-admin' || user?.role === 'admin') {
              const count = await getPendingRequestsCount();
              setPendingRequestsCount(count);
          }
      }
    } catch (error) {
      console.error("Failed to fetch sidebar data:", error);
    }
  }, []);

  useEffect(() => {
    fetchSidebarData(); 
    
    const handleSidebarUpdate = () => {
      fetchSidebarData();
    };

    window.addEventListener('sidebarDataUpdated', handleSidebarUpdate);
    const intervalId = setInterval(fetchSidebarData, 10000); 

    return () => {
      window.removeEventListener('sidebarDataUpdated', handleSidebarUpdate);
      clearInterval(intervalId);
    };
  }, [fetchSidebarData]);
  
  const allMenuItems = [
    { href: '/admin/dashboard', label: 'לוח מחוונים', icon: Home, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/live-status', label: 'סטטוס חי', icon: Signal, roles: ['super-admin', 'admin'] },
    { href: '/admin/live-broadcast', label: 'שידור חי', icon: RadioTower, roles: ['super-admin', 'admin'] },
    { href: '/admin/users', label: 'משתמשים', icon: Users, roles: ['super-admin', 'admin'], permission: 'canAccessUsers' },
    { href: '/admin/clients', label: 'לקוחות', icon: Users, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/viewers', label: 'צופים', icon: UserCheck, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/requests', label: 'בקשות גישה', icon: MailQuestion, roles: ['super-admin', 'admin'], badge: pendingRequestsCount },
    { href: '/admin/streams', label: 'שידורים', icon: Tv, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/destinations', label: 'בנק יעדים', icon: Target, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/mcr', label: 'קונטרול NCR', icon: Grid, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/multiview', label: 'Multiview', icon: LayoutGrid, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/links', label: 'קישורים מהירים', icon: Link2, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/logos', label: 'לוגואים', icon: ImageIcon, roles: ['super-admin', 'admin', 'editor'] },
    { href: '/admin/backup', label: 'גיבוי ושחזור', icon: History, roles: ['super-admin', 'admin'], permission: 'canAccessBackup' },
    { href: '/admin/whats-new', label: 'ניהול מה חדש', icon: Megaphone, roles: ['super-admin', 'admin'] },
    { href: '/admin/development', label: 'פיתוח', icon: Code, roles: ['super-admin', 'admin'] },
    { href: '/admin/telegram-logs', label: 'התראות טלגרם', icon: Bell, roles: ['super-admin', 'admin'] },
  ];

  const hasAccess = (item: typeof allMenuItems[0]) => {
      if (!currentUser) return false;
      const userRole = currentUser.role;

      if (!item.roles.includes(userRole)) {
          return false;
      }
      if (item.permission && userRole === 'editor') {
          return currentUser.permissions?.[item.permission as keyof typeof currentUser.permissions] === true;
      }
      return true;
  }

  const filteredMenuItems = allMenuItems.filter(hasAccess);


  return (
    <Sidebar side="left" className="border-r border-border/50">
      <SidebarHeader>
        <div className="flex items-center justify-center p-4">
            <Logo className="h-[75px] w-[150px]" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-4">
            {filteredMenuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                className="justify-start"
                >
                <Link href={item.href} onClick={() => setOpenMobile(false)}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.badge && item.badge > 0 && (
                        <Badge className="mr-auto bg-yellow-400 text-black hover:bg-yellow-400/80">{item.badge}</Badge>
                    )}
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            ))}
        </SidebarMenu>
       </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarSeparator />
         <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/admin/connections'} className="mt-2 justify-start">
              <Link href="/admin/connections" onClick={() => setOpenMobile(false)}>
                <Link2 className="h-5 w-5" />
                <span>חיבור לרשתות</span>
              </Link>
            </SidebarMenuButton>
         </SidebarMenuItem>
        {currentUser?.role === 'super-admin' && (
          <SidebarMenuButton asChild isActive={pathname === '/admin/integrations'} className="mt-2 justify-start">
              <Link href="/admin/integrations" onClick={() => setOpenMobile(false)}>
                <KeyRound className="h-5 w-5" />
                <span>מפתחות API</span>
              </Link>
          </SidebarMenuButton>
        )}
         <SidebarMenuButton asChild isActive={pathname === '/admin/settings'} className="mt-2 justify-start">
            <Link href="/admin/settings" onClick={() => setOpenMobile(false)}>
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
