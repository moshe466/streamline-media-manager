
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Image as ImageIcon, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { uploadUserAssetAction } from "@/services/storage";

export default function ViewerSettingsPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const [nickname, setNickname] = useState('טוען...');
    const [isProcessing, setIsProcessing] = useState(false);
    const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
    const [newProfileImageFile, setNewProfileImageFile] = useState<File | null>(null);
    const viewerId = typeof window !== 'undefined' ? sessionStorage.getItem('userId') : null;

    const getInitials = (name: string) => {
        if (!name || name === 'טוען...') return '';
        const parts = name.split(' ');
        const firstInitial = parts[0]?.[0] || '';
        const lastInitial = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
        return (firstInitial + lastInitial).toUpperCase();
    }

    const updateProfileData = useCallback(() => {
        const storedNickname = sessionStorage.getItem('userNickname');
        const viewerDataString = sessionStorage.getItem('viewerData');
        
        if (storedNickname) {
            setNickname(storedNickname);
        }

        if (viewerDataString) {
            const viewerData = JSON.parse(viewerDataString);
            if (viewerData.profileImageUrl) {
                setProfileImagePreview(viewerData.profileImageUrl);
            }
        }
    }, []);


    useEffect(() => {
        updateProfileData();
        window.addEventListener('storage', updateProfileData);
        return () => window.removeEventListener('storage', updateProfileData);
    }, [updateProfileData]);

    const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setNewProfileImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setProfileImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleProfileImageUpload = async () => {
        if (!newProfileImageFile || !viewerId) return;
        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', newProfileImageFile);
            formData.append('userId', viewerId);
            formData.append('fileType', 'profile');

            const result = await uploadUserAssetAction(formData);

            if (result.success && result.updatedViewer) {
                // Update session storage immediately to reflect changes everywhere
                sessionStorage.setItem('viewerData', JSON.stringify(result.updatedViewer));
                window.dispatchEvent(new Event('storage')); // Notify other components
                setNewProfileImageFile(null);
                setProfileImagePreview(result.updatedViewer.profileImageUrl);
                toast({ title: 'תמונת הפרופיל עודכנה' });
            } else {
                throw new Error(result.error || 'Failed to upload profile picture.');
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאת תמונה', description: (e as Error).message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLogout = useCallback(() => {
        sessionStorage.clear();
        toast({
            title: "נותקת מהמערכת",
            description: "הועברת לדף הכניסה.",
        });
        router.push("/login");
    }, [router, toast]);
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">הגדרות</h1>
                <p className="text-muted-foreground">ניהול החשבון שלך.</p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>תמונת פרופיל</CardTitle>
                        <CardDescription>עדכן את תמונת הפרופיל שתוצג במערכת.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                        <Avatar className="h-24 w-24 border-2 border-primary">
                            <AvatarImage src={profileImagePreview || undefined} alt={nickname} />
                            <AvatarFallback className="text-3xl">{getInitials(nickname)}</AvatarFallback>
                        </Avatar>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" type="button">
                                <Label htmlFor="profile-image" className="cursor-pointer">
                                    <ImageIcon className="ml-2 h-4 w-4" />החלף תמונה
                                    <input id="profile-image" type="file" accept="image/png, image/jpeg" className="sr-only" onChange={handleProfileImageChange} />
                                </Label>
                            </Button>
                        </div>
                    </CardContent>
                    {newProfileImageFile && (
                        <CardFooter>
                             <Button onClick={handleProfileImageUpload} disabled={isProcessing} type="button" className="w-full">
                                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                                שמור את התמונה החדשה
                            </Button>
                        </CardFooter>
                    )}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>התנתקות</CardTitle>
                        <CardDescription>
                            לחץ על הכפתור כדי להתנתק מהמערכת.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="destructive" onClick={handleLogout}>
                            <LogOut className="ml-2 h-4 w-4" />
                            התנתק
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
