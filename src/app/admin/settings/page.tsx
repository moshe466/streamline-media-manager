
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, User, ArrowRight, Image as ImageIcon, Upload, Trash2, KeyRound, Server } from 'lucide-react';
import { logEvent } from '@/services/logger';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateUser, getUserById, updateUserOtp, type User as AdminUser, getSystemCredentials, saveSystemCredentials } from '@/services/users';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { isEqual } from 'lodash';


const settingsSchema = z.object({
  nickname: z.string().min(2, "כינוי חייב להכיל לפחות 2 תווים."),
  superAdminPassword: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const MAX_LOGOS = 5;

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [user, setUser] = useState<AdminUser | null>(null);
  
  // State for unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // States for Profile Image & Logos
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  
  const [logoBank, setLogoBank] = useState<(string | null)[]>(Array(MAX_LOGOS).fill(null));
  const [logoAssignments, setLogoAssignments] = useState<{ system?: number; offline?: number }>({});
  
  // Store initial state for comparison
  const [initialLogoBank, setInitialLogoBank] = useState<(string | null)[]>([]);
  const [initialLogoAssignments, setInitialLogoAssignments] = useState({});


  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty: isFormDirty }
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      nickname: 'טוען...',
      superAdminPassword: '',
    }
  });
  
  const nickname = watch('nickname');

  // Check for unsaved changes whenever a relevant state updates
  useEffect(() => {
    const logosChanged = !isEqual(logoBank, initialLogoBank);
    const assignmentsChanged = !isEqual(logoAssignments, initialLogoAssignments);
    const imageChanged = !!newImageFile;

    if (isFormDirty || logosChanged || assignmentsChanged || imageChanged) {
        setHasUnsavedChanges(true);
    } else {
        setHasUnsavedChanges(false);
    }
  }, [isFormDirty, logoBank, logoAssignments, newImageFile, initialLogoBank, initialLogoAssignments]);


  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedUserId = sessionStorage.getItem('userId');
      const storedUserEmail = sessionStorage.getItem('userEmail');
      
      if (storedUserId && storedUserEmail) {
        setUserId(storedUserId);
        setUserEmail(storedUserEmail);

        const userData = await getUserById(storedUserId);
        if(userData) {
            setUser(userData);
            const storedData = localStorage.getItem(`admin_profile_data_${storedUserEmail}`);
            const parsedData = storedData ? JSON.parse(storedData) : {};
            reset({ nickname: userData.nickname || parsedData.nickname });
            setProfileImage(parsedData.profileImageUrl);
        }
      } else {
        toast({ variant: 'destructive', title: 'שגיאת אימות', description: 'לא ניתן לזהות את המשתמש.' });
        router.push('/login');
      }
      
      const loadedBank = [];
      for (let i = 0; i < MAX_LOGOS; i++) {
          loadedBank.push(localStorage.getItem(`logo_bank_${i}`));
      }
      setLogoBank(loadedBank);
      setInitialLogoBank([...loadedBank]); // Store initial state

      const assignments = localStorage.getItem('logo_assignments');
      const parsedAssignments = assignments ? JSON.parse(assignments) : {};
      setLogoAssignments(parsedAssignments);
      setInitialLogoAssignments({...parsedAssignments}); // Store initial state

    } catch (error) {
      console.error("Failed to load admin data", error);
      toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
    } finally {
      setIsLoading(false);
    }
  }, [reset, toast, router]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoFileChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
       if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ variant: 'destructive', title: 'הקובץ גדול מדי', description: 'אנא בחר קובץ קטן מ-10MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoBank(currentBank => {
          const newBank = [...currentBank];
          newBank[index] = base64String;
          return newBank;
        });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleDeleteLogo = (index: number) => {
      setLogoBank(currentBank => {
          const newBank = [...currentBank];
          newBank[index] = null;
          return newBank;
      });
      setLogoAssignments(current => {
          const newAssignments = {...current};
          if (current.system === index) delete newAssignments.system;
          if (current.offline === index) delete newAssignments.offline;
          return newAssignments;
      });
  }
  
  const handleAssignmentChange = (type: 'system' | 'offline', index: number) => {
       setLogoAssignments(current => ({ ...current, [type]: index }));
  };

  const handleResendOtp = async () => {
      if (!user || user.role === 'super-admin') return;
      setIsSaving(true);
      try {
          await updateUserOtp(user.id);
          toast({ title: 'קוד חדש נשלח', description: `קוד אימות חדש נשלח למייל שלך: ${user.email}`});
      } catch (error) {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשלוח את המייל.' });
      } finally {
          setIsSaving(false);
      }
  }

  const handleSaveChanges = async (data: SettingsFormValues) => {
    setIsSaving(true);
    
    try {
      if (newImageFile && profileImage) {
         localStorage.setItem(`admin_profile_data_${userEmail}`, JSON.stringify({ nickname: data.nickname, profileImageUrl: profileImage }));
         setNewImageFile(null);
      }

      logoBank.forEach((logoData, index) => {
          if (logoData) {
              localStorage.setItem(`logo_bank_${index}`, logoData);
          } else {
              localStorage.removeItem(`logo_bank_${index}`);
          }
      });
      localStorage.setItem('logo_assignments', JSON.stringify(logoAssignments));
      
      setInitialLogoBank([...logoBank]);
      setInitialLogoAssignments({...logoAssignments});

      if (user?.role === 'super-admin') {
          await updateUser(user.id, { nickname: data.nickname });
          await saveSystemCredentials({
            superAdminPassword: data.superAdminPassword,
          });
      } else if (userId) {
          await updateUser(userId, { nickname: data.nickname });
      }
      
      reset(data); // Resets the form's dirty state
      // Dispatch a storage event to notify other components (like the logo) of the change
      window.dispatchEvent(new Event('storage'));
      await logEvent('ADMIN_PROFILE_UPDATE', `User ${userEmail} updated their profile details and system settings.`);
      
      toast({
        title: "ההגדרות נשמרו בהצלחה",
        description: "השינויים שביצעת נשמרו.",
      });

    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת פרטים',
        description: (error as Error).message || "אירעה שגיאה לא צפויה.",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    const firstInitial = parts[0]?.[0] || '';
    const lastInitial = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
    return (firstInitial + lastInitial).toUpperCase();
  }

  if (isLoading) {
    return (
      <div className="space-y-8 text-right">
        <div className="flex items-center justify-between">
            <div><Skeleton className="h-10 w-48" /></div>
            <div className="space-y-2 text-right"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80" /></div>
        </div>
        <Skeleton className="w-full h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right">
        <div className="flex items-center justify-between">
            <div>
                <Button asChild variant="outline">
                    <Link href="/admin/dashboard">
                       <ArrowRight className="ml-2 h-4 w-4" />
                       {hasUnsavedChanges ? "חזרה (ללא שמירה)" : "חזרה"}
                    </Link>
                </Button>
            </div>
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">הגדרות</h1>
                <p className="text-muted-foreground">ערוך את פרטי הפרופיל שלך והגדרות כלליות.</p>
            </div>
        </div>

        <form onSubmit={handleSubmit(handleSaveChanges)}>
          <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        הפרופיל שלי
                        <User className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>עדכן את תמונת הפרופיל והפרטים האישיים שלך.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="h-24 w-24 border-2 border-primary">
                            <AvatarImage src={profileImage || undefined} alt={nickname} />
                            <AvatarFallback className="text-3xl">
                                {getInitials(nickname)}
                            </AvatarFallback>
                        </Avatar>
                        <Button asChild variant="outline">
                            <Label htmlFor="profile-picture">
                                שנה תמונת פרופיל
                                <input id="profile-picture" type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                            </Label>
                        </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="nickname">כינוי</Label>
                             <Controller
                                name="nickname"
                                control={control}
                                render={({ field }) => <Input id="nickname" {...field} />}
                            />
                            {errors.nickname && <p className="text-sm text-destructive">{errors.nickname.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">אימייל (לא ניתן לעריכה)</Label>
                            <Input id="email" type="email" value={userEmail} disabled />
                        </div>
                         {user?.role !== 'super-admin' && (
                            <div className="space-y-2 md:col-span-2">
                                <Label>קוד אימות</Label>
                                <div className="flex items-center gap-2">
                                <Input value={user?.otp || "לא הוגדר"} disabled/>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="secondary" disabled={isSaving}>
                                            שלח קוד חדש למייל
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="text-right">
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>לשלוח קוד אימות חדש?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            פעולה זו תשלח קוד חדש לכתובת המייל שלך ותבטל את הקוד הנוכחי. יהיה עליך להתחבר מחדש עם הקוד החדש.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResendOtp}>כן, שלח לי קוד חדש</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                 </AlertDialog>

                                </div>
                            </div>
                         )}
                         {user?.role === 'super-admin' && (
                            <div className="space-y-2">
                                <Label htmlFor="superAdminPassword">סיסמת מנהל ראשי חדשה (אופציונלי)</Label>
                                <Controller
                                    name="superAdminPassword"
                                    control={control}
                                    render={({ field }) => <Input id="superAdminPassword" type="password" placeholder="השאר ריק כדי לא לשנות" {...field} />}
                                />
                                {errors.superAdminPassword && <p className="text-sm text-destructive">{errors.superAdminPassword.message}</p>}
                            </div>
                         )}
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        בנק הלוגואים
                        <ImageIcon className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>העלה עד 5 לוגואים והקצה להם תפקידים. פורמט מומלץ: PNG, גודל עד 10MB.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                   {logoBank.map((logo, index) => (
                      <Card key={index} className="flex flex-col p-4">
                          <div className="flex-grow w-full aspect-square flex items-center justify-center border rounded-md p-2 bg-muted/50 mb-4">
                            {logo ? (
                                <img src={logo} alt={`לוגו ${index + 1}`} className="max-w-full max-h-full object-contain" />
                            ) : (
                                <div className="text-muted-foreground text-center p-2">
                                    <ImageIcon className="h-8 w-8 mx-auto mb-2"/>
                                    <span>מקום ללוגו</span>
                                </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mb-4">
                            {logo && <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteLogo(index)}><Trash2 className="ml-2 h-4 w-4"/>הסר</Button>}
                            <Button asChild type="button" size="sm" variant="outline" className="flex-1 text-center" style={{marginRight: logo ? '0.5rem': '0'}}>
                                <Label htmlFor={`logo-upload-${index}`} className="cursor-pointer">
                                  <Upload className="ml-2 h-4 w-4" />{logo ? 'החלף' : 'העלה'}
                                  <input id={`logo-upload-${index}`} type="file" accept="image/png, image/jpeg" className="sr-only" onChange={(e) => handleLogoFileChange(index, e)} />
                                </Label>
                            </Button>
                          </div>
                           {logo && (
                            <RadioGroup className="space-y-2">
                                <Label className="text-xs text-muted-foreground font-bold text-right w-full block">תפקיד הלוגו:</Label>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value={`system-${index}`} id={`system-${index}`} checked={logoAssignments.system === index} onClick={() => handleAssignmentChange('system', index)} />
                                    <Label htmlFor={`system-${index}`}>לוגו מערכת</Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                     <RadioGroupItem value={`offline-${index}`} id={`offline-${index}`} checked={logoAssignments.offline === index} onClick={() => handleAssignmentChange('offline', index)} />
                                    <Label htmlFor={`offline-${index}`}>לוגו ערוצים (אופליין)</Label>
                                </div>
                                 <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value={`none-${index}`} id={`none-${index}`} checked={logoAssignments.system !== index && logoAssignments.offline !== index} onClick={() => setLogoAssignments(c => { const n = {...c}; if(c.system === index) delete n.system; if(c.offline === index) delete n.offline; return n; })} />
                                    <Label htmlFor={`none-${index}`}>ללא</Label>
                                </div>
                            </RadioGroup>
                          )}
                      </Card>
                   ))}
                </CardContent>
            </Card>


            <div className="flex justify-start pt-4">
                <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    שמור את כל השינויים
                    <Save className="mr-2 h-4 w-4" />
                </Button>
            </div>
          </div>
        </form>
    </div>
  );
}
