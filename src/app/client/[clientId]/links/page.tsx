
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientLinks, type Client, type ClientLink } from '@/services/clients';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Link as LinkIcon, ExternalLink, PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';


const linkSchema = z.object({
  name: z.string().min(2, { message: "שם הקישור חייב להכיל לפחות 2 תווים." }),
  url: z.string().url({ message: "כתובת ה-URL אינה תקינה." }),
  showToViewers: z.boolean().default(false),
});

type LinkFormValues = z.infer<typeof linkSchema>;
type DialogMode = 'create' | 'edit';

export default function ClientLinksPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<DialogMode>('create');
    const [editingLink, setEditingLink] = useState<ClientLink | null>(null);

    const form = useForm<LinkFormValues>({
        resolver: zodResolver(linkSchema),
        defaultValues: { name: '', url: '', showToViewers: false },
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

    const openDialog = (mode: DialogMode, link: ClientLink | null = null) => {
        setDialogMode(mode);
        setEditingLink(link);
        if (mode === 'edit' && link) {
            form.reset({ name: link.name, url: link.url, showToViewers: link.showToViewers });
        } else {
            form.reset({ name: '', url: '', showToViewers: false });
        }
        setDialogOpen(true);
    };

    const handleFormSubmit = async (data: LinkFormValues) => {
        if (!client) return;
        setIsSaving(true);
        let updatedLinks = [...(client.links || [])];
        if (dialogMode === 'create') {
            const newLink: ClientLink = { id: `link_${Date.now()}`, ...data };
            updatedLinks.push(newLink);
        } else if (dialogMode === 'edit' && editingLink) {
            updatedLinks = updatedLinks.map(l => l.id === editingLink.id ? { ...l, ...data } : l);
        }

        try {
            const result = await updateClientLinks(clientId, updatedLinks);
            if (result.success && result.updatedClient) {
                toast({ title: "השינויים נשמרו בהצלחה!" });
                setClient(result.updatedClient);
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
                window.dispatchEvent(new Event('clientDataUpdated'));
                setDialogOpen(false);
            } else {
                toast({ variant: 'destructive', title: 'שגיאה בשמירת הקישורים', description: result.error || 'אירעה שגיאה לא צפויה.' });
            }
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        if (!client) return;
        setIsSaving(true);
        const updatedLinks = (client.links || []).filter(l => l.id !== linkId);
        try {
            const result = await updateClientLinks(clientId, updatedLinks);
            if (result.success && result.updatedClient) {
                toast({ title: "הקישור נמחק" });
                setClient(result.updatedClient);
                sessionStorage.setItem('clientData', JSON.stringify(result.updatedClient));
                window.dispatchEvent(new Event('clientDataUpdated'));
            } else {
                toast({ variant: 'destructive', title: 'שגיאה במחיקת הקישור', description: result.error || 'אירעה שגיאה לא צפויה.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-8"><Skeleton className="w-full h-64" /></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                     <Button asChild variant="outline">
                        <Link href={`/client/${clientId}/dashboard`}>
                           <ArrowRight className="ml-2 h-4 w-4" />
                            חזרה ללוח הבקרה
                        </Link>
                    </Button>
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">ניהול לינקים שימושיים</h1>
                    <p className="text-muted-foreground">
                        הוסף, ערוך ומחק קישורים אישיים. תוכל לבחור אילו מהם יוצגו לצופים שלך.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                     <div className="flex items-center justify-between">
                         <Button onClick={() => openDialog('create')}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            הוסף לינק חדש
                        </Button>
                        <CardTitle>רשימת הלינקים שלך</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {client?.links && client.links.length > 0 ? (
                        client.links.map(link => (
                            <Card key={link.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="text-right">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>האם למחוק את הקישור "{link.name}"?</AlertDialogTitle>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteLink(link.id)} className="bg-destructive hover:bg-destructive/90">מחק</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button variant="ghost" size="icon" onClick={() => openDialog('edit', link)}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="ml-2 h-4 w-4"/>
                                            פתח
                                        </a>
                                    </Button>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{link.name}</p>
                                    <p className="text-sm text-muted-foreground">{link.url}</p>
                                    {link.showToViewers && <p className="text-xs text-primary">גלוי לצופים</p>}
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <LinkIcon className="mx-auto h-10 w-10"/>
                            <p className="mt-2">עדיין לא הוספת קישורים.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md text-right">
                    <DialogHeader>
                        <DialogTitle>{dialogMode === 'create' ? 'הוספת לינק חדש' : 'עריכת לינק'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">שם הלינק</Label>
                            <Input id="name" {...form.register('name')} />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="url">כתובת הלינק</Label>
                            <Input id="url" dir="ltr" {...form.register('url')} />
                            {form.formState.errors.url && <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>}
                        </div>
                         <div className="flex items-center justify-end gap-2 pt-2">
                            <Label htmlFor="showToViewers">להציג לצופים?</Label>
                            <Switch id="showToViewers" checked={form.watch('showToViewers')} onCheckedChange={(checked) => form.setValue('showToViewers', checked)} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                                שמור
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
