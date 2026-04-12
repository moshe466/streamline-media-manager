
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from '@/components/ui/skeleton';
import { type QuickLink, getQuickLinks, addQuickLink, updateQuickLink, deleteQuickLink } from '@/services/quick-links';

type DialogMode = 'create' | 'edit';
type EditingLink = QuickLink | null;

export default function AdminLinksPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [links, setLinks] = useState<QuickLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actioningLink, setActioningLink] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('create');
  const [editingLink, setEditingLink] = useState<EditingLink>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('Link2');


  const fetchLinks = async () => {
    setIsLoading(true);
    const fetchedLinks = await getQuickLinks();
    setLinks(fetchedLinks);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setUrl('');
    setIcon('Link2');
    setEditingLink(null);
  }

  const openDialog = (mode: DialogMode, link: EditingLink = null) => {
    setDialogMode(mode);
    if (mode === 'edit' && link) {
        setEditingLink(link);
        setTitle(link.title);
        setDescription(link.description);
        setUrl(link.url);
        setIcon(link.icon || 'Link2');
    } else {
        resetForm();
    }
    setDialogOpen(true);
  }

  const handleDialogSubmit = async () => {
    if (!title || !url) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא מלא כותרת וכתובת URL." });
      return;
    }
    setIsProcessing(true);
    
    try {
      const linkData = { title, description, url, icon };
      if (dialogMode === 'create') {
        await addQuickLink(linkData);
        toast({ title: "הצלחה", description: "הקישור החדש נוסף." });
      } else if (dialogMode === 'edit' && editingLink) {
        await updateQuickLink(editingLink.id, linkData);
         toast({ title: "הצלחה", description: "הקישור עודכן." });
      }
      
      setDialogOpen(false);
      resetForm();
      fetchLinks();

    } catch (error) {
        if (error instanceof Error) {
             toast({ variant: "destructive", title: "שגיאה", description: error.message });
        } else {
            toast({ variant: "destructive", title: "שגיאה", description: "אירעה שגיאה לא צפויה." });
        }
    } finally {
        setIsProcessing(false);
    }
  }

  const handleDeleteLink = async (link: QuickLink) => {
     setActioningLink(link.id);
     try {
        await deleteQuickLink(link.id);
        toast({ variant: "destructive", title: "קישור נמחק", description: `${link.title} הוסר מהמערכת.` });
        fetchLinks();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את הקישור." });
     } finally {
        setActioningLink(null);
     }
  }

  return (
    <div className="space-y-8 text-right">
      <div className="flex items-center justify-between">
        <Dialog open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setDialogOpen(isOpen); }}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog('create')}>
              <PlusCircle className="ml-2 h-4 w-4" />
              הוסף קישור
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] text-right">
            <DialogHeader>
                <DialogTitle>{dialogMode === 'create' ? 'הוספת קישור חדש' : 'עריכת קישור'}</DialogTitle>
                <DialogDescription>
                    {dialogMode === 'create' ? 'מלא את הפרטים ליצירת קישור חדש.' : `ערוך את הפרטים עבור ${editingLink?.title}.`}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">כותרת</Label>
                <Input id="title" placeholder="Flussonic Admin" dir="rtl" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="description">תיאור</Label>
                <Input id="description" placeholder="ניהול שרת השידורים" dir="rtl" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">כתובת (URL)</Label>
                <Input id="url" placeholder="https://example.com" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="icon">שם אייקון (Lucide)</Label>
                <Input id="icon" placeholder="Link2" dir="ltr" value={icon} onChange={(e) => setIcon(e.target.value)} />
                <p className="text-xs text-muted-foreground">מצא שמות אייקונים ב: <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="underline">lucide.dev</a></p>
              </div>
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                <Button onClick={handleDialogSubmit} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    {dialogMode === 'create' ? 'הוסף קישור' : 'שמור שינויים'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">ניהול קישורים מהירים</h1>
          <p className="text-muted-foreground">הוספה, עריכה או הסרה של קישורים בלוח המחוונים.</p>
        </div>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>כל הקישורים</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="responsive-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-right">פעולות</TableHead>
                <TableHead className="text-right">כותרת</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">כתובת</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell data-label="פעולות"><Skeleton className="h-8 w-8" /></TableCell>
                    <TableCell data-label="כותרת"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell data-label="תיאור"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell data-label="כתובת"><Skeleton className="h-5 w-40" /></TableCell>
                  </TableRow>
                ))
              ) : links.length > 0 ? (
                links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell data-label="פעולות">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningLink === link.id}>
                                    {actioningLink === link.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                    <span className="sr-only">פתח תפריט</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-right">
                                <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openDialog('edit', link)}>
                                    <Edit className="ml-2 h-4 w-4" />
                                    <span>ערוך קישור</span>
                                </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                <Trash2 className="ml-2 h-4 w-4" />
                                                <span>מחק קישור</span>
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="text-right">
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                פעולה זו תמחק את הקישור <strong>{link.title}</strong> לצמיתות.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteLink(link)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    כן, מחק את הקישור
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    <TableCell data-label="כותרת" className="font-medium">{link.title}</TableCell>
                    <TableCell data-label="תיאור">{link.description}</TableCell>
                    <TableCell data-label="כתובת" dir="ltr" className="text-left font-mono text-xs">{link.url}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        לא הוגדרו קישורים. לחץ על 'הוסף קישור' כדי להתחיל.
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
