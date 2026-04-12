
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getLogs, type LogEntry } from '@/services/logger';
import { getDocuments, type MorningDocument } from '@/services/morning';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookText, ArrowRight, RefreshCw, Loader2, FileSearch, FileText, TestTube2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

const LOG_TYPES_TO_FETCH = [
    'MORNING_API_REQUEST',
    'MORNING_API_RESPONSE',
    'MORNING_API_ERROR_RESPONSE',
    'MORNING_AUTH_SUCCESS',
    'MORNING_AUTH_FAILURE'
];

const getStatusVariant = (status: MorningDocument['status']) => {
  switch (status) {
    case 'paid': return 'default';
    case 'pending': return 'secondary';
    case 'late': return 'destructive';
    default: return 'outline';
  }
};

const getStatusText = (status: MorningDocument['status']) => {
  switch (status) {
    case 'paid': return 'שולם';
    case 'pending': return 'ממתין';
    case 'late': return 'באיחור';
    case 'open': return 'פתוח';
    default: return status;
  }
};

export default function MorningDebugPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  // State for manual search tool
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedDocs, setSearchedDocs] = useState<MorningDocument[] | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const allLogs = await getLogs();
      const morningLogs = allLogs.filter(log => LOG_TYPES_TO_FETCH.includes(log.type));
      setLogs(morningLogs);
    } catch (error) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את הלוגים.' });
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    setIsClient(true);
    fetchLogs();
  }, []);
  
  const handleManualSearch = async () => {
    if (!searchId.trim()) {
        toast({ variant: 'destructive', title: 'נדרש מספר זיהוי', description: 'אנא הזן מספר עוסק / ת.ז. לחיפוש.' });
        return;
    }
    setIsSearching(true);
    setSearchedDocs(null);
    try {
        const docs = await getDocuments(searchId, null); // Pass null for createdAfter to get all docs
        setSearchedDocs(docs);
    } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאה בחיפוש', description: (error as Error).message });
        setSearchedDocs([]); // Set to empty array on error to show "not found"
    } finally {
        setIsSearching(false);
    }
  };

  const getBadgeClassName = (eventType: string): string => {
    if (eventType.includes('REQUEST')) return 'bg-blue-600/80 text-primary-foreground border-transparent';
    if (eventType.includes('RESPONSE') && !eventType.includes('ERROR')) return 'bg-green-600/80 text-primary-foreground border-transparent';
    if (eventType.includes('ERROR') || eventType.includes('FAILURE')) return 'bg-red-600/80 text-destructive-foreground border-transparent';
    if (eventType.includes('SUCCESS')) return 'bg-purple-600/80 text-primary-foreground border-transparent';
    return '';
  }

  const renderLogDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return <pre className="text-xs whitespace-pre-wrap font-mono p-2 bg-black/80 rounded-md">{JSON.stringify(parsed, null, 2)}</pre>;
    } catch (e) {
      return <p className="font-mono text-xs">{details}</p>;
    }
  }


  return (
    <div className="space-y-8 text-right">
       <div className="flex items-center justify-between">
            <div className="flex gap-2">
                 <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
                    {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <RefreshCw className="ml-2 h-4 w-4"/>}
                    רענן לוגים
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/development">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה
                    </Link>
                </Button>
            </div>
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">לוג בקשות - Morning</h1>
                <p className="text-muted-foreground">
                    מעקב אחר בקשות ותשובות ממערכת החשבוניות.
                </p>
            </div>
        </div>
      
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            בדיקה ידנית
            <FileSearch className="h-5 w-5" />
          </CardTitle>
          <CardDescription>הזן מספר עוסק / ח.פ / ת.ז כדי לבדוק אילו מסמכים קיימים עבורו במערכת Morning.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-end gap-2">
                 <Button onClick={handleManualSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileSearch className="ml-2 h-4 w-4" />}
                    חפש
                </Button>
                <div className="flex-1 space-y-1">
                    <Label htmlFor="search-id">מספר זיהוי</Label>
                    <Input id="search-id" value={searchId} onChange={(e) => setSearchId(e.target.value)} dir="ltr" />
                </div>
            </div>
        </CardContent>
        {searchedDocs && (
            <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                <h3 className="font-semibold text-lg">תוצאות חיפוש עבור: {searchId}</h3>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">סטטוס</TableHead>
                            <TableHead className="text-right">סה"כ</TableHead>
                            <TableHead className="text-right">סוג מסמך</TableHead>
                            <TableHead className="text-right">תאריך</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isSearching ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                        ) : searchedDocs.length > 0 ? (
                            searchedDocs.map(doc => (
                                <TableRow key={doc.id}>
                                    <TableCell><Badge variant={getStatusVariant(doc.status)}>{getStatusText(doc.status)}</Badge></TableCell>
                                    <TableCell>{new Intl.NumberFormat('he-IL', { style: 'currency', currency: doc.currency }).format(doc.total)}</TableCell>
                                    <TableCell>{doc.type}</TableCell>
                                    <TableCell>{doc.date ? format(parseISO(doc.date), 'dd/MM/yyyy') : '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    לא נמצאו מסמכים עבור מספר הזיהוי שהוזן.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardFooter>
        )}
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            יומן אירועים
            <BookText className="h-5 w-5" />
          </CardTitle>
          <CardDescription>האירועים מוצגים מהחדש ביותר לישן ביותר. לחץ על "רענן לוגים" כדי לראות את הפעולות האחרונות.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border-b pb-4"><Skeleton className="h-24 w-full" /></div>
                  ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="border-b pb-4 last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                         <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", getBadgeClassName(log.type))}>
                            {log.type}
                        </span>
                        <span className="text-sm text-muted-foreground">
                            {isClient && new Date(log.timestamp).toLocaleString('he-IL', {
                                dateStyle: 'short',
                                timeStyle: 'medium'
                            })}
                        </span>
                    </div>
                    <div className="dir-ltr text-left">
                       {renderLogDetails(log.details)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                    לא נמצאו רשומות לוג הקשורות ל-Morning.
                </div>
              )}
        </CardContent>
      </Card>
    </div>
  );
}
