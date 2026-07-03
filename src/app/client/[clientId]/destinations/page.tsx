
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

function getDestinationPlatform(dest: PushDestination) {
  const text = ((dest.name || '') + ' ' + (dest.rtmp_url || '')).toLowerCase();

  if (text.includes('youtube') || text.includes('youtu.be') || text.includes('google')) {
    return { label: 'YouTube', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
  }

  if (text.includes('facebook') || text.includes('fb.')) {
    return { label: 'Facebook', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
  }

  if (text.includes('twitch')) {
    return { label: 'Twitch', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
  }

  return { label: 'RTMP', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
}

function maskStreamKey(key?: string) {
  if (!key) return 'ללא מפתח';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

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
            <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950 p-6 shadow-2xl sm:p-8 text-right">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-orange-500/10" />
                <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute -bottom-24 right-20 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />

                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                            <Target className="h-4 w-4 text-cyan-300" />
                            בנק יעדי הזרמה
                        </div>

                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">בנק יעדי הזרמה</h1>
                            <p className="mt-3 max-w-2xl text-lg text-slate-300">
                                ניהול יעדי RTMP שמורים לשימוש מהיר בשידורים שלך.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button onClick={() => openDialog('create')} className="rounded-full bg-cyan-400 text-black hover:bg-cyan-300">
                            <PlusCircle className="ml-2 h-5 w-5" />
                            הוסף יעד חדש
                        </Button>

                        <Button
variant="outline"
className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 min-w-[100px] rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10" asChild>

                            <Link href={`/client/${clientId}/dashboard`}>
                                <ArrowRight className="ml-2 h-4 w-4" />
                                חזרה ללוח הבקרה
                            </Link>
                        
</Button>
                    </div>
                </div>
            </section>

            <Card className="border-cyan-400/10 bg-slate-950/70">
                <CardHeader>
                     <div className="flex flex-col gap-4 text-right">
                        <div className="text-right">
                            <CardTitle className="text-2xl font-black text-white">היעדים השמורים שלי</CardTitle>
                            <CardDescription className="mt-1 text-slate-500">
                                {client?.pushDestinations?.length || 0} יעדים שמורים בבנק היעדים
                            </CardDescription>
                        </div>

                         <div className="flex items-center justify-between gap-2">
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
                                <div className="mr-auto text-sm text-slate-500">בחר יעדים למחיקה או הוסף יעד חדש מהכפתור למעלה</div>
                            )}
                         </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {client?.pushDestinations && client.pushDestinations.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {client.pushDestinations.map(dest => {
                                const platform = getDestinationPlatform(dest);

                                return (
                                    <Card
                                        key={dest.id}
                                        className={
                                            "group overflow-hidden border-white/10 bg-gradient-to-br from-slate-950 to-slate-900/70 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/10 " +
                                            (selectedDestinations.includes(dest.id) ? "border-cyan-400/70 shadow-lg shadow-cyan-500/20" : "")
                                        }
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={selectedDestinations.includes(dest.id)}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedDestinations(prev =>
                                                                checked ? [...prev, dest.id] : prev.filter(id => id !== dest.id)
                                                            );
                                                        }}
                                                        id={`select-${dest.id}`}
                                                    />

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openDialog('edit', dest)}
                                                        className="rounded-full border border-white/10 bg-white/5 text-cyan-300 hover:bg-cyan-400/10"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </div>

                                                <div className="text-right">
                                                    <div className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${platform.className}`}>
                                                        {platform.label}
                                                    </div>
                                                    <h3 className="max-w-[220px] truncate text-xl font-black text-white">{dest.name}</h3>
                                                    <p className="mt-1 text-xs text-slate-500">יעד הזרמה שמור</p>
                                                </div>
                                            </div>

                                            <div className="mt-5 space-y-3">
                                                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 transition group-hover:border-cyan-400/20">
                                                    <p className="text-xs text-slate-500">כתובת RTMP</p>
                                                    <p dir="ltr" className="mt-1 truncate text-sm text-slate-300">{dest.rtmp_url || 'לא הוגדרה כתובת'}</p>
                                                </div>

                                                <div className="rounded-2xl border border-white/10 bg-black/40 p-3 transition group-hover:border-cyan-400/20">
                                                    <p className="text-xs text-slate-500">Stream Key</p>
                                                    <p dir="ltr" className="mt-1 truncate text-sm text-slate-300">{maskStreamKey(dest.stream_key)}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-3xl border border-dashed border-slate-700 bg-black/20 py-16 text-center text-slate-500">
                            <Target className="mx-auto h-12 w-12 text-cyan-300/70" />
                            <p className="mt-3 text-lg font-bold text-white">עדיין לא הוספת יעדים שמורים</p>
                            <p className="mt-1 text-sm">לחץ על “הוסף יעד חדש” כדי ליצור יעד RTMP ראשון.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md text-right border-cyan-400/20 bg-slate-950 text-white">
                    <DialogHeader className="space-y-5 border-b border-cyan-400/20 pb-5">

<div className="flex items-center justify-between">

<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-400/30">
<Target className="h-6 w-6 text-cyan-300"/>
</div>

<div className="text-right">
<DialogTitle className="text-2xl font-black text-white">
{dialogMode==='create'?'הוספת יעד חדש':'עריכת יעד'}
</DialogTitle>

<p className="mt-1 text-sm text-slate-400">
ניהול יעד RTMP לשימוש מהיר בשידורים
</p>
</div>

</div>

</DialogHeader>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 text-right">
                        <div className="space-y-3 text-right">
                            <Label htmlFor="name">שם היעד (לזיהוי)</Label>
                            <Input id="name" {...form.register('name')} className="h-11 rounded-2xl border-cyan-400/20 bg-black/30 text-white focus-visible:ring-cyan-400" placeholder="לדוגמה: יוטיוב ראשי" />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-3 text-right">
                            <Label htmlFor="rtmp_url">כתובת RTMP</Label>
                            <Input id="rtmp_url" dir="ltr" {...form.register('rtmp_url')} className="h-11 rounded-2xl border-cyan-400/20 bg-black/30 text-white focus-visible:ring-cyan-400" placeholder="rtmp://a.rtmp.youtube.com/live2" />
                            {form.formState.errors.rtmp_url && <p className="text-sm text-destructive">{form.formState.errors.rtmp_url.message}</p>}
                        </div>
                        <div className="space-y-3 text-right">
                            <Label htmlFor="stream_key">מפתח הזרמה (Stream Key)</Label>
                            <Input id="stream_key" dir="ltr" {...form.register('stream_key')} className="h-11 rounded-2xl border-cyan-400/20 bg-black/30 text-white focus-visible:ring-cyan-400" placeholder="xxxx-xxxx-xxxx-xxxx" />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose>
                            <Button
type="submit"
className="rounded-full bg-cyan-400 text-black hover:bg-cyan-300 min-w-[120px]"
 disabled={isSaving}>
{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור
</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
