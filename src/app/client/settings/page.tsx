
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, Image as ImageIcon, Trash2, Save, Loader2, Upload } from 'lucide-react';
import { type Client, updateClientDetails } from '@/services/clients';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadUserAssetAction, deleteFileAction } from '@/services/storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import NextImage from 'next/image';


const settingsSchema = z.object({
  firstName: z.string().min(2, "שם פרטי חייב להכיל לפחות 2 תווים."),
  lastName: z.string().min(2, "שם משפחה חייב להכיל לפחות 2 תווים."),
  nickname: z.string().min(2, "כינוי חייב להכיל לפחות 2 תווים."),
  phone: z.string().min(9, "מספר טלפון לא תקין."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function ClientSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // State for profile picture
    const [isProcessingAsset, setIsProcessingAsset] = useState<'profile' | 'logo' | null>(null);
    const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
    const [newProfileImageFile, setNewProfileImageFile] = useState<File | null>(null);
    
    // State for custom logo
    const [logoImagePreview, setLogoImagePreview] = useState<string | null>(null);
    const [newLogoImageFile, setNewLogoImageFile] = useState<File | null>(null);


    const {
        control,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: { firstName: '', lastName: '', nickname: '', phone: '' },
    });
    
    const getInitials = (name: string) => {
        if (!name) return '?';
        const parts = name.split(' ');
        const firstInitial = parts[0]?.[0] || '';
        const lastInitial = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
        return (firstInitial + lastInitial).toUpperCase();
    }

    useEffect(() => {
        const clientDataString = sessionStorage.getItem('clientData');
        if (clientDataString) {
            const clientData: Client = JSON.parse(clientDataString);
            setClient(clientData);
            reset({
                firstName: clientData.firstName,
                lastName: clientData.lastName,
                nickname: clientData.nickname,
                phone: clientData.phone,
            });
            if (clientData.profileImageUrl) setProfileImagePreview(clientData.profileImageUrl);
            if (clientData.customLogoUrl) setLogoImagePreview(clientData.customLogoUrl);

        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את פרטי הלקוח.' });
            router.push(`/client/${clientId}/dashboard`);
        }
        setIsLoading(false);
    }, [clientId, router, toast, reset]);


    const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setNewProfileImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setProfileImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const handleLogoImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setNewLogoImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
  
    const handleAssetUpload = async (fileType: 'profile' | 'logo') => {
        const fileToUpload = fileType === 'profile' ? newProfileImageFile : newLogoImageFile;
        if (!fileToUpload || !client) return;

        setIsProcessingAsset(fileType);
        try {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            formData.append('userId', client.id);
            formData.append('fileType', fileType);

            const result = await uploadUserAssetAction(formData);

            if (result.success && result.updatedClient) {
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
                window.dispatchEvent(new Event('clientDataUpdated'));
                setClient(result.updatedClient);
                 if (fileType === 'profile') {
                    setNewProfileImageFile(null);
                    setProfileImagePreview(result.updatedClient.profileImageUrl);
                } else {
                    setNewLogoImageFile(null);
                    setLogoImagePreview(result.updatedClient.customLogoUrl);
                }
                toast({ title: 'הקובץ עודכן בהצלחה' });
            } else {
                 throw new Error(result.error || 'Failed to upload asset.');
            }
        } catch(e) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (e as Error).message });
        } finally {
            setIsProcessingAsset(null);
        }
    };

    const handleDeleteLogo = async () => {
        if (!client || !client.customLogoUrl) return;

        setIsProcessingAsset('logo');
        try {
            const result = await updateClientDetails(client.id, { customLogoUrl: null });
            
            // This is a "fire and forget" operation for cleanup, we don't block on it.
            const urlPath = new URL(client.customLogoUrl).pathname;
            const fullPath = decodeURIComponent(urlPath.substring(urlPath.indexOf('/', 1) + 1));
            deleteFileAction(fullPath).catch(console.warn);

            sessionStorage.setItem('clientData', JSON.stringify(result));
            window.dispatchEvent(new Event('clientDataUpdated'));
            setClient(result);
            setLogoImagePreview(null);
            setNewLogoImageFile(null);
            toast({ title: 'הלוגו הוסר בהצלחה', variant: 'destructive' });

        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה בהסרת לוגו', description: (e as Error).message });
        } finally {
            setIsProcessingAsset(null);
        }
    };


    const handleSaveChanges = async (data: SettingsFormValues) => {
        if (!client) return;
        setIsSaving(true);
        try {
            const updatedClient = await updateClientDetails(client.id, data);
            sessionStorage.setItem('userNickname', data.nickname);
            sessionStorage.setItem('clientData', JSON.stringify(updatedClient));
            window.dispatchEvent(new Event('clientDataUpdated'));
            setClient(updatedClient);
            toast({ title: "הפרטים עודכנו בהצלחה" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בשמירת פרטים', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };
  
    if (isLoading || !client) {
        return <div className="p-8"><Skeleton className="w-full h-96" /></div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 text-right">
            <div className="flex items-center justify-between">
                <div><Button asChild variant="outline"><Link href={`/client/${clientId}/dashboard`}><ArrowRight className="ml-2 h-4 w-4" />חזרה לדשבורד</Link></Button></div>
                <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">הגדרות חשבון</h1><p className="text-muted-foreground">ערוך את פרטי הפרופיל, תמונה ולוגו.</p></div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-end gap-2">לוגו מותאם אישית<ImageIcon className="h-5 w-5" /></CardTitle>
                        <CardDescription>העלה לוגו שיוצג לך ולצופים שלך במקום הלוגו הראשי.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4">
                        <div className="w-48 h-24 flex items-center justify-center border rounded-md p-2 bg-muted/50">
                            {logoImagePreview ? (
                               <NextImage src={logoImagePreview} alt="תצוגת לוגו" width={180} height={90} style={{ objectFit: 'contain' }} unoptimized data-ai-hint="logo"/>
                            ) : (
                               <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto h-8 w-8" /><p className="text-xs mt-1">אין לוגו מותאם</p></div>
                            )}
                        </div>
                         <div className="flex gap-2">
                             <Button asChild variant="outline" type="button">
                                <Label htmlFor="logo-image" className="cursor-pointer">
                                    <Upload className="ml-2 h-4 w-4" />{logoImagePreview ? 'החלף' : 'העלה לוגו'}
                                    <input id="logo-image" type="file" accept="image/png, image/jpeg" className="sr-only" onChange={handleLogoImageChange} />
                                </Label>
                            </Button>
                            {newLogoImageFile && (
                                <Button onClick={() => handleAssetUpload('logo')} disabled={isProcessingAsset === 'logo'} type="button">
                                    {isProcessingAsset === 'logo' ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}שמור לוגו
                                </Button>
                            )}
                        </div>
                    </CardContent>
                    {logoImagePreview && (
                         <CardFooter>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" type="button" disabled={isProcessingAsset === 'logo'}>
                                        <Trash2 className="ml-2 h-4 w-4" />הסר לוגו מותאם
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="text-right">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>האם להסיר את הלוגו?</AlertDialogTitle>
                                        <AlertDialogDescription>פעולה זו תמחק את הלוגו המותאם והמערכת תחזור להציג את הלוגו הראשי. ניתן להעלות לוגו חדש בכל עת.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={handleDeleteLogo} className="bg-destructive hover:bg-destructive/90">כן, הסר</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
                        </CardFooter>
                    )}
                </Card>

                <form onSubmit={handleSubmit(handleSaveChanges)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-end gap-2">הפרופיל שלי<User className="h-5 w-5" /></CardTitle>
                             <CardDescription>עדכן את תמונת הפרופיל והפרטים האישיים שלך.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <Avatar className="h-24 w-24 border-2 border-primary">
                                    <AvatarImage src={profileImagePreview || undefined} alt={client.nickname} />
                                    <AvatarFallback className="text-3xl">{getInitials(client.nickname)}</AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                     <Button asChild variant="outline" type="button">
                                        <Label htmlFor="profile-image" className="cursor-pointer">
                                            <Upload className="ml-2 h-4 w-4" />החלף תמונה
                                            <input id="profile-image" type="file" accept="image/png, image/jpeg" className="sr-only" onChange={handleProfileImageChange} />
                                        </Label>
                                    </Button>
                                    {newProfileImageFile && (
                                        <Button onClick={() => handleAssetUpload('profile')} disabled={isProcessingAsset === 'profile'} type="button">
                                            {isProcessingAsset === 'profile' ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}שמור תמונה
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-2"><Label htmlFor="firstName">שם פרטי</Label><Controller name="firstName" control={control} render={({ field }) => <Input id="firstName" {...field} />} /><p className="text-sm text-destructive">{errors.firstName?.message}</p></div>
                                <div className="space-y-2"><Label htmlFor="lastName">שם משפחה</Label><Controller name="lastName" control={control} render={({ field }) => <Input id="lastName" {...field} />} /><p className="text-sm text-destructive">{errors.lastName?.message}</p></div>
                                <div className="space-y-2"><Label htmlFor="nickname">כינוי</Label><Controller name="nickname" control={control} render={({ field }) => <Input id="nickname" {...field} />} /><p className="text-sm text-destructive">{errors.nickname?.message}</p></div>
                                <div className="space-y-2"><Label htmlFor="phone">טלפון</Label><Controller name="phone" control={control} render={({ field }) => <Input id="phone" type="tel" {...field} />} /><p className="text-sm text-destructive">{errors.phone?.message}</p></div>
                                <div className="space-y-2 md:col-span-2"><Label htmlFor="email">אימייל (לא ניתן לעריכה)</Label><Input id="email" type="email" value={client?.email || ''} disabled /></div>
                            </div>
                        </CardContent>
                         <CardFooter className="justify-start"><Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}שמור פרטים אישיים</Button></CardFooter>
                    </Card>
                </form>
            </div>
        </div>
    );
}
