
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getLogs, type LogEntry } from '@/services/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BookText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Function to determine badge color based on event type
const getBadgeVariant = (eventType: string): "default" | "secondary" | "destructive" | "outline" => {
  if (eventType.toLowerCase().includes('success')) return 'default';
  if (eventType.toLowerCase().includes('failure') || eventType.toLowerCase().includes('error') || eventType.toLowerCase().includes('deleted')) return 'destructive';
  if (eventType.toLowerCase().includes('update') || eventType.toLowerCase().includes('created') || eventType.toLowerCase().includes('resent') || eventType.toLowerCase().includes('added')) return 'outline';
  return 'secondary';
};

const getBadgeClassName = (eventType: string): string => {
    if (eventType.toLowerCase().includes('success')) return 'bg-green-600/80 text-primary-foreground border-transparent';
    if (eventType.toLowerCase().includes('failure') || eventType.toLowerCase().includes('error') || eventType.toLowerCase().includes('deleted')) return 'bg-red-600/80 text-destructive-foreground border-transparent';
    if (eventType.toLowerCase().includes('update') || eventType.toLowerCase().includes('created') || eventType.toLowerCase().includes('resent') || eventType.toLowerCase().includes('added')) return 'bg-blue-600/80 text-primary-foreground border-transparent';
    return '';
}


export default function LogsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const fetchedLogs = await getLogs();
        setLogs(fetchedLogs);
      } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את הלוגים.' });
      }
      setIsLoading(false);
    };

    fetchLogs();
  }, [toast]);
  

  return (
    <div className="space-y-8 text-right">
       <div className="flex items-center justify-between">
            <div></div>
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">לוג פעילות מערכת</h1>
                <p className="text-muted-foreground">
                    מעקב אחר כל הפעולות והאירועים שהתרחשו במערכת.
                </p>
            </div>
        </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            יומן אירועים
            <BookText className="h-5 w-5" />
          </CardTitle>
          <CardDescription>האירועים מוצגים מהחדש ביותר לישן ביותר.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="responsive-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פירוט</TableHead>
                <TableHead className="text-right">סוג אירוע</TableHead>
                <TableHead className="w-[180px] text-right">זמן</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell data-label="פירוט"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell data-label="סוג אירוע"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell data-label="זמן"><Skeleton className="h-5 w-32" /></TableCell>
                    </TableRow>
                  ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell data-label="פירוט" className="font-mono text-xs dir-ltr text-left break-all flex-col items-start md:flex-row md:items-center">
                        <span className="w-full">{log.details}</span>
                    </TableCell>
                    <TableCell data-label="סוג אירוע">
                      <Badge variant={getBadgeVariant(log.type)} className={cn(getBadgeClassName(log.type))}>
                        {log.type}
                      </Badge>
                    </TableCell>
                     <TableCell data-label="זמן" className="text-muted-foreground whitespace-nowrap">
                        {isClient && new Date(log.timestamp).toLocaleString('he-IL', {
                            dateStyle: 'short',
                            timeStyle: 'medium'
                        })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    לא נמצאו רשומות לוג.
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
