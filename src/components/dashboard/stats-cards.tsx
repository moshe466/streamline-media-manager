import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Tv, UserCheck, Monitor, Signal } from 'lucide-react';
import { getTotalRegisteredViewers } from '@/services/viewers';
import { FlussonicStream } from "@/services/flussonic-types";
import Link from 'next/link';
import { getActiveSessionsCount } from '@/services/sessions';
import { getDb } from '@/lib/firebase-admin';

type StatsCardsProps = {
  streams: FlussonicStream[];
};

export async function StatsCards({ streams }: StatsCardsProps) {
    const [clientsSnap, usersSnap, totalRegisteredViewers, activeSessions] = await Promise.all([
        getDb().collection('clients').get(),
        getDb().collection('users').get(),
        getTotalRegisteredViewers(),
        getActiveSessionsCount(),
    ]);

    const clients = clientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const adminUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const activeStreamsCount = streams.filter(s => s.status === 'online').length;
    const totalStreamsCount = streams.length;
    const totalClientsCount = clients.length;
    const totalAdminsCount = adminUsers.filter((u: any) => u.role === 'admin' || u.role === 'super-admin').length;
    const totalEditorsCount = adminUsers.filter((u: any) => u.role === 'editor').length;

    const stats = [
        { title: "משתמשים מחוברים", value: activeSessions, description: "מנהלים, לקוחות וצופים", icon: Signal, href: '/admin/live-status' },
        { title: "סך הכל מנהלים ועורכים", value: totalAdminsCount + totalEditorsCount, description: `מנהלים: ${totalAdminsCount}, עורכים: ${totalEditorsCount}`, icon: UserCheck, href: '/admin/users' },
        { title: "סך הכל לקוחות", value: totalClientsCount, description: "לקוחות רשומים במערכת", icon: Users, href: '/admin/clients' },
        { title: "סך הכל צופים רשומים", value: totalRegisteredViewers, description: "צופים רשומים בכל המערכת", icon: Users, href: '/admin/viewers' },
        { title: "סך הכל שידורים", value: totalStreamsCount, description: "שידורים קיימים בשרת", icon: Tv, href: '/admin/streams' },
        { title: "שידורים פעילים", value: activeStreamsCount, description: `מתוך ${totalStreamsCount} שידורים`, icon: Monitor, href: '/admin/mcr' },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, index) => (
                 <Link href={stat.href} key={index} className="flex">
                    <Card className="bg-card w-full hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-primary">{typeof stat.value === "object" ? JSON.stringify(stat.value) : stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
}
