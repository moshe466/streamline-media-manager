
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Server, PlusCircle, Edit, Trash2, Globe, Layout, Loader2, Save, X } from 'lucide-react';
import { getInstances, upsertInstance, type AppInstance } from '@/services/instances';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function InstancesManagementPage() {
    const { toast } = useToast();
    const [instances, setInstances] = useState<AppInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [flussonicHost, setFlussonicHost] = useState('');
    const [flussonicUser, setFlussonicUser] = useState('');
    const [flussonicPass, setFlussonicPass] = useState('');

    const fetchInstancesData = async () => {
        setIsLoading(true);
        const data = await getInstances();
        setInstances(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchInstancesData();
    }, []);

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setDomain('');
        setLogoUrl('');
        setFlussonicHost('');
        setFlussonicUser('');
        setFlussonicPass('');
    };

    const handleEdit = (instance: AppInstance) => {
        setEditingId(instance.id);
        setName(instance.name);
        setDomain(instance.domain || '');
        setLogoUrl(instance.logoUrl || '');
        setFlussonicHost(instance.flussonicHost || '');
        setFlussonicUser(instance.flussonicUsername || '');
        setFlussonicPass(instance.flussonicPassword || '');
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!name || (!editingId && !name)) {
            toast({ variant: 'destructive', title: 'שדות חסרים' });
            return;
        }

        setIsSaving(true);
        const id = editingId || name.toLowerCase().replace(/\s/g, '_');
        
        const result = await upsertInstance({
            id,
            name,
            domain,
            logoUrl,
            flussonicHost,
            flussonicUsername: flussonicUser,
            flussonicPassword: flussonicPass,
        });

        if (result.success) {
            toast({ title: 'השרת נשמר בהצלחה' });
            setIsDialogOpen(false);
            resetForm();
            fetchInstancesData();
        } else {
            toast({ variant: 'destructive', title: 'שגיאה בשמירה', description: result.error });
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-8 text-right">
            <div className="flex items-center justify-between">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            הוסף שרת חדש
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg text-right">
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'עריכת שרת' : 'הוספת שרת חדש'}</DialogTitle>
                            <DialogDescription>הגדר את פרטי השרת, הדומיין והמיתוג שלו.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                                <Label htmlFor="name" className="text-right">שם תצוגה</Label>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="domain" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="col-span-3" dir="ltr" />
                                <Label htmlFor="domain" className="text-right">דומיין</Label>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="col-span-3" dir="ltr" />
                                <Label htmlFor="logo" className="text-right">לינק ללוגו</Label>
                            </div>
                            <Separator className="my-2" />
                            <h4 className="font-semibold flex items-center justify-end gap-2">הגדרות Flussonic <Server className="h-4 w-4" /></h4>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="host" placeholder="http://1.2.3.4" value={flussonicHost} onChange={(e) => setFlussonicHost(e.target.value)} className="col-span-3" dir="ltr" />
                                <Label htmlFor="host" className="text-right">כתובת IP</Label>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="user" value={flussonicUser} onChange={(e) => setFlussonicUser(e.target.value)} className="col-span-3" />
                                <Label htmlFor="user" className="text-right">שם משתמש</Label>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Input id="pass" type="password" value={flussonicPass} onChange={(e) => setFlussonicPass(e.target.value)} className="col-span-3" />
                                <Label htmlFor="pass" className="text-right">סיסמה</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                שמור הגדרות
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">ניהול שרתים ומופעים</h1>
                    <p className="text-muted-foreground">הגדרת דומיינים, מיתוג וחיבורי Flussonic לכל שרת בנפרד.</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>שרתים קיימים</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">פעולות</TableHead>
                                <TableHead className="text-right">IP שרת</TableHead>
                                <TableHead className="text-right">דומיין</TableHead>
                                <TableHead className="text-right">שם השרת</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center">טוען...</TableCell></TableRow>
                            ) : instances.map(instance => (
                                <TableRow key={instance.id}>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(instance)}><Edit className="h-4 w-4" /></Button>
                                    </TableCell>
                                    <TableCell dir="ltr" className="text-right">{instance.flussonicHost || '-'}</TableCell>
                                    <TableCell dir="ltr" className="text-right">{instance.domain || '-'}</TableCell>
                                    <TableCell className="font-bold">{instance.name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
