
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getUserById, updateUserPermissions, type User } from '@/services/users';
import type { AuthContext } from '@/services/security';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Save, ShieldCheck, Users, History, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function UserPermissionsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const userId = params.userId as string;

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Permissions state
    const [canAccessUsers, setCanAccessUsers] = useState(false);
    const [canAccessBackup, setCanAccessBackup] = useState(false);

    const auth: AuthContext = {
        userId: sessionStorage.getItem('userId') || '',
        sessionId: sessionStorage.getItem('activeSessionId') || ''
    };


    const loadUserData = useCallback(async () => {
        setIsLoading(true);
        try {
            const userData = await getUserById(userId);
            if (!userData) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'המשתמש לא נמצא.' });
                router.push('/admin/users');
                return;
            }
            if(userData.role !== 'editor') {
                 toast({ variant: 'destructive', title: 'שגיאה', description: 'ניתן לערוך הרשאות רק עבור משתמשים מסוג "עורך".' });
                 router.push('/admin/users');
                 return;
            }
            setUser(userData);
            setCanAccessUsers(userData.permissions?.canAccessUsers || false);
            setCanAccessBackup(userData.permissions?.canAccessBackup || false);

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
        } finally {
            setIsLoading(false);
        }
    }, [userId, router, toast]);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);


    const handleSaveChanges = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserPermissions(auth, user.id, {
                canAccessUsers,
                canAccessBackup,
            });
            toast({
                title: 'ההרשאות עודכנו',
                description: `ההרשאות עבור ${user.nickname} נשמרו בהצלחה.`
            });
            router.push('/admin/users');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'שגיאה בשמירת הרשאות',
                description: (error as Error).message
            });
        } finally {
            setIsSaving(false);
        }
    };


    if (isLoading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!user) {
        return <p>משתמש לא נמצא.</p>;
    }

    return (
        <div className="space-y-8 text-right">
             <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href="/admin/users">
                       <ArrowRight className="ml-2 h-4 w-4" />
                       חזרה לרשימת המשתמשים
                    </Link>
                </Button>
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold tracking-tight">הרשאות עבור: {user.nickname}</h1>
                    <p className="text-muted-foreground">
                        הענק הרשאות מיוחדות למשתמש זה.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        ניהול הרשאות
                    </CardTitle>
                    <CardDescription>
                        כברירת מחדל, ל"עורך" אין גישה לאזורים אלו. הפעלת אפשרות תעניק לו גישה מלאה לאותו אזור.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch 
                            id="access-users" 
                            checked={canAccessUsers} 
                            onCheckedChange={setCanAccessUsers} 
                            dir="ltr" 
                        />
                        <Label htmlFor="access-users" className="flex items-center gap-2 text-base">
                            <Users className="h-5 w-5" />
                            גישה לניהול משתמשים
                        </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                         <Switch 
                            id="access-backup" 
                            checked={canAccessBackup} 
                            onCheckedChange={setCanAccessBackup} 
                            dir="ltr"
                        />
                        <Label htmlFor="access-backup" className="flex items-center gap-2 text-base">
                            <History className="h-5 w-5" />
                            גישה לגיבוי ושחזור
                        </Label>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50 opacity-60">
                         <Switch disabled dir="ltr" />
                        <Label className="flex items-center gap-2 text-base text-muted-foreground">
                            גישה לכלי פיתוח (לא זמין לעורכים)
                        </Label>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-start">
                     <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        <Save className="ml-2 h-4 w-4" />
                        שמור שינויים
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
