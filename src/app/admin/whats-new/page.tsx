
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Megaphone, Save, History, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getVersionUpdates, addVersionUpdate, deleteVersionUpdate, type VersionUpdate, getCurrentAppVersion } from '@/services/versions';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


function getNextVersionString(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        return `${currentVersion}-next`;
    }
    parts[2]++; // Increment patch
    return parts.join('.');
}


export default function WhatsNewAdminPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    
    const [updates, setUpdates] = useState<VersionUpdate[]>([]);
    
    // Version state
    const [currentVersion, setCurrentVersion] = useState('');
    const [nextVersion, setNextVersion] = useState('');

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const fetchUpdatesAndVersion = useCallback(async () => {
        setIsLoading(true);
        const [fetchedUpdates, version] = await Promise.all([
            getVersionUpdates(),
            getCurrentAppVersion()
        ]);
        setUpdates(fetchedUpdates);
        setCurrentVersion(version);
        setNextVersion(getNextVersionString(version));
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchUpdatesAndVersion();
    }, [fetchUpdatesAndVersion]);

    const handlePublish = async () => {
        if (!title || !content) {
            toast({ variant: 'destructive', title: 'שדות חסרים', description: 'יש למלא את כל השדות כדי לפרסם עדכון.' });
            return;
        }

        setIsSaving(true);
        try {
            await addVersionUpdate(title, content);
            
            toast({
                title: 'העדכון פורסם בהצלחה!',
                description: `גרסה ${nextVersion} זמינה כעת למשתמשים.`
            });

            // Clear form and refresh list and versions
            setTitle('');
            setContent('');
            await fetchUpdatesAndVersion();

        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בפרסום', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDelete = async (updateId: string) => {
        setIsDeleting(updateId);
        try {
            await deleteVersionUpdate(updateId);
            toast({ variant: 'destructive', title: 'העדכון נמחק' });
            await fetchUpdatesAndVersion();
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה במחיקה', description: (error as Error).message });
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="space-y-2 text-right">
                <h1 className="text-3xl font-bold tracking-tight">ניהול "מה חדש?"</h1>
                <p className="text-muted-foreground">כאן תוכל לפרסם עדכונים על גרסאות חדשות ללקוחות שלך.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-end gap-2"><History className="h-5 w-5"/>היסטוריית עדכונים</CardTitle>
                         <CardDescription>רשימת כל העדכונים שפורסמו, מהחדש לישן.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto text-right">
                        {isLoading ? (
                            Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
                        ) : updates.length > 0 ? (
                            updates.map(update => (
                                <div key={update.id} className="p-4 border rounded-lg flex justify-between items-start">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 shrink-0" disabled={isDeleting === update.id}>
                                                {isDeleting === update.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="text-right">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>למחוק את העדכון?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                   פעולה זו תמחק את העדכון לגרסה {update.version} לצמיתות. לא ניתן לבטל פעולה זו.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(update.id)} className="bg-destructive hover:bg-destructive/90">מחק</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <div className="flex-1 text-right mr-2">
                                        <div className="flex justify-end items-baseline gap-4">
                                            <h3 className="font-bold">גרסה {update.version} - {update.title}</h3>
                                            <span className="text-xs text-muted-foreground">{format(new Date(update.createdAt), 'dd/MM/yyyy')}</span>
                                        </div>
                                        <div className="mt-2 text-sm whitespace-pre-wrap pr-4 border-r-2 mr-2">{update.content}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">עדיין לא פורסמו עדכונים.</p>
                        )}
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-end gap-2"><Megaphone className="h-5 w-5"/>פרסום עדכון חדש</CardTitle>
                        <CardDescription>מלא את הטופס כדי לפרסם עדכון למשתמשים. מספר הגרסה יתעדכן אוטומטית.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-right">
                        <div className="p-3 border rounded-md bg-muted/30">
                            <div className="flex justify-between text-sm">
                                <span className="font-mono">{currentVersion || <Skeleton className="h-4 w-12 inline-block"/>}</span>
                                <span>הגרסה הנוכחית:</span>
                            </div>
                             <div className="flex justify-between text-sm font-bold">
                                <span className="font-mono">{nextVersion || <Skeleton className="h-4 w-12 inline-block"/>}</span>
                                <span>הגרסה שתישמר:</span>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="title">כותרת העדכון</Label>
                            <Input id="title" placeholder="כותרת קצרה שתופסת את העין" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="content">תוכן ופירוט השינויים</Label>
                            <Textarea id="content" placeholder="פרט על השינויים, תיקונים וחידושים בגרסה זו..." rows={6} value={content} onChange={e => setContent(e.target.value)} />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handlePublish} disabled={isSaving || isLoading} className="w-full">
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            פרסם עדכון
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
