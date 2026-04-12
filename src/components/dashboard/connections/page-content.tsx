

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Youtube, Facebook, CheckCircle2, AlertTriangle, LinkIcon, Save, Loader2, Instagram, Twitter, Send, LogOut, FileText } from "lucide-react";
import Link from 'next/link';
import { getSystemCredentials, disconnectSocialPlatform } from '@/services/users';
import { listChannels, saveSelectedChannel, type YouTubeChannel } from '@/services/youtube';
import { exchangeCodeForToken as exchangeFacebookCode } from '@/services/facebook';
import { buildTikTokAuthorizeUrl, exchangeCodeForToken as exchangeTikTokCode } from '@/services/tiktok';
import { exchangeCodeForToken as exchangeTwitterCode } from '@/services/twitter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getRedirectUri } from '@/services/social.config';


// Placeholder for TikTok icon
const TikTokIcon = (props: React.ComponentProps<'svg'>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12.528 8.001v5.25A2.25 2.25 0 0 1 10.278 15.5a2.25 2.25 0 0 1-2.25-2.25v-1.5A2.25 2.25 0 0 1 10.278 9.5h3.75"/>
        <path d="M14.028 8.001H18v5.25a2.25 0 0 1-2.25-2.25h-1.5"/>
    </svg>
);


export type SocialPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter' | 'telegram';

const socialPlatforms: { id: SocialPlatform; name: string; icon: React.ElementType; available: boolean; description: string; }[] = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, available: true, description: 'שידור חי ישיר לערוץ' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, available: true, description: 'שידור חי לדפים וקבוצות' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, available: true, description: 'שידור חי וסטוריז' },
    { id: 'tiktok', name: 'TikTok', icon: TikTokIcon, available: true, description: 'שידור חי ישיר' },
    { id: 'twitter', name: 'Twitter (X)', icon: Twitter, available: true, description: 'שידור חי ישיר' },
    { id: 'telegram', name: 'בוט התראות טלגרם', icon: Send, available: true, description: 'שליחת הודעות אוטומטיות' },
];

export function ConnectionsPageContent() {
    const router = useRouter();
    const { toast } = useToast();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activeDialog, setActiveDialog] = useState<SocialPlatform | null>(null);

    // YouTube State
    const [youtubeStatus, setYoutubeStatus] = useState<'success' | 'error' | null>(null);
    const [youtubeAuthUrl, setYoutubeAuthUrl] = useState<string>('');
    const [channels, setChannels] = useState<YouTubeChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<string | undefined>();
    const [savedChannelId, setSavedChannelId] = useState<string | undefined>();
    const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
    const [isSavingYouTube, setIsSavingYouTube] = useState(false);
    
    // Facebook State
    const [facebookStatus, setFacebookStatus] = useState<'success' | 'error' | null>(null);
    const [facebookAuthUrl, setFacebookAuthUrl] = useState<string>('');
    const [isLoadingFacebook, setIsLoadingFacebook] = useState(false);

    // TikTok State
    const [tiktokStatus, setTiktokStatus] = useState<'success' | 'error' | null>(null);
    const [tiktokAuthUrl, setTiktokAuthUrl] = useState<string>('');
    const [isLoadingTikTok, setIsLoadingTikTok] = useState(false);

    // Instagram State
    const [instagramStatus, setInstagramStatus] = useState<'success' | 'error' | null>(null);
    const [instagramAuthUrl, setInstagramAuthUrl] = useState<string>('');
    const [isLoadingInstagram, setIsLoadingInstagram] = useState(false);

    // Twitter State
    const [twitterStatus, setTwitterStatus] = useState<'success' | 'error' | null>(null);
    const [isLoadingTwitter, setIsLoadingTwitter] = useState(false);

    const [disconnectingPlatform, setDisconnectingPlatform] = useState<SocialPlatform | null>(null);

    const fetchInitialData = useCallback(async () => {
        setIsLoadingYouTube(true);
        setIsLoadingFacebook(true); 
        setIsLoadingTikTok(true);
        setIsLoadingInstagram(true);
        setIsLoadingTwitter(true);
        try {
            const credentials = await getSystemCredentials();
            const adminId = sessionStorage.getItem('userId') || 'admin';
            const redirectUri = getRedirectUri();
            
            // YouTube Setup
            if (credentials.googleClientId || credentials.youtubeClientId) {
                const clientId = credentials.googleClientId || credentials.youtubeClientId;
                const scopes = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'];
                const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                url.searchParams.set('client_id', clientId!);
                url.searchParams.set('redirect_uri', redirectUri);
                url.searchParams.set('response_type', 'code');
                url.searchParams.set('scope', scopes.join(' '));
                url.searchParams.set('access_type', 'offline');
                url.searchParams.set('prompt', 'consent');
                url.searchParams.set('state', `youtube_auth:${adminId}`);
                setYoutubeAuthUrl(url.toString());
            }

            // Facebook Setup
            if (credentials.facebookClientId) {
                const scopes = 'email,public_profile';
                const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
                url.searchParams.set('client_id', credentials.facebookClientId);
                url.searchParams.set('redirect_uri', redirectUri);
                url.searchParams.set('response_type', 'code');
                url.searchParams.set('scope', scopes);
                url.searchParams.set('state', `facebook_auth:${adminId}`);
                setFacebookAuthUrl(url.toString());
                // Instagram uses the same Client ID and auth URL
                url.searchParams.set('state', `instagram_auth:${adminId}`);
                setInstagramAuthUrl(url.toString());
            }

            // TikTok Setup
             const tiktokResult = await buildTikTokAuthorizeUrl(adminId);
             if (tiktokResult.success && tiktokResult.authorizeUrl) {
                 setTiktokAuthUrl(tiktokResult.authorizeUrl);
             }


            // Check statuses
            if (credentials.youtubeSelectedChannelId) {
                setYoutubeStatus('success');
                setSavedChannelId(credentials.youtubeSelectedChannelId);
            } else {
                setYoutubeStatus(null);
            }
            
            if (credentials.facebookAccessToken) {
                setFacebookStatus('success');
                setInstagramStatus('success');
            } else {
                 setFacebookStatus(null);
                 setInstagramStatus(null);
            }
            
             if (credentials.tiktokAccessToken) {
                setTiktokStatus('success');
            } else {
                 setTiktokStatus(null);
            }

             if (credentials.twitterAccessToken) {
                setTwitterStatus('success');
            } else {
                 setTwitterStatus(null);
            }


            const fetchedChannels = await listChannels();
            if(fetchedChannels.length > 0) {
                 setChannels(fetchedChannels);
                 if (fetchedChannels.length > 0) {
                     setSelectedChannel(credentials.youtubeSelectedChannelId || fetchedChannels[0].id);
                 }
                 setYoutubeStatus('success');
            }
           
        } catch (error) {
            console.warn("Could not fetch initial data, likely not authenticated yet for some services.");
        } finally {
            setIsLoadingYouTube(false);
            setIsLoadingFacebook(false); 
            setIsLoadingTikTok(false);
            setIsLoadingInstagram(false);
            setIsLoadingTwitter(false);
        }
    }, []);
    
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

     useEffect(() => {
        const handleAuthMessage = async (event: MessageEvent) => {
            if (typeof window !== 'undefined' && event.origin !== window.location.origin) return;
            const { type, error } = event.data;

            if (type === 'auth-error') {
                 toast({ variant: 'destructive', title: 'שגיאת אימות', description: `התהליך נכשל. שגיאה: ${error}` });
                 return;
            }

            if (type.endsWith('-success')) {
                const serviceName = type.split('-')[0];
                toast({ title: `ההתחברות ל${serviceName} הצליחה!`, description: 'מרענן נתונים...' });
                await fetchInitialData();
            }
        };

        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, [fetchInitialData, toast]);


    const openAuthPopup = (url: string | undefined, serviceName: string) => {
        if (!url) {
            if (serviceName === 'twitter') {
                 window.open('/api/twitter/start', 'twitter_auth', 'width=600,height=750');
                 return;
            }
            toast({ variant: 'destructive', title: 'שגיאת תצורה', description: 'כתובת האימות אינה מוגדרת. ודא שהוספת מפתחות API.' });
            return;
        };

        const width = 600, height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(url, `${serviceName}Auth`, `width=${width},height=${height},top=${top},left=${left}`);
    };
    
    const handleSaveChannel = async () => {
        if (!selectedChannel) {
            toast({ variant: 'destructive', title: 'לא נבחר ערוץ' }); return;
        }
        setIsSavingYouTube(true);
        try {
            await saveSelectedChannel(selectedChannel);
            toast({ title: 'ערוץ היוטיוב נשמר בהצלחה!' });
            setSavedChannelId(selectedChannel);
            setIsDialogOpen(false);
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה בשמירת ערוץ', description: (error as Error).message });
        } finally { setIsSavingYouTube(false); }
    };
    
    const handleDisconnect = async (platform: SocialPlatform) => {
        setDisconnectingPlatform(platform);
        try {
            const result = await disconnectSocialPlatform(platform);
            if (result.success) {
                toast({ title: "החיבור בוטל", description: `החיבור ל-${platform} בוטל בהצלחה.`});
                // Manually reset the status for the UI to update instantly
                switch(platform) {
                    case 'youtube': setYoutubeStatus(null); setSavedChannelId(undefined); setChannels([]); break;
                    case 'facebook': setFacebookStatus(null); break;
                    case 'instagram': setInstagramStatus(null); break;
                    case 'tiktok': setTiktokStatus(null); break;
                    case 'twitter': setTwitterStatus(null); break;
                }
            } else {
                throw new Error(result.error || `Failed to disconnect ${platform}.`);
            }
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setDisconnectingPlatform(null);
            setIsDialogOpen(false); // Close dialog on disconnect
        }
    };

    const selectedChannelTitle = channels.find(c => c.id === savedChannelId)?.title;

    const openDialogFor = (platform: { id: SocialPlatform; name: string; icon: React.ElementType; available: boolean }) => {
        setActiveDialog(platform.id);
        setIsDialogOpen(true);
    }

    const renderDialogContent = () => {
        switch (activeDialog) {
            case 'youtube':
                return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור לחשבון YouTube <Youtube className="h-6 w-6 text-red-600"/></DialogTitle>
                            <DialogDescription>{savedChannelId ? `מחובר לערוץ: ${selectedChannelTitle || savedChannelId}` : 'חבר את חשבון היוטיוב שלך כדי לאפשר שידור חי ישיר מהמערכת.'}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <Button variant="outline" className="w-full h-16" disabled={!youtubeAuthUrl || isLoadingYouTube} onClick={() => openAuthPopup(youtubeAuthUrl, 'youtube')}>
                                {isLoadingYouTube ? <Loader2 className="h-5 w-5 animate-spin" /> : <Youtube className="ml-2 h-6 w-6 text-red-600" />}
                                {savedChannelId ? 'התחבר מחדש או החלף חשבון' : 'התחבר עם YouTube'}
                            </Button>
                            {channels.length > 0 && (
                                <div className="pt-4 border-t">
                                    <Label htmlFor="channel-select" className="mb-2 block">בחר ערוץ ברירת מחדל לשידור</Label>
                                    <div className="flex items-center gap-2">
                                        <Select dir="rtl" value={selectedChannel} onValueChange={setSelectedChannel}>
                                            <SelectTrigger id="channel-select"><SelectValue placeholder="בחר ערוץ..." /></SelectTrigger>
                                            <SelectContent>{channels.map(channel => (<SelectItem key={channel.id} value={channel.id}>{channel.title}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <Button onClick={handleSaveChannel} disabled={isSavingYouTube}>{isSavingYouTube ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}שמור</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                );
            case 'facebook':
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור לחשבון Facebook<Facebook className="h-6 w-6 text-blue-600"/></DialogTitle>
                            <DialogDescription>חיבור לפייסבוק יאפשר שידור לדפים, קבוצות ופרופיל אישי.</DialogDescription>
                        </DialogHeader>
                         <div className="py-4">
                             <Button variant="outline" className="w-full h-16" disabled={!facebookAuthUrl || isLoadingFacebook} onClick={() => openAuthPopup(facebookAuthUrl, 'facebook')}>
                                {isLoadingFacebook ? <Loader2 className="h-5 w-5 animate-spin" /> : <Facebook className="ml-2 h-6 w-6 text-blue-600" />}
                                {facebookStatus === 'success' ? 'התחבר מחדש' : 'התחבר עם Facebook'}
                            </Button>
                         </div>
                    </>
                );
             case 'instagram':
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור לחשבון Instagram<Instagram className="h-6 w-6"/></DialogTitle>
                            <DialogDescription>חיבור לאינסטגרם מתבצע דרך פייסבוק ויאפשר שידור לחשבון המקצועי שלך.</DialogDescription>
                        </DialogHeader>
                         <div className="py-4">
                              <Button variant="outline" className="w-full h-16" disabled={!instagramAuthUrl || isLoadingInstagram} onClick={() => openAuthPopup(instagramAuthUrl, 'instagram')}>
                                {isLoadingInstagram ? <Loader2 className="h-5 w-5 animate-spin" /> : <Instagram className="ml-2 h-6 w-6" />}
                                {instagramStatus === 'success' ? 'התחבר מחדש' : 'התחבר עם Instagram דרך Facebook'}
                            </Button>
                         </div>
                    </>
                );
             case 'tiktok':
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור לחשבון TikTok<TikTokIcon className="h-6 w-6"/></DialogTitle>
                            <DialogDescription>חיבור לטיקטוק יאפשר שידור חי ישיר מהמערכת.</DialogDescription>
                        </DialogHeader>
                         <div className="py-4">
                             <Button variant="outline" className="w-full h-16" disabled={!tiktokAuthUrl || isLoadingTikTok} onClick={() => openAuthPopup(tiktokAuthUrl, 'tiktok')}>
                                {isLoadingTikTok ? <Loader2 className="h-5 w-5 animate-spin" /> : <TikTokIcon className="ml-2 h-6 w-6" />}
                                {tiktokStatus === 'success' ? 'התחבר מחדש' : 'התחבר עם TikTok'}
                            </Button>
                         </div>
                    </>
                );
            case 'twitter':
                 return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור לחשבון Twitter (X)<Twitter className="h-6 w-6"/></DialogTitle>
                            <DialogDescription>חיבור לטוויטר יאפשר שידור חי ישיר מהמערכת.</DialogDescription>
                        </DialogHeader>
                         <div className="py-4">
                             <Button variant="outline" className="w-full h-16" disabled={isLoadingTwitter} onClick={() => openAuthPopup(undefined, 'twitter')}>
                                {isLoadingTwitter ? <Loader2 className="h-5 w-5 animate-spin" /> : <Twitter className="ml-2 h-6 w-6" />}
                                {twitterStatus === 'success' ? 'התחבר מחדש' : 'התחבר עם Twitter'}
                            </Button>
                         </div>
                    </>
                );
             case 'telegram':
                return (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center justify-end gap-2">חיבור בוט התראות לטלגרם<Send className="h-6 w-6 text-sky-500"/></DialogTitle>
                            <DialogDescription>
                                חבר בוט טלגרם כדי לאפשר שליחת התראות אוטומטיות לערוצים וקבוצות.
                                <br/>
                                <Link href="/admin/integrations" className="text-xs text-primary underline" onClick={() => setIsDialogOpen(false)}>לחץ כאן להגדרת ה-Bot Token</Link>
                            </DialogDescription>
                        </DialogHeader>
                         <div className="py-4 text-center text-muted-foreground">
                            החיבור מתבצע דרך עמוד מפתחות ה-API.
                         </div>
                    </>
                );
            default:
                return null;
        }
    }


    return (
        <div className="space-y-8 text-right">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <DialogContent className="sm:max-w-md text-right">
                     {renderDialogContent()}
                     <DialogFooter>
                        {activeDialog && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={disconnectingPlatform === activeDialog}>
                                         {disconnectingPlatform === activeDialog ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogOut className="ml-2 h-4 w-4" />}
                                        נתק חיבור
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="text-right">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                        <AlertDialogDescription>פעולה זו תמחק את החיבור הקיים לפלטפורמה זו ותדרוש אימות מחדש בעתיד.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDisconnect(activeDialog)} className="bg-destructive hover:bg-destructive/90">כן, נתק</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <DialogClose asChild><Button variant="outline">סגור</Button></DialogClose>
                     </DialogFooter>
                 </DialogContent>
            </Dialog>

            <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href="/admin/dashboard">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה
                    </Link>
                </Button>
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold tracking-tight">חיבור לרשתות חברתיות</h1>
                    <p className="text-muted-foreground">
                        חבר כאן את חשבונות הרשתות החברתיות של העסק כדי לאפשר שידור ישיר וניהול אוטומטי.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        בחר פלטפורמה להתחברות
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {socialPlatforms.map((platform) => {
                           const isConnected = 
                               (platform.id === 'youtube' && youtubeStatus === 'success') || 
                               (platform.id === 'facebook' && facebookStatus === 'success') ||
                               (platform.id === 'tiktok' && tiktokStatus === 'success') ||
                               (platform.id === 'instagram' && instagramStatus === 'success') ||
                               (platform.id === 'twitter' && twitterStatus === 'success');

                           return (
                            <Card key={platform.id} className={cn("hover:border-primary/80 transition-colors")}>
                                <CardHeader>
                                     <div className="flex justify-end items-center gap-4">
                                        <div className="text-right">
                                            <CardTitle>{platform.name}</CardTitle>
                                            <CardDescription>{platform.description}</CardDescription>
                                        </div>
                                        <div className="p-3 bg-background rounded-md">
                                            <platform.icon className="h-6 w-6 text-primary" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardFooter className="flex-col items-start gap-2">
                                     <Button className="w-full" variant={isConnected ? "secondary" : "default"} onClick={() => openDialogFor(platform)}>
                                        {isConnected ? <CheckCircle2 className="ml-2 h-4 w-4 text-green-500" /> : <LinkIcon className="ml-2 h-4 w-4" />}
                                        {isConnected ? 'נהל חיבור' : 'התחבר'}
                                    </Button>
                                </CardFooter>
                            </Card>
                           )
                        })}
                    </div>
                </CardContent>
                 <CardFooter className="pt-6">
                    <p className="text-xs text-muted-foreground">
                       לחיבור שירותים חדשים, ודא שהוספת את מפתחות ה-API המתאימים בעמוד <Link href="/admin/integrations" className="underline hover:text-primary">מפתחות API</Link>.
                    </p>
                </CardFooter>
            </Card>

        </div>
    );
}
