

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { Logo } from '@/components/logo';
import { handleQuestionnaireSubmission } from '@/services/auth';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { getSystemCredentials } from '@/services/users';
import { exchangeGoogleCodeForProfile } from '@/services/youtube';

const questionnaireSchema = z.object({
  firstName: z.string().min(2, "יש להזין שם פרטי"),
  lastName: z.string().min(2, "יש להזין שם משפחה"),
  email: z.string().email("כתובת אימייל לא תקינה"),
  phone: z.string().min(9, "מספר טלפון לא תקין"),
  idNumber: z.string().optional(),
  companyName: z.string().optional(),
  address: z.string().optional(),
  serviceType: z.enum(['live_streaming', 'studio', 'dvr', 'other']),
  otherServiceType: z.string().optional(),
  usageVolume: z.string().optional(),
  viewership: z.string().optional(),
  hasStudio: z.boolean().default(false),
  technicalContact: z.string().optional(),
  comments: z.string().optional(),
});

type QuestionnaireFormValues = z.infer<typeof questionnaireSchema>;

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor">
      <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.5,4.73 16.1,5.65 16.1,5.65L17.9,3.87C17.9,3.87 15.8,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.54,18.33 21.54,12.81C21.54,12.09 21.48,11.53 21.35,11.1Z" />
    </svg>
);


export default function ClientQuestionnairePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<QuestionnaireFormValues>({
    resolver: zodResolver(questionnaireSchema),
  });
  
  const serviceType = watch('serviceType');

  useEffect(() => {
    getSystemCredentials().then(creds => {
      setGoogleClientId(creds.googleClientId || creds.youtubeClientId || null);
    });

    const handleAuthMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        const { type, code, error } = event.data;
        
        if (type === 'google-questionnaire-auth' && code) {
            setIsSubmitting(true); // Show loading indicator
            const result = await exchangeGoogleCodeForProfile(code);
            if (result.success && result.profile) {
                setValue('firstName', result.profile.firstName, { shouldValidate: true });
                setValue('lastName', result.profile.lastName, { shouldValidate: true });
                setValue('email', result.profile.email, { shouldValidate: true });
                toast({ title: "הפרטים מולאו בהצלחה!", description: "אנא השלם את יתר השדות." });
            } else {
                 toast({ variant: 'destructive', title: "שגיאה בחיבור לגוגל", description: result.error });
            }
            setIsSubmitting(false);
        } else if (error) {
            toast({ variant: 'destructive', title: "שגיאת אימות", description: "תהליך האימות מול גוגל נכשל." });
        }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => {
        window.removeEventListener('message', handleAuthMessage);
    };

  }, [setValue, toast]);

  const onSubmit = async (data: QuestionnaireFormValues) => {
    setIsSubmitting(true);
    try {
        const result = await handleQuestionnaireSubmission(data);
        if (result.success && result.requestId) {
            toast({
                title: "הטופס נשלח בהצלחה!",
                description: "מיד תועבר לעמוד מעקב אחר סטטוס הבקשה שלך.",
            });
            router.push(`/questionnaire/status?reqId=${result.requestId}`);
        } else {
             toast({
                variant: "destructive",
                title: "שגיאה בשליחה",
                description: result.error || "אירעה שגיאה לא צפויה. נסה שוב מאוחר יותר.",
            });
        }
    } catch (error) {
         toast({
            variant: "destructive",
            title: "שגיאה קריטית",
            description: "לא ניתן היה לשלוח את הטופס.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!googleClientId) {
      toast({ variant: "destructive", title: "תצורה חסרה", description: "חיבור גוגל אינו מוגדר במערכת." });
      return;
    }
    
    const redirectUri = window.location.origin + '/auth/callback';
    const scopes = ['email', 'profile', 'openid'];
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', googleClientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', 'google-questionnaire-auth');
    
    const width = 600, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(url.toString(), 'GoogleAuth', `width=${width},height=${height},top=${top},left=${left}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-muted/20">
      <div className="w-full max-w-2xl mx-auto space-y-6">
         <div className="flex justify-center mb-4">
            <Logo className="w-[150px] h-[75px]" />
        </div>
        <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle>רישום לאתר</CardTitle>
              <CardDescription>
                אנא מלא את כל הפרטים כדי שנוכל להגדיר את חשבונך במערכת.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                  <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={!googleClientId}>
                    <GoogleIcon />
                    <span className="mr-2">המשך עם Google</span>
                  </Button>
                  <div className="flex items-center">
                    <Separator className="flex-1" />
                    <span className="px-4 text-muted-foreground text-sm">או</span>
                    <Separator className="flex-1" />
                  </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 mt-4">
                
                {/* Personal Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2 text-right">פרטי התקשרות</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="firstName">שם פרטי</Label><Controller name="firstName" control={control} render={({ field }) => <Input {...field} />} /><p className="text-red-500 text-sm font-semibold">{errors.firstName?.message}</p></div>
                        <div className="space-y-1"><Label htmlFor="lastName">שם משפחה</Label><Controller name="lastName" control={control} render={({ field }) => <Input {...field} />} /><p className="text-red-500 text-sm font-semibold">{errors.lastName?.message}</p></div>
                        <div className="space-y-1"><Label htmlFor="email">אימייל</Label><Controller name="email" control={control} render={({ field }) => <Input type="email" {...field} dir="ltr" />} /><p className="text-red-500 text-sm font-semibold">{errors.email?.message}</p></div>
                        <div className="space-y-1"><Label htmlFor="phone">טלפון</Label><Controller name="phone" control={control} render={({ field }) => <Input type="tel" {...field} dir="ltr" />} /><p className="text-red-500 text-sm font-semibold">{errors.phone?.message}</p></div>
                    </div>
                </div>

                 {/* Business Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2 text-right">פרטי עסק (אם רלוונטי)</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="companyName">שם העסק/החברה</Label><Controller name="companyName" control={control} render={({ field }) => <Input {...field} />} /></div>
                        <div className="space-y-1"><Label htmlFor="idNumber">ח.פ / ע.מ / ת.ז</Label><Controller name="idNumber" control={control} render={({ field }) => <Input {...field} dir="ltr" />} /></div>
                         <div className="md:col-span-2 space-y-1"><Label htmlFor="address">כתובת</Label><Controller name="address" control={control} render={({ field }) => <Input {...field} />} /></div>
                    </div>
                </div>
                
                {/* Service Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2 text-right">פרטי השירות הנדרש</h3>
                    <div className="space-y-2">
                        <Label>סוג השירות העיקרי</Label>
                        <Controller
                            name="serviceType"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-wrap gap-4 justify-end">
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="live_streaming" id="live_streaming" /><Label htmlFor="live_streaming">שידורים חיים</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="studio" id="studio" /><Label htmlFor="studio">שירותי אולפן</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="dvr" id="dvr" /><Label htmlFor="dvr">הקלטות ו-DVR</Label></div>
                                    <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="other" id="other" /><Label htmlFor="other">אחר</Label></div>
                                </RadioGroup>
                            )}
                        />
                    </div>
                    {serviceType === 'other' && (
                        <div className="space-y-1"><Label htmlFor="otherServiceType">פרט את סוג השירות</Label><Controller name="otherServiceType" control={control} render={({ field }) => <Input {...field} />} /></div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label htmlFor="usageVolume">היקף שימוש צפוי (שעות שידור בחודש)</Label><Controller name="usageVolume" control={control} render={({ field }) => <Input {...field} />} /></div>
                        <div className="space-y-1"><Label htmlFor="viewership">כמות צופים ממוצעת</Label><Controller name="viewership" control={control} render={({ field }) => <Input {...field} />} /></div>
                    </div>
                </div>

                {/* Technical Details */}
                 <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2 text-right">פרטים טכניים</h3>
                    <div className="flex items-center justify-end space-x-2 space-x-reverse">
                         <Controller
                            name="hasStudio"
                            control={control}
                            render={({ field }) => (
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    id="hasStudio"
                                />
                            )}
                        />
                        <Label htmlFor="hasStudio">האם ברשותך אולפן שידורים עצמאי?</Label>
                    </div>
                     <div className="space-y-1"><Label htmlFor="technicalContact">איש קשר טכני (אם שונה)</Label><Controller name="technicalContact" control={control} render={({ field }) => <Input {...field} placeholder="שם וטלפון"/>} /></div>
                     <div className="space-y-1"><Label htmlFor="comments">הערות נוספות</Label><Controller name="comments" control={control} render={({ field }) => <Textarea {...field} />} /></div>
                </div>

                <CardFooter className="p-0 pt-6">
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
                        שלח פרטים
                    </Button>
                </CardFooter>
              </form>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
