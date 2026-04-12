
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { getAvailableBackups, restoreConfigFromBackup, backupFlussonicConfig } from '@/services/backup';
import { History, AlertTriangle, Loader2, DownloadCloud } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { getUserById } from '@/services/users';

export default function BackupsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [backups, setBackups] = useState<string[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);


  useEffect(() => {
    const checkAuth = async () => {
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            router.push('/login');
            return;
        }
        const user = await getUserById(userId);
        if (user?.role === 'super-admin' || user?.role === 'admin' || user?.permissions?.canAccessBackup) {
            setIsAuthorized(true);
            fetchBackups();
        } else {
            toast({ variant: 'destructive', title: 'אין הרשאה', description: 'אין לך גישה לעמוד זה.' });
            router.push('/admin/dashboard');
        }
    };
    checkAuth();
  }, [router, toast]);


  const fetchBackups = async () => {
      setIsLoading(true);
      try {
        const backupFiles = await getAvailableBackups();
        setBackups(backupFiles);
        if (backupFiles.length > 0 && !selectedBackup) {
          setSelectedBackup(backupFiles[0]);
        }
      } catch (error) {
         toast({ variant: 'destructive', title: 'שגיאה בטעינת גיבויים', description: (error as Error).message });
      } finally {
        setIsLoading(false);
      }
    };


  const handleManualBackup = async () => {
    setIsBackingUp(true);
    toast({ title: 'מתחיל גיבוי...', description: 'הורדת התצורה מהשרת מתבצעת כעת.' });
    try {
        await backupFlussonicConfig();
        toast({ title: 'הורדה הושלמה, מנהל גיבויים...', description: 'מסדר את קבצי הגיבוי ושומר את האחרון.' });
        toast({ title: 'הגיבוי הושלם בהצלחה!', description: 'קובץ הגיבוי החדש זמין ברשימה.' });
        // Refetch backups to update the list in the UI
        await fetchBackups();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'שגיאה לא ידועה';
        toast({
            variant: 'destructive',
            title: 'שגיאה בגיבוי הידני',
            description: errorMessage,
        });
    }
    setIsBackingUp(false);
  }

  const handleRestore = async () => {
    if (!selectedBackup) {
      toast({ variant: 'destructive', title: 'לא נבחר גיבוי', description: 'אנא בחר קובץ גיבוי לשחזור.' });
      return;
    }

    setIsRestoring(true);
    const result = await restoreConfigFromBackup(selectedBackup);

    if (result.success) {
      toast({
        title: 'השחזור הצליח',
        description: `תצורת השרת שוחזרה בהצלחה מהקובץ ${selectedBackup}. ייתכן שהשרת יופעל מחדש.`,
        duration: 5000,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'שגיאה בשחזור',
        description: result.error || 'אירעה שגיאה לא צפויה בעת ניסיון השחזור.',
      });
    }
    setIsRestoring(false);
  };

  const formatDateFromFilename = (filename: string) => {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) return filename;
    const date = new Date(match[1]);
    return new Intl.DateTimeFormat('he-IL', { dateStyle: 'full', timeZone: 'Asia/Jerusalem' }).format(date);
  };

  if (!isAuthorized) {
    return null; // Render nothing while redirecting
  }

  return (
    <div className="space-y-8 text-right">
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
         <Button onClick={handleManualBackup} disabled={isBackingUp || isLoading} className="w-full sm:w-auto">
            {isBackingUp ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="ml-2 h-4 w-4" />}
            {isBackingUp ? 'מגבה...' : 'גבה עכשיו'}
        </Button>
        <div className="space-y-2 text-right">
          <h1 className="text-3xl font-bold tracking-tight">גיבוי ושחזור תצורה</h1>
          <p className="text-muted-foreground">
            שחזר את תצורת שרת Flussonic מגיבוי שנשמר אוטומטית או גבה את התצורה הנוכחית.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            שחזור מגיבוי
            <History className="h-5 w-5" />
          </CardTitle>
          <CardDescription>בחר את תאריך הגיבוי שברצונך לשחזר.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
             <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
             </div>
          ) : backups.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-medium">בחר גיבוי לשחזור</label>
                <Select dir="rtl" value={selectedBackup ?? ''} onValueChange={setSelectedBackup}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תאריך..." />
                  </SelectTrigger>
                  <SelectContent>
                    {backups.map((backupFile) => (
                      <SelectItem key={backupFile} value={backupFile}>
                        {formatDateFromFilename(backupFile)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-start">
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!selectedBackup || isRestoring}>
                      {isRestoring && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      שחזר תצורה
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="text-right">
                    <AlertDialogHeader>
                      <AlertDialogTitle>אזהרה: האם אתה בטוח?</AlertDialogTitle>
                      <AlertDialogDescription>
                        פעולה זו תחליף את התצורה הנוכחית של שרת המדיה בגיבוי מהתאריך{' '}
                        <strong>{selectedBackup ? formatDateFromFilename(selectedBackup) : ''}</strong>.
                        לא ניתן לבטל פעולה זו. השרת עלול להיות לא זמין למספר רגעים לאחר השחזור.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        כן, אני מבין את הסיכון. שחזר.
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              <History className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold">לא נמצאו גיבויים</h3>
              <p className="mt-1 text-sm">המערכת עדיין לא יצרה גיבויים. לחץ על 'גבה עכשיו' כדי ליצור גיבוי ראשון.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="border-yellow-500/50 bg-yellow-500/10 text-yellow-foreground">
        <CardHeader>
             <CardTitle className="flex items-center justify-end gap-2 text-yellow-300">
                <AlertTriangle className="h-5 w-5" />
                מידע חשוב
             </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm break-words">
            <p><strong>פעולת השחזור היא פעולה דרסטית.</strong> היא דורסת את כל ההגדרות הנוכחיות בשרת Flussonic, כולל רשימת השידורים, הגדרות ה-DVR, ועוד.</p>
            <p>השתמש באפשרות זו רק אם אתה בטוח שחלה טעות קריטית בתצורה הנוכחית וברצונך לחזור לגרסה קודמת ויציבה.</p>
            <p>לאחר השחזור, ייתכן שתצטרך להפעיל מחדש שידורים מסוימים באופן ידני.</p>
        </CardContent>
      </Card>

    </div>
  );
}
