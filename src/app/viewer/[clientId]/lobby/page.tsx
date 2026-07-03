'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Archive,
  Clapperboard,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Play,
  ShieldCheck,
  User,
  VideoOff,
  Wifi,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getClientById, type Client } from '@/services/clients';
import { getFlussonicConnectionDetails, getStreams, type FlussonicStream } from '@/services/flussonic';
import { requestPermissionRenewalForViewer } from '@/services/requests';
import type { Viewer } from '@/services/viewers';
import { format, isPast, parseISO } from 'date-fns';

function LivePreview({ streamName, host }: { streamName: string; host: string }) {
  if (!host) return <div className="h-full w-full bg-black" />;

  const src =
    'https://' +
    host +
    '/' +
    streamName +
    '/embed.html?proto=mse&dvr=false&realtime=true&muted=true&autoplay=true&controls=false&chromeless=true&liveSyncDurationCount=1&quality=lowest';

  return (
    <iframe
      src={src}
      allow="autoplay"
      allowFullScreen
      className="h-full w-full border-0 bg-black"
    />
  );
}

function daysLeft(date?: string) {
  if (!date) return null;
  const end = new Date(date).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export default function ViewerLobbyPage() {
  const params = useParams();
  const { toast } = useToast();

  const clientId = decodeURIComponent(params.clientId as string);

  const [isLoading, setIsLoading] = useState(true);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [liveStreams, setLiveStreams] = useState<FlussonicStream[]>([]);
  const [publicHost, setPublicHost] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const viewerId = typeof window !== 'undefined' ? sessionStorage.getItem('userId') : null;

  const loadData = useCallback(async () => {
    try {
      const viewerDataString = sessionStorage.getItem('viewerData');
      const clientDataString = sessionStorage.getItem('clientData');

      if (!viewerDataString || !clientDataString) {
        throw new Error('לא ניתן לטעון את פרטי הצופה.');
      }

      const parsedViewer = JSON.parse(viewerDataString) as Viewer;
      const parsedClient = JSON.parse(clientDataString) as Client;

      setViewer(parsedViewer);
      setClientData(parsedClient);

      const [streams, connection] = await Promise.all([
        getStreams(),
        getFlussonicConnectionDetails(),
      ]);

      setPublicHost(connection.publicHost);

      const allowedLive = streams.filter((stream) =>
        stream.status === 'online' &&
        parsedViewer.permissions &&
        parsedViewer.permissions[stream.name]?.canWatchLive
      );

      setLiveStreams(allowedLive);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 30000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const hasExpired = viewer?.expiresAt ? isPast(parseISO(viewer.expiresAt)) : false;
  const left = daysLeft(viewer?.expiresAt || undefined);
  const quickLinks = clientData?.links || [];

  const actionCards = useMemo(() => [
    {
      title: 'שידורים חיים',
      description: 'צפה בשידורים הפעילים בזמן אמת',
      href: '/viewer/' + clientId + '/streams',
      icon: Clapperboard,
      count: liveStreams.length,
    },
    {
      title: 'ארכיון DVR',
      description: 'צפה בהקלטות ושידורים קודמים',
      href: '/viewer/' + clientId + '/dvr',
      icon: Archive,
    },
    {
      title: 'קישורים שימושיים',
      description: 'קישורים חיצוניים ששותפו עבורך',
      href: '/viewer/' + clientId + '/links',
      icon: Link2,
      count: quickLinks.length,
    },
    {
      title: 'סטטוס החשבון',
      description: hasExpired ? 'ההרשאות שלך פגו' : 'החשבון פעיל ומוכן לצפייה',
      href: '/viewer/' + clientId + '/settings',
      icon: ShieldCheck,
    },
  ], [clientId, hasExpired, liveStreams.length, quickLinks.length]);

  const handleRenewalRequest = async () => {
    if (!viewerId || !clientId) return;

    setIsSubmittingRequest(true);
    const result = await requestPermissionRenewalForViewer(viewerId, clientId);

    if (result.success) {
      toast({ title: 'בקשה נשלחה', description: 'בקשתך לחידוש הגישה נשלחה לאישור.' });
      setRequestStatus('sent');
      const client = await getClientById(clientId);
      setClientData(client);
    } else {
      toast({ variant: 'destructive', title: 'שליחה נכשלה', description: result.error });
      setRequestStatus('error');
    }

    setIsSubmittingRequest(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen p-4 sm:p-6 lg:p-8 text-right">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.5fr_.8fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
              <Wifi className="h-4 w-4 text-green-400" />
              {liveStreams.length > 0 ? liveStreams.length + ' שידורים חיים זמינים עכשיו' : 'אין שידורים חיים כרגע'}
            </div>

            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                שלום {viewer?.nickname || 'צופה'} </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-300">
                ברוכים הבאים למרכז הצפייה שלך. כאן תוכל לצפות בשידורים חיים, לעבור לארכיון ולפתוח קישורים חשובים.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400">
                <Link href={'/viewer/' + clientId + '/streams'}>
                  <Play className="ml-2 h-5 w-5" />
                  עבור לשידורים החיים
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href={'/viewer/' + clientId + '/dvr'}>
                  <Archive className="ml-2 h-5 w-5" />
                  צפייה בארכיון
                </Link>
              </Button>
            </div>
          </div>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <User className="h-10 w-10 text-cyan-300" />
                <div className="text-right">
                  <p className="text-sm text-slate-400">סטטוס חשבון</p>
                  <p className={'text-2xl font-bold ' + (hasExpired ? 'text-red-400' : 'text-green-400')}>
                    {hasExpired ? 'פג תוקף' : 'פעיל'}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>{viewer?.expiresAt ? format(parseISO(viewer.expiresAt), 'dd/MM/yyyy HH:mm') : 'ללא הגבלה'}</span>
                  <span>בתוקף עד</span>
                </div>
                <div className="flex justify-between">
                  <span>{left === null ? '∞' : left + ' ימים'}</span>
                  <span>ימים שנותרו</span>
                </div>
              </div>

              {hasExpired && (
                <Button
                  className="mt-6 w-full"
                  variant="secondary"
                  onClick={handleRenewalRequest}
                  disabled={isSubmittingRequest || requestStatus === 'sent'}
                >
                  {isSubmittingRequest && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  {requestStatus === 'sent' ? 'בקשה נשלחה' : 'שלח בקשת חידוש'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className={hasExpired && item.title !== 'סטטוס החשבון' ? 'pointer-events-none opacity-50' : ''}>
              <Card className="group h-full overflow-hidden border-cyan-400/10 bg-slate-950/70 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-500/10">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <ExternalLink className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-300" />
                    <div className="rounded-2xl bg-cyan-400/10 p-4">
                      <Icon className="h-7 w-7 text-cyan-300" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                  {'count' in item && (
                    <p className="mt-4 text-sm font-bold text-orange-300">{item.count} זמינים</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <Button asChild variant="ghost" className="text-cyan-300">
            <Link href={'/viewer/' + clientId + '/streams'}>לכל השידורים</Link>
          </Button>
          <div>
            <h2 className="text-2xl font-black text-white">🔥 שידורים חיים</h2>
            <p className="text-sm text-slate-500">תצוגה חיה של השידורים המורשים עבורך</p>
          </div>
        </div>

        {liveStreams.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveStreams.slice(0, 6).map((stream) => (
              <Card key={stream.name} className="overflow-hidden border-cyan-400/10 bg-slate-950/70">
                <div className="relative aspect-video bg-black">
                  <LivePreview streamName={stream.name} host={publicHost} />
                  <div className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                    LIVE
                  </div>
                </div>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <Button asChild size="sm" className="rounded-full">
                    <Link href={'/viewer/' + clientId + '/streams/' + encodeURIComponent(stream.name)}>
                      צפה עכשיו
                    </Link>
                  </Button>
                  <h3 className="truncate text-lg font-bold text-white" title={stream.name}>{stream.name}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-slate-700 bg-slate-950/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <VideoOff className="h-14 w-14 text-slate-500" />
              <h3 className="mt-4 text-xl font-bold text-white">אין כרגע שידורים חיים</h3>
              <p className="mt-2 text-slate-500">אפשר לבדוק את הארכיון או לחזור מאוחר יותר.</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <Card className="border-cyan-400/10 bg-slate-950/70">
          <CardContent className="p-5">
            <h2 className="text-2xl font-black text-white">🔗 קישורים שימושיים</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickLinks.slice(0, 4).map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/40">
                  <div className="flex items-center justify-between gap-3">
                    <ExternalLink className="h-4 w-4 text-cyan-300" />
                    <div className="text-right">
                      <p className="font-bold text-white">{link.name}</p>
                      <p dir="ltr" className="mt-1 max-w-[220px] truncate text-xs text-slate-500">{link.url}</p>
                    </div>
                  </div>
                </a>
              ))}

              {quickLinks.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">
                  <FileText className="mx-auto h-10 w-10" />
                  <p className="mt-2">לא הוגדרו קישורים שימושיים.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-400/20 bg-gradient-to-br from-orange-500/10 to-slate-950">
          <CardContent className="p-5">
            <h2 className="text-2xl font-black text-white">📼 ארכיון</h2>
            <p className="mt-2 text-sm text-slate-400">כל ההקלטות והשידורים הקודמים במקום אחד.</p>
            <Button asChild className="mt-6 w-full rounded-full" variant="secondary">
              <Link href={'/viewer/' + clientId + '/dvr'}>
                מעבר לארכיון
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
