
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, PlusCircle, Trash2, Edit, Loader2, Save, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getGlobalDestinations, saveGlobalDestinations, type GlobalPushDestination } from '@/services/global-destinations';
import Link from 'next/link';

const destinationSchema = z.object({
  name: z.string().min(2, "שם היעד חייב להכיל לפחות 2 תווים."),
  rtmp_url: z.string().url("כתובת RTMP לא תקינה.").or(z.literal('')),
  stream_key: z.string().optional(),
}).refine(data => data.rtmp_url || data.stream_key, {
  message: "יש למלא לפחות כתובת RTMP או מפתח הזרמה.",
  path: ["rtmp_url"],
});

type DestinationFormValues = z.infer<typeof destinationSchema>;
type DialogMode = 'create' | 'edit';

export default function AdminGlobalDestinationsPage() {
    const { toast } = useToast();
    const [destinations, setDestinations] = useState<GlobalPushDestination[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<DialogMode>('create');
    const [editingDest, setEditingDest] = useState<GlobalPushDestination | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const form = useForm<DestinationFormValues>({
        resolver: zodResolver(destinationSchema),
        defaultValues: { name: '', rtmp_url: '', stream_key: '' },
    });

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getGlobalDestinations();
        setDestinations(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openDialog = (mode: DialogMode, dest: GlobalPushDestination | null = null) => {
        setDialogMode(mode);
        setEditingDest(dest);
        if (mode === 'edit' && dest) {
            form.reset({ name: dest.name, rtmp_url: dest.rtmp_url, stream_key: dest.stream_key });
        } else {
            form.reset({ name: '', rtmp_url: '', stream_key: '' });
        }
        setDialogOpen(true);
    };

    const handleFormSubmit = async (data: DestinationFormValues) => {
        setIsSaving(true);
        let updated = [...destinations];

        if (dialogMode === 'create') {
            const newDest: GlobalPushDestination = { id: `global_dest_${Date.now()}`, ...data, stream_key: data.stream_key ?? "" };
            updated.push(newDest);
        } else if (dialogMode === 'edit' && editingDest) {
            updated = updated.map(d => d.id === editingDest.id ? { ...d, ...data, stream_key: data.stream_key ?? "" } : d);
        }

        const result = await saveGlobalDestinations(updated);
        if (result.success) {
            toast({ title: "הבנק עודכן בהצלחה" });
            setDestinations(updated);
            setDialogOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'שגיאה בשמירה', description: result.error });
        }
        setIsSaving(false);
    };
    
    const handleBulkDelete = async () => {
        setIsSaving(true);
        const updated = destinations.filter(d => !selectedIds.includes(d.id));
        const result = await saveGlobalDestinations(updated);
        if (result.success) {
            toast({ variant: 'destructive', title: `${selectedIds.length} יעדים נמחקו` });
            setDestinations(updated);
            setSelectedIds([]);
        } else {
            toast({ variant: 'destructive', title: 'שגיאה במחיקה', description: result.error });
        }
        setIsSaving(false);
    };

    if (isLoading) return <div className="p-8"><Skeleton className="w-full h-64" /></div>;

    return (
        <div className="space-y-8 text-right">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold tracking-tight">בנק יעדים גלובלי</h1>
                    <p className="text-muted-foreground">נהל רשימת יעדי RTMP המשותפים לכל המערכת.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/admin/dashboard"><ArrowRight className="ml-2 h-4 w-4" />חזרה</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row-reverse justify-between items-center gap-4">
                         <div className="flex items-center gap-2">
                            {selectedIds.length > 0 ? (
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive"><Trash2 className="ml-2 h-4 w-4"/>מחק ({selectedIds.length})</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="text-right">
                                        <AlertDialogHeader><AlertDialogTitle>האם למחוק {selectedIds.length} יעדים?</AlertDialogTitle></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">מחק</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                <Button onClick={() => openDialog('create')}><PlusCircle className="ml-2 h-4 w-4" />הוסף יעד חדש</Button>
                            )}
                         </div>
                        <CardTitle>יעדים שמורים במערכת</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {destinations.length > 0 ? (
                        destinations.map(dest => (
                            <Card key={dest.id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex-1 text-right w-full">
                                    <p className="font-bold">{dest.name}</p>
                                    <p className="text-sm text-muted-foreground dir-ltr text-right truncate">{dest.rtmp_url}/{dest.stream_key}</p>
                                </div>
                                <div className="flex items-center justify-end sm:justify-start gap-2 w-full sm:w-auto">
                                    <Checkbox
                                        checked={selectedIds.includes(dest.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedIds(prev => checked ? [...prev, dest.id] : prev.filter(id => id !== dest.id));
                                        }}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => openDialog('edit', dest)}><Edit className="h-4 w-4"/></Button>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <Target className="mx-auto h-10 w-10"/>
                            <p className="mt-2">עדיין לא הוספת יעדים גלובליים.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md text-right">
                    <DialogHeader><DialogTitle>{dialogMode === 'create' ? 'הוספת יעד חדש' : 'עריכת יעד'}</DialogTitle></DialogHeader>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">שם היעד (לזיהוי)</Label>
                            <Input id="name" {...form.register('name')} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="rtmp_url">כתובת RTMP</Label>
                            <Input id="rtmp_url" dir="ltr" {...form.register('rtmp_url')} placeholder="rtmp://a.rtmp.youtube.com/live2" />
                            {form.formState.errors.rtmp_url && <p className="text-sm text-destructive">{form.formState.errors.rtmp_url.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stream_key">מפתח הזרמה (Stream Key)</Label>
                            <Input id="stream_key" dir="ltr" {...form.register('stream_key')} placeholder="xxxx-xxxx-xxxx-xxxx" />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
