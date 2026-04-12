
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getActiveSessions, type ActiveSessionWithDetails } from '@/services/sessions';
import { Signal, User, Users, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export default function LiveStatusPage() {
    const [sessions, setSessions] = useState<ActiveSessionWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    const fetchSessions = useCallback(async () => {
        try {
            const fetchedSessions = await getActiveSessions();
            setSessions(fetchedSessions);
        } catch (error) {
            console.error("Failed to fetch live sessions:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsClient(true);
        fetchSessions();
        const intervalId = setInterval(fetchSessions, 7000); // Refresh every 7 seconds
        return () => clearInterval(intervalId);
    }, [fetchSessions]);

    const sessionSummary = useMemo(() => {
        return sessions.reduce((acc, session) => {
            let role = session.role;
            if (role === 'super-admin') role = 'admin';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [sessions]);
    
    const roleConfig = {
        'admin': { label: 'מנהלים', icon: User, color: 'bg-red-500' },
        'editor': { label: 'עורכים', icon: UserCheck, color: 'bg-yellow-500' },
        'client': { label: 'לקוחות', icon: Users, color: 'bg-blue-500' },
        'viewer': { label: 'צופים', icon: Users, color: 'bg-green-500' },
    };

    return (
        <div className="space-y-8">
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">סטטוס חי</h1>
                <p className="text-muted-foreground">
                    תמונת מצב חיה של המשתמשים המחוברים למערכת.
                </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">סה"כ מחוברים</CardTitle>
                        <Signal className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{sessions.length}</div>
                    </CardContent>
                </Card>
                {Object.entries(roleConfig).map(([role, config]) => (
                    <Card key={role}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                            <config.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{sessionSummary[role] || 0}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>רשימת מחוברים</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">תפקיד</TableHead>
                                <TableHead className="text-right">אימייל</TableHead>
                                <TableHead className="text-right">שם</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : sessions.length > 0 ? (
                                sessions.map(session => (
                                    <TableRow key={session.userId}>
                                        <TableCell>
                                            <Badge variant={session.role === 'admin' || session.role === 'super-admin' ? 'default' : 'secondary'}>
                                                {session.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{session.email}</TableCell>
                                        <TableCell className="font-medium">{session.nickname}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        אין משתמשים מחוברים כעת.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
