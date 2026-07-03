
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientDetails, type Client, type PushDestination } from '@/services/clients';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, PlusCircle, Trash2, Edit, Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';


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

export default function ClientDestinationsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<DialogMode>('create');
    const [editingLink, setEditingLink] = useState<PushDestination | null>(null);
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);


    const form = useForm<DestinationFormValues>({
        resolver: zodResolver(destinationSchema),
        defaultValues: { name: '', rtmp_url: '', stream_key: '' },
    });

    useEffect(() => {
        const clientDataString = sessionStorage.getItem('clientData');
        if (clientDataString) {
            setClient(JSON.parse(clientDataString));
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון את פרטי הלקוח.' });
            router.push(`/client/${clientId}/dashboard`);
        }
        setIsLoading(false);
    }, [clientId, router, toast]);

    const openDialog = (mode: DialogMode, dest: PushDestination | null = null) => {
        setDialogMode(mode);
        setEditingLink(dest);
        if (mode === 'edit' && dest) {
            form.reset({ name: dest.name, rtmp_url: dest.rtmp_url, stream_key: dest.stream_key });
        } else {
            form.reset({ name: '', rtmp_url: '', stream_key: '' });
        }
        setDialogOpen(true);
    };

    const handleFormSubmit = async (data: DestinationFormValues) => {
        if (!client) return;
        setIsSaving(true);
        let updatedDestinations = [...(client.pushDestinations || [])];

        if (dialogMode === 'create') {
            const newDest: PushDestination = { id: `dest_${Date.now()}`, ...data, stream_key: data.stream_key ?? "" };
            updatedDestinations.push(newDest);
        } else if (dialogMode === 'edit' && editingLink) {
            updatedDestinations = updatedDestinations.map(d => d.id === editingLink.id ? { ...d, ...data } : d);
        }

        try {
            const result = await updateClientDetails(clientId, { pushDestinations: updatedDestinations });
            if (result) {
                toast({ title: "השינויים נשמרו בהצלחה!" });
                setClient(result);
                sessionStorage.setItem('clientData', JSON.stringify(result));
                window.dispatchEvent(new Event('clientDataUpdated'));
                setDialogOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'שגיאה בשמירת היעדים' });
            }
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleBulkDelete = async () => {
        if (!client || selectedDestinations.length === 0) return;
        setIsSaving(true);
        const updatedDestinations = (client.pushDestinations || []).filter(d => !selectedDestinations.includes(d.id));
         try {
             const result = await updateClientDetails(clientId, { pushDestinations: updatedDestinations });
            if (result) {
                toast({ variant: 'destructive', title: `${selectedDestinations.length} יעדים נמחקו` });
                setClient(result);
                sessionStorage.setItem('clientData', JSON.stringify(result));
                window.dispatchEvent(new Event('clientDataUpdated'));
                setSelectedDestinations([]);
            } else {
                toast({ variant: 'destructive', title: 'שגיאה במחיקת היעדים' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    }


    if (isLoading) {
        return <div className="p-8"><Skeleton className="w-full h-64" /></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                <div className="space-y-2 text-left"><h1 className="text-3xl font-bold tracking-tight">בנק יעדי הזרמה</h1><p className="text-muted-foreground">נהל רשימת יעדי RTMP שמורים לשימוש מהיר בשידורים שלך.</p></div>
                <div><Button asChild variant="outline"><Link href={`/client/${clientId}/dashboard`}><ArrowRight className="ml-2 h-4 w-4" />חזרה ללוח הבקרה</Link></Button></div>
            </div>

            <Card>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                         <div className="flex items-center gap-2">
                            {selectedDestinations.length > 0 ? (
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive"><Trash2 className="ml-2 h-4 w-4"/>מחק ({selectedDestinations.length})</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="text-right">
                                        <AlertDialogHeader><AlertDialogTitle>האם למחוק {selectedDestinations.length} יעדים?</AlertDialogTitle></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>ביטול</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">מחק</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            ) : (
                                <Button onClick={() => openDialog('create')}><PlusCircle className="ml-2 h-4 w-4" />הוסף יעד חדש</Button>
                            )}
                         </div>
                        <CardTitle>היעדים השמורים שלי</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {client?.pushDestinations && client.pushDestinations.length > 0 ? (
                        client.pushDestinations.map(dest => (
                            <Card key={dest.id} className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex-1 text-right w-full">
                                    <p className="font-bold">{dest.name}</p>
                                    <p className="text-sm text-muted-foreground dir-ltr text-right truncate">{dest.rtmp_url}/{dest.stream_key}</p>
                                </div>
                                <div className="flex items-center justify-end sm:justify-start gap-2 w-full sm:w-auto">
                                    <Checkbox
                                        checked={selectedDestinations.includes(dest.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedDestinations(prev => 
                                                checked ? [...prev, dest.id] : prev.filter(id => id !== dest.id)
                                            );
                                        }}
                                        id={`select-${dest.id}`}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => openDialog('edit', dest)}><Edit className="h-4 w-4"/></Button>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground"><Target className="mx-auto h-10 w-10"/><p className="mt-2">עדיין לא הוספת יעדים שמורים.</p></div>
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
