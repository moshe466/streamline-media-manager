'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, User, RefreshCw, ShieldCheck, Radio, CalendarClock, Tv, Send, Users } from 'lucide-react';
import { type Client } from '@/services/clients';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays, isPast } from 'date-fns';

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = params.clientId as string;
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clientDataString = sessionStorage.getItem('clientData');
    if (clientDataString) {
      setClient(JSON.parse(clientDataString));
    } else {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את פרטי הלקוח.' });
      router.push('/client/' + clientId + '/dashboard');
    }
    setIsLoading(false);
  }, [clientId, router, toast]);

  const handleRenewSubscription = () => {
    window.open('https://mrng.to/lAfc8WSZYy', '_blank');
  };

  const shouldShowRenewButton = () => {
    if (!client || !client.activeUntil) return false;

    const expiryDate = parseISO(client.activeUntil);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    return client.status === 'לא פעיל' || daysUntilExpiry <= 30;
  };

  if (isLoading || !client) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-52 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  const activeUntilLabel = client.activeUntil ? format(parseISO(client.activeUntil), 'dd/MM/yyyy') : 'ללא הגבלה';
  const daysLeft = client.activeUntil ? differenceInDays(parseISO(client.activeUntil), new Date()) : null;
  const isExpired = client.activeUntil ? isPast(parseISO(client.activeUntil)) : false;

  const permissionCards = [
    {
      title: 'שידורים ליצירה',
      value: client.permissions.maxStreams === Infinity ? '∞' : client.permissions.maxStreams,
      icon: Tv,
      color: 'text-cyan-300',
    },
    {
      title: 'יעדי Push',
      value: client.permissions.maxPushDestinations,
      icon: Send,
      color: 'text-orange-300',
    },
    {
      title: 'יצירת שידורים',
      value: client.permissions.canCreateStreams ? 'מורשה' : 'חסום',
      icon: Radio,
      color: client.permissions.canCreateStreams ? 'text-green-300' : 'text-red-300',
    },
    {
      title: 'יצירת צופים',
      value: client.permissions.canCreateViewers ? 'מורשה' : 'חסום',
      icon: Users,
      color: client.permissions.canCreateViewers ? 'text-green-300' : 'text-red-300',
    },
  ];

  return (
    <main dir="rtl" className="client-mission-control space-y-6 p-4 sm:p-6 lg:p-8 text-right">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950 p-6 shadow-2xl sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-orange-500/10" />
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-20 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge className="w-fit rounded-full bg-cyan-500/15 px-4 py-2 text-cyan-100 hover:bg-cyan-500/20">
              <ShieldCheck className="ml-2 h-4 w-4 text-green-300" />
              מצב חשבון
            </Badge>

            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                מצב הפרופיל
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-300">
                סקירה מינימליסטית של סטטוס החשבון, תוקף המנוי וההרשאות המרכזיות שלך.
              </p>
            </div>

            <Button asChild variant="outline" className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link href={'/client/' + clientId + '/dashboard'}>
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה ללוח הבקרה
              </Link>
            </Button>
          </div>

          <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl">
            <CardContent className="p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <User className="h-12 w-12 text-cyan-300" />
                <div className="text-right">
                  <p className="text-sm text-slate-400">שם לקוח</p>
                  <p className="text-2xl font-black">{client.nickname}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                  <Badge className={client.status === 'פעיל' ? 'bg-green-600' : 'bg-red-600'}>
                    {client.status}
                  </Badge>
                  <span className="font-bold text-slate-200">סטטוס חשבון</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                  <span className={isExpired ? 'font-bold text-red-300' : 'font-bold text-green-300'}>
                    {activeUntilLabel}
                  </span>
                  <span className="font-bold text-slate-200">בתוקף עד</span>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
                  <span className="font-bold text-cyan-300">
                    {daysLeft === null ? 'ללא הגבלה' : Math.max(daysLeft, 0) + ' ימים'}
                  </span>
                  <span className="font-bold text-slate-200">ימים שנותרו</span>
                </div>
              </div>

              {shouldShowRenewButton() && (
                <Button onClick={handleRenewSubscription} className="mt-5 w-full rounded-full">
                  <RefreshCw className="ml-2 h-4 w-4" />
                  חידוש מנוי
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {permissionCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-white/10 bg-slate-950/70 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <Icon className={'h-9 w-9 ' + item.color} />
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{item.title}</p>
                    <p className="mt-1 text-2xl font-black text-white">{item.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-cyan-400/10 bg-slate-950/70">
        <CardContent className="p-6">
          <h2 className="text-2xl font-black text-white">הרשאות נוספות</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <Badge className={client.permissions.canDeleteStreams ? 'bg-green-600' : 'bg-slate-600'}>
                {client.permissions.canDeleteStreams ? 'מורשה' : 'לא מורשה'}
              </Badge>
              <span className="font-bold text-slate-200">מחיקת שידורים</span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <Badge className={client.permissions.canCreateViewers ? 'bg-green-600' : 'bg-slate-600'}>
                {client.permissions.canCreateViewers ? 'מורשה' : 'לא מורשה'}
              </Badge>
              <span className="font-bold text-slate-200">יצירת צופים</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
