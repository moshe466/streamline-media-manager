
"use client";

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Client } from "@/services/clients";
import type { Viewer } from "@/services/viewers";

interface UserNavProps {
    handleLogout: () => void;
}

export function UserNav({ handleLogout }: UserNavProps) {
    const [nickname, setNickname] = useState('טוען...');
    const [email, setEmail] = useState('טוען...');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [settingsPath, setSettingsPath] = useState('/');
    const params = useParams();

     const getInitials = (name: string) => {
        if (!name || name === 'טוען...') return '';
        const parts = name.split(' ');
        const firstInitial = parts[0]?.[0] || '';
        const lastInitial = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
        return (firstInitial + lastInitial).toUpperCase();
    }

    const updateNav = useCallback(() => {
        const storedNickname = sessionStorage.getItem('userNickname');
        const storedEmail = sessionStorage.getItem('userEmail');
        const storedRole = sessionStorage.getItem('userRole');
        const storedUserId = sessionStorage.getItem('userId');
        
        if (storedNickname) setNickname(storedNickname);
        if (storedEmail) setEmail(storedEmail);

        if (storedRole && storedUserId) {
            let image: string | null = null;
            if (storedRole === 'client') {
                 const clientDataString = sessionStorage.getItem('clientData');
                 if(clientDataString) {
                    const clientData: Client = JSON.parse(clientDataString);
                    image = clientData.profileImageUrl || null;
                 }
                setSettingsPath(`/client/${storedUserId}/settings`);

            } else if (storedRole === 'viewer') {
                const viewerDataString = sessionStorage.getItem('viewerData');
                 if(viewerDataString) {
                    const viewerData: Viewer = JSON.parse(viewerDataString);
                    image = viewerData.profileImageUrl || null;
                 }
                const clientId = params.clientId as string;
                setSettingsPath(`/viewer/${clientId}/settings`);

            } else { // Admin, editor, super-admin
                 const adminDataString = localStorage.getItem(`admin_profile_data_${storedEmail?.toLowerCase()}`);
                 if (adminDataString) {
                    image = JSON.parse(adminDataString).profileImageUrl || null;
                 }
                 setSettingsPath('/admin/settings');
            }
             setProfileImage(image);
        }
    }, [params.clientId]);


    useEffect(() => {
        updateNav();

        const handleDataUpdate = () => {
            updateNav();
        };

        // Listen for both events for robustness
        window.addEventListener('clientDataUpdated', handleDataUpdate);
        window.addEventListener('storage', handleDataUpdate);

        return () => {
            window.removeEventListener('clientDataUpdated', handleDataUpdate);
            window.removeEventListener('storage', handleDataUpdate);
        };
    }, [updateNav]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={profileImage || undefined} alt={nickname} />
                        <AvatarFallback>{getInitials(nickname)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 text-right" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{nickname}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href={settingsPath}>
                            הגדרות
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    התנתקות
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
