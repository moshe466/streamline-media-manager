'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, ArrowRight, KeyRound, Server, Youtube, Facebook, Eye, EyeOff, CheckCircle2, AlertCircle, Instagram, Twitter, Send, Globe, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSystemCredentials, saveSystemCredentials } from '@/services/users';
import { checkFlussonicStatus } from '@/services/flussonic';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const GoogleIcon = (props: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.5,4.73 16.1,5.65 16.1,5.65L17.9,3.87C17.9,3.87 15.8,2 12.19,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.19,22C17.6,22 21.54,18.33 21.54,12.81C21.54,12.09 21.48,11.53 21.35,11.1Z" />
    </svg>
);

const MorningIcon = (props: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M6 12h12M6 12l-1.5-1.5M6 12l1.5 1.5M18 12l1.5-1.5M18 12l-1.5 1.5"/>
        <path d="M9 6h6M9 6L7.5 4.5M9 6l1.5 1.5M15 6l1.5-1.5M15 6l-1.5 1.5"/>
        <path d="M9 18h6M9 18L7.5 16.5M9 18l1.5 1.5M15 18l1.5-1.5M15 18l-1.5 1.5"/>
    </svg>
);

const TikTokIcon = (props: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12.528 8.001v5.25A2.25 2.25 0 0 1 10.278 15.5a2.25 2.25 0 0 1-2.25-2.25v-1.5A2.25 2.25 0 0 1 10.278 9.5h3.75"/>
        <path d="M14.028 8.001H18v5.25a2.25 0 0 1-2.25-2.25h-1.5"/>
    </svg>
);

const integrationSchema = z.object({
  flussonicServerName: z.string().optional(),
  flussonicHost: z.string().optional(),
  flussonicUsername: z.string().optional(),
  flussonicPassword: z.string().optional(),
  flussonicPublicHost: z.string().optional(),
  morningApiKey: z.string().optional(),
  morningApiSecret: z.string().optional(),
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  youtubeClientId: z.string().optional(),
  youtubeClientSecret: z.string().optional(),
  facebookClientId: z.string().optional(),
  facebookClientSecret: z.string().optional(),
  instagramClientId: z.string().optional(),
  instagramClientSecret: z.string().optional(),
  tiktokClientId: z.string().optional(),
  tiktokClientSecret: z.string().optional(),
  twitterClientId: z.string().optional(),
  twitterClientSecret: z.string().optional(),
  telegramBotToken: z.string().optional(),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;
type ServiceKey = 'flussonic' | 'morning' | 'google' | 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'telegram';

type ServiceCardProps = {
    serviceKey: ServiceKey;
    title: string;
    icon: React.ElementType;
    onOpen: () => void;
    status: 'configured' | 'unconfigured' | 'checking';
};

const ServiceCard = ({ serviceKey, title, icon: Icon, onOpen, status }: ServiceCardProps) => {
    return (
        <Card onClick={onOpen} className="hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer text-right">
            <CardHeader className="flex-row items-center justify-end gap-4 space-y-0">
                <CardTitle>{title}</CardTitle>
                <div className="p-3 bg-muted rounded-md">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                {status === 'checking' && <p className="text-xs text-muted-foreground">בודק סטטוס...</p>}
                {status === 'configured' && <div className="flex items-center gap-2 text-xs text-green-400"><CheckCircle2 className="h-4 w-4" /><span>הוגדר</span></div>}
                {status === 'unconfigured' && <div className="flex items-center gap-2 text-xs text-yellow-400"><AlertCircle className="h-4 w-4" /><span>לא הוגדר</span></div>}
            </CardContent>
        </Card>
    );
};

export default function AdminIntegrationsPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [activeDialog, setActiveDialog] = useState<ServiceKey | null>(null);
  const [formValues, setFormValues] = useState<IntegrationFormValues>({});
  
  const [flussonicStatus, setFlussonicStatus] = useState<'configured' | 'unconfigured' | 'checking'>('checking');
  const [morningStatus, setMorningStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [googleStatus, setGoogleStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [youtubeStatus, setYoutubeStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [facebookStatus, setFacebookStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [instagramStatus, setInstagramStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [tiktokStatus, setTiktokStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [twitterStatus, setTwitterStatus] = useState<'configured' | 'unconfigured'>('unconfigured');
  const [telegramStatus, setTelegramStatus] = useState<'configured' | 'unconfigured'>('unconfigured');


  const checkInitialStatus = useCallback(async (creds: IntegrationFormValues) => {
        if (creds.flussonicHost || creds.flussonicUsername) {
            const status = await checkFlussonicStatus();
            setFlussonicStatus(status.success ? 'configured' : 'unconfigured');
        } else {
            setFlussonicStatus('unconfigured');
        }
        setMorningStatus(creds.morningApiKey ? 'configured' : 'unconfigured');
        setGoogleStatus(creds.googleClientId ? 'configured' : 'unconfigured');
        setYoutubeStatus(creds.youtubeClientId ? 'configured' : 'unconfigured');
        setFacebookStatus(creds.facebookClientId ? 'configured' : 'unconfigured');
        setInstagramStatus(creds.instagramClientId ? 'configured' : 'unconfigured');
        setTiktokStatus(creds.tiktokClientId ? 'configured' : 'unconfigured');
        setTwitterStatus(creds.twitterClientId ? 'configured' : 'unconfigured');
        setTelegramStatus(creds.telegramBotToken ? 'configured' : 'unconfigured');
    }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const role = sessionStorage.getItem('userRole');
    setUserRole(role);

    if (role !== 'super-admin') {
      toast({ variant: 'destructive', title: 'אין הרשאה', description: 'דף זה זמין למנהלים ראשיים בלבד.' });
      router.push('/admin/dashboard');
      return;
    }

    try {
      const systemCreds = await getSystemCredentials();
      setFormValues(systemCreds);
      await checkInitialStatus(systemCreds);
    } catch (error) {
      console.error("Failed to load integration data", error);
      toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router, checkInitialStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleValueChange = (field: keyof IntegrationFormValues, value: string) => {
    setFormValues(prev => ({...prev, [field]: value}));
  };

  const handleSave = async (service: ServiceKey) => {
      setIsSaving(true);
      let dataToSave: Partial<IntegrationFormValues> = {};
      
      switch(service) {
        case 'flussonic':
          let host = formValues.flussonicHost || '';
          if (host && !host.startsWith('http://') && !host.startsWith('https://')) {
              host = 'http://' + host;
          }
          dataToSave = { 
              flussonicServerName: formValues.flussonicServerName, 
              flussonicHost: host, 
              flussonicUsername: formValues.flussonicUsername, 
              flussonicPassword: formValues.flussonicPassword,
              flussonicPublicHost: formValues.flussonicPublicHost
          };
          break;
        case 'morning':
          dataToSave = { morningApiKey: formValues.morningApiKey, morningApiSecret: formValues.morningApiSecret };
          break;
        case 'google':
            dataToSave = { googleClientId: formValues.googleClientId, googleClientSecret: formValues.googleClientSecret };
            break;
        case 'youtube':
            dataToSave = { youtubeClientId: formValues.youtubeClientId, youtubeClientSecret: formValues.youtubeClientSecret };
            break;
        case 'facebook':
            dataToSave = { facebookClientId: formValues.facebookClientId, facebookClientSecret: formValues.facebookClientSecret };
            break;
        case 'instagram':
            dataToSave = { instagramClientId: formValues.instagramClientId, instagramClientSecret: formValues.instagramClientSecret };
            break;
        case 'tiktok':
            dataToSave = { tiktokClientId: formValues.tiktokClientId, tiktokClientSecret: formValues.tiktokClientSecret };
            break;
        case 'twitter':
            dataToSave = { twitterClientId: formValues.twitterClientId, twitterClientSecret: formValues.twitterClientSecret };
            break;
        case 'telegram':
            dataToSave = { telegramBotToken: formValues.telegramBotToken };
            break;
      }
      
      try {
        await saveSystemCredentials(dataToSave);
        toast({ title: "ההגדרות נשמרו בהצלחה" });
        setActiveDialog(null);
        await checkInitialStatus({...formValues, ...dataToSave});
      } catch(e) {
          toast({ variant: 'destructive', title: 'שגיאה בשמירת הגדרות', description: (e as Error).message });
      } finally {
          setIsSaving(false);
      }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-8 text-right">
        <div className="flex items-center justify-between"><div><Skeleton className="h-10 w-24" /></div><div className="space-y-2 text-right"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80" /></div></div>
        <Skeleton className="w-full h-64" />
      </div>
    );
  }

  const services = [
      { key: 'flussonic' as ServiceKey, title: 'שרת Flussonic', icon: Server, status: flussonicStatus },
      { key: 'morning' as ServiceKey, title: 'מערכת חיובים (Morning)', icon: MorningIcon, status: morningStatus },
      { key: 'google' as ServiceKey, title: 'Google API (כללי)', icon: GoogleIcon, status: googleStatus },
      { key: 'youtube' as ServiceKey, title: 'YouTube API', icon: Youtube, status: youtubeStatus },
      { key: 'facebook' as ServiceKey, title: 'Facebook API', icon: Facebook, status: facebookStatus },
      { key: 'instagram' as ServiceKey, title: 'Instagram API', icon: Instagram, status: instagramStatus },
      { key: 'tiktok' as ServiceKey, title: 'TikTok API', icon: TikTokIcon, status: tiktokStatus },
      { key: 'twitter' as ServiceKey, title: 'Twitter (X) API', icon: Twitter, status: twitterStatus },
      { key: 'telegram' as ServiceKey, title: 'Telegram Bot (התראות)', icon: Send, status: telegramStatus },
  ];

  return (
    <div className="space-y-8 text-right">
      <Dialog open={!!activeDialog} onOpenChange={(isOpen) => !isOpen && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md text-right">
            {activeDialog === 'flussonic' && (
                <>
                <DialogHeader><DialogTitle>הגדרות שרת Flussonic</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label htmlFor="flussonicServerName">שם השרת (לזיהוי בלבד)</Label><Input id="flussonicServerName" value={formValues.flussonicServerName || ''} onChange={(e) => handleValueChange('flussonicServerName', e.target.value)} placeholder="לדוגמה: שרת ראשי" /></div>
                  <div className="space-y-2">
                    <Label htmlFor="flussonicHost">כתובת IP של השרת (Internal API)</Label>
                    <Input id="flussonicHost" value={formValues.flussonicHost || ''} onChange={(e) => handleValueChange('flussonicHost', e.target.value)} dir="ltr" placeholder="1.2.3.4" />
                    <p className="text-[10px] text-muted-foreground">הכתובת אליה המערכת תפנה כדי לבצע פעולות ניהול (בד"כ ה-IP הפנימי).</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flussonicPublicHost" className="flex items-center gap-2">כתובת צפייה ציבורית (Public Host) <Globe className="h-3 w-3" /></Label>
                    <Input id="flussonicPublicHost" value={formValues.flussonicPublicHost || ''} onChange={(e) => handleValueChange('flussonicPublicHost', e.target.value)} dir="ltr" placeholder="ingest.mizrachitv.co.il" />
                    <p className="text-[10px] text-muted-foreground">הכתובת שתשמש להפקת לינקים ונגני Embed עבור משתמשים. (למשל: mcr.uhdrones.org.il)</p>
                  </div>
                  <div className="space-y-2"><Label htmlFor="flussonicUsername">שם משתמש</Label><Input id="flussonicUsername" value={formValues.flussonicUsername || ''} onChange={(e) => handleValueChange('flussonicUsername', e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="flussonicPassword">סיסמה</Label><div className="relative"><Input id="flussonicPassword" type={showPassword ? 'text' : 'password'} value={formValues.flussonicPassword || ''} onChange={(e) => handleValueChange('flussonicPassword', e.target.value)} /><Button type="button" variant="ghost" size="icon" className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(prev => !prev)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
                </div>
                <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('flussonic')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                </>
            )}
            {activeDialog === 'morning' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - Morning</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="morningApiKey">מפתח API</Label><Input id="morningApiKey" dir="ltr" value={formValues.morningApiKey || ''} onChange={(e) => handleValueChange('morningApiKey', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="morningApiSecret">מפתח סודי</Label><Input id="morningApiSecret" type="password" dir="ltr" value={formValues.morningApiSecret || ''} onChange={(e) => handleValueChange('morningApiSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('morning')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'google' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - Google (כללי)</DialogTitle><DialogDescription>מפתחות אלו ישמשו עבור כל שירותי גוגל, כולל יוטיוב.</DialogDescription></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="googleClientId">Client ID</Label><Input id="googleClientId" dir="ltr" value={formValues.googleClientId || ''} onChange={(e) => handleValueChange('googleClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="googleClientSecret">Client Secret</Label><Input id="googleClientSecret" type="password" dir="ltr" value={formValues.googleClientSecret || ''} onChange={(e) => handleValueChange('googleClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('google')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'youtube' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - YouTube</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="youtubeClientId">Client ID</Label><Input id="youtubeClientId" dir="ltr" value={formValues.youtubeClientId || ''} onChange={(e) => handleValueChange('youtubeClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="youtubeClientSecret">Client Secret</Label><Input id="youtubeClientSecret" type="password" dir="ltr" value={formValues.youtubeClientSecret || ''} onChange={(e) => handleValueChange('youtubeClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('youtube')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'facebook' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - Facebook</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="facebookClientId">App ID</Label><Input id="facebookClientId" dir="ltr" value={formValues.facebookClientId || ''} onChange={(e) => handleValueChange('facebookClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="facebookClientSecret">App Secret</Label><Input id="facebookClientSecret" type="password" dir="ltr" value={formValues.facebookClientSecret || ''} onChange={(e) => handleValueChange('facebookClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('facebook')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
            {activeDialog === 'instagram' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - Instagram</DialogTitle><DialogDescription>חיבור אינסטגרם משתמש באותם מפתחות של פייסבוק.</DialogDescription></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="instagramClientId">App ID (מפייסבוק)</Label><Input id="instagramClientId" dir="ltr" value={formValues.instagramClientId || ''} onChange={(e) => handleValueChange('instagramClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="instagramClientSecret">App Secret (מפייסבוק)</Label><Input id="instagramClientSecret" type="password" dir="ltr" value={formValues.instagramClientSecret || ''} onChange={(e) => handleValueChange('instagramClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('instagram')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'tiktok' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - TikTok</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="tiktokClientId">Client Key</Label><Input id="tiktokClientId" dir="ltr" value={formValues.tiktokClientId || ''} onChange={(e) => handleValueChange('tiktokClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="tiktokClientSecret">Client Secret</Label><Input id="tiktokClientSecret" type="password" dir="ltr" value={formValues.tiktokClientSecret || ''} onChange={(e) => handleValueChange('tiktokClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('tiktok')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'twitter' && (
                 <>
                 <DialogHeader><DialogTitle>מפתחות API - Twitter (X)</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="twitterClientId">Client ID</Label><Input id="twitterClientId" dir="ltr" value={formValues.twitterClientId || ''} onChange={(e) => handleValueChange('twitterClientId', e.target.value)} /></div>
                     <div className="space-y-2"><Label htmlFor="twitterClientSecret">Client Secret</Label><Input id="twitterClientSecret" type="password" dir="ltr" value={formValues.twitterClientSecret || ''} onChange={(e) => handleValueChange('twitterClientSecret', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('twitter')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
             {activeDialog === 'telegram' && (
                 <>
                 <DialogHeader><DialogTitle>חיבור בוט לטלגרם</DialogTitle><DialogDescription>הזן כאן את הטוקן של הבוט שיצרת בטלגרם. הבוט ישמש לשליחת התראות אוטומטיות.</DialogDescription></DialogHeader>
                 <div className="space-y-4 py-4">
                     <div className="space-y-2"><Label htmlFor="telegramBotToken">Bot Token</Label><Input id="telegramBotToken" type="password" dir="ltr" value={formValues.telegramBotToken || ''} onChange={(e) => handleValueChange('telegramBotToken', e.target.value)} /></div>
                 </div>
                 <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose><Button onClick={() => handleSave('telegram')} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button></DialogFooter>
                 </>
            )}
        </DialogContent>
      </Dialog>
      
      <div className="flex items-center justify-between">
            <Button asChild variant="outline"><Link href="/admin/dashboard"><ArrowRight className="ml-2 h-4 w-4" />חזרה</Link></Button>
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">מפתחות API</h1>
                <p className="text-muted-foreground">נהל כאן את פרטי הגישה לשירותים חיצוניים.</p>
            </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map(service => (
            <ServiceCard 
                key={service.key}
                serviceKey={service.key}
                title={service.title}
                icon={service.icon}
                status={service.status}
                onOpen={() => setActiveDialog(service.key)}
            />
        ))}
      </div>
    </div>
  );
}
