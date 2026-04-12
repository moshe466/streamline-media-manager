
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ImageIcon, Upload, ArrowRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { uploadDefaultLogoAction } from '@/services/storage';

const HARDCODED_DEFAULT_SYSTEM_LOGO = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Fad8617e6-1896-4e65-816a-cf4f6327eeb2.png?alt=media&token=5b527289-88a1-42e8-b5b7-6373fdf9cd35";
const HARDCODED_DEFAULT_OFFLINE_LOGO = "https://firebasestorage.googleapis.com/v0/b/streamline-media-manager.firebasestorage.app/o/logo%2Flogo%202.jpg?alt=media&token=f2b32f64-af8f-40ce-8372-5204fcc00e40";

export default function DefaultLogosPage() {
    const { toast } = useToast();
    const [systemLogo, setSystemLogo] = useState<string>(HARDCODED_DEFAULT_SYSTEM_LOGO);
    const [offlineLogo, setOfflineLogo] = useState<string>(HARDCODED_DEFAULT_OFFLINE_LOGO);
    
    const [newSystemLogoFile, setNewSystemLogoFile] = useState<File | null>(null);
    const [newOfflineLogoFile, setNewOfflineLogoFile] = useState<File | null>(null);
    
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const userRole = sessionStorage.getItem('userRole');
        if (userRole === 'super-admin' || userRole === 'admin') {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            toast({
                variant: 'destructive',
                title: 'אין הרשאה',
                description: 'רק מנהלים יכולים לשנות את הלוגואים הראשיים.',
            });
        }
    }, [toast]);

    const handleFileChange = (type: 'system' | 'offline', event: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAuthorized) return;
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({ variant: 'destructive', title: 'קובץ גדול מדי', description: 'אנא בחר קובץ קטן מ-5MB.' });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            switch(type) {
                case 'system':
                    setNewSystemLogoFile(file);
                    setSystemLogo(base64String);
                    break;
                case 'offline':
                    setNewOfflineLogoFile(file);
                    setOfflineLogo(base64String);
                    break;
            }
        };
        reader.readAsDataURL(file);
    };
    
    const handleUpload = async (type: 'system' | 'offline') => {
        if (!isAuthorized) return;
        const fileToUpload = type === 'system' ? newSystemLogoFile : newOfflineLogoFile;
        if (!fileToUpload) {
            toast({ variant: 'destructive', title: 'לא נבחר קובץ' });
            return;
        }
        
        setIsUploading(type);
        try {
            const formData = new FormData();
            formData.append('logoFile', fileToUpload);
            formData.append('logoType', type);

            const result = await uploadDefaultLogoAction(formData);

            if (!result.success || !result.publicUrl) {
                throw new Error(result.error || 'העלאת הקובץ לשרת נכשלה.');
            }
            
            const finalUrl = `${result.publicUrl}?t=${new Date().getTime()}`;

            toast({ title: 'העלאה והגדרה הושלמו', description: `הלוגו החדש ייטען ברחבי האתר.` });
            
            if (type === 'system') {
                setNewSystemLogoFile(null);
                setSystemLogo(finalUrl);
                 // Here you would typically save this URL to a global settings document in Firestore.
                console.log("New System Logo URL:", finalUrl);
            } else {
                setNewOfflineLogoFile(null);
                setOfflineLogo(finalUrl);
                 // Here you would typically save this URL to a global settings document in Firestore.
                console.log("New Offline Logo URL:", finalUrl);
            }

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (error as Error).message });
        } finally {
            setIsUploading(null);
        }
    };


    return (
        <div className="space-y-8 text-right">
            <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href="/admin/development">
                       <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לכלי פיתוח
                    </Link>
                </Button>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">מיתוג וסמלילים</h1>
                    <p className="text-muted-foreground">הגדר את הלוגואים והאייקונים שיוצגו במערכת.</p>
                </div>
            </div>
            
             <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-end items-center gap-2">לוגו מערכת ראשי</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="w-48 h-24 flex items-center justify-center border rounded-md p-2 bg-muted/50">
                           <Image src={systemLogo} alt="לוגו מערכת" width={180} height={90} style={{ objectFit: 'contain' }} unoptimized data-ai-hint="logo"/>
                        </div>
                        <div className="flex gap-2">
                             <Button asChild variant="outline" disabled={!isAuthorized}>
                                <Label htmlFor="system-logo-upload" className={!isAuthorized ? "cursor-not-allowed" : "cursor-pointer"}>
                                  <Upload className="ml-2 h-4 w-4" />{newSystemLogoFile ? 'קובץ נבחר' : 'החלף'}
                                  <Input id="system-logo-upload" type="file" accept="image/png, image/jpeg, image/gif" className="sr-only" onChange={(e) => handleFileChange('system', e)} disabled={!isAuthorized} />
                                </Label>
                            </Button>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={() => handleUpload('system')} disabled={!isAuthorized || !newSystemLogoFile || !!isUploading} className="w-full">
                            {isUploading === 'system' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'שמור לוגו מערכת'}
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                     <CardHeader>
                        <CardTitle className="flex justify-end items-center gap-2">לוגו למצב "אופליין"</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                         <div className="w-48 h-24 flex items-center justify-center border rounded-md p-2 bg-muted/50">
                           <Image src={offlineLogo} alt="לוגו אופליין" width={180} height={90} style={{ objectFit: 'contain' }} unoptimized data-ai-hint="logo offline"/>
                        </div>
                         <div className="flex gap-2">
                            <Button asChild variant="outline" disabled={!isAuthorized}>
                                <Label htmlFor="offline-logo-upload" className={!isAuthorized ? "cursor-not-allowed" : "cursor-pointer"}>
                                  <Upload className="ml-2 h-4 w-4" />{newOfflineLogoFile ? 'קובץ נבחר' : 'החלף'}
                                  <Input id="offline-logo-upload" type="file" accept="image/png, image/jpeg, image/gif" className="sr-only" onChange={(e) => handleFileChange('offline', e)} disabled={!isAuthorized} />
                                </Label>
                            </Button>
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button onClick={() => handleUpload('offline')} disabled={!isAuthorized || !newOfflineLogoFile || !!isUploading} className="w-full">
                            {isUploading === 'offline' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'שמור לוגו אופליין'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
