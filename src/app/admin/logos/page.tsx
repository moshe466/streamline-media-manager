'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, Trash2, ImagePlay, Image as ImageIcon } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { type Logo, getLogos, addLogo, deleteLogo } from '@/services/flussonic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AdminLogosPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [logos, setLogos] = useState<Logo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actioningLogo, setActioningLogo] = useState<string | null>(null);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Form state
  const [logoName, setLogoName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fetchLogos = async () => {
    setIsLoading(true);
    try {
        const fetchedLogos = await getLogos();
        setLogos(fetchedLogos);
    } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאה', description: (error as Error).message || 'לא ניתן לטעון את רשימת הלוגואים.' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogos();
  }, []);
  
  const resetForm = () => {
      setLogoName('');
      setLogoFile(null);
      setLogoPreview(null);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setLogoFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
              setLogoPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  }

  const handleCreateLogo = async () => {
    if (!logoName || !logoFile) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא בחר שם וקובץ לוגו." });
      return;
    }
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(logoFile);
      reader.onload = async (event) => {
        const base64Content = (event.target?.result as string).split(',')[1];
        if (!base64Content) {
          throw new Error("Failed to read file content.");
        }
        
        const result = await addLogo(logoName, base64Content, logoFile.type);
        if (result.success) {
            toast({ title: "הצלחה", description: `הלוגו ${logoName} נוצר בהצלחה.` });
            setCreateDialogOpen(false);
            resetForm();
            fetchLogos();
        } else {
            throw new Error(result.error || 'אירעה שגיאה לא צפויה.');
        }
        setIsProcessing(false);
      };
      reader.onerror = () => {
          throw new Error("Error reading file.");
      }
    } catch (error) {
        if (error instanceof Error) {
             toast({ variant: "destructive", title: "שגיאה ביצירת לוגו", description: error.message });
        }
        setIsProcessing(false);
    }
  }

  const handleDeleteLogo = async (logo: Logo) => {
     setActioningLogo(logo.name);
     try {
        const result = await deleteLogo(logo.name);
        if (result.success) {
            toast({ variant: "destructive", title: "לוגו נמחק", description: `${logo.name} הוסר מהמערכת.` });
            fetchLogos();
        } else {
             toast({ variant: "destructive", title: "שגיאה", description: result.error || "לא ניתן היה למחוק את הלוגו." });
        }
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
     } finally {
        setActioningLogo(null);
     }
  }
  
  return (
    <div className="space-y-8 text-right">
      <div className="flex items-center justify-between">
        <Dialog open={createDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setCreateDialogOpen(isOpen); }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="ml-2 h-4 w-4" />
              הוסף לוגו
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] text-right">
            <DialogHeader>
              <DialogTitle>הוספת לוגו חדש</DialogTitle>
              <DialogDescription>
                העלה תמונת לוגו (מומלץ PNG עם רקע שקוף) ותן לה שם לזיהוי.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Input id="logoName" placeholder="לדוגמה: MizrachiTV Logo" className="col-span-3" dir="rtl" value={logoName} onChange={(e) => setLogoName(e.target.value)} />
                <Label htmlFor="logoName" className="text-right">שם הלוגו</Label>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Input id="logoFile" type="file" accept="image/png, image/jpeg, image/gif" className="col-span-3" onChange={handleFileChange} />
                <Label htmlFor="logoFile" className="text-right">קובץ תמונה</Label>
              </div>
              {logoPreview && (
                  <div className="col-span-4 flex justify-center p-4 border rounded-md bg-muted">
                      <Image src={logoPreview} alt="תצוגה מקדימה" width={150} height={150} style={{ objectFit: 'contain' }} />
                  </div>
              )}
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                <Button onClick={handleCreateLogo} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    הוסף לוגו
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">ניהול לוגואים (Overlays)</h1>
          <p className="text-muted-foreground">הוספה, צפייה ומחיקה של לוגואים לשימוש בשידורים.</p>
        </div>
      </div>

       <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            הלוגואים שלי
            <ImagePlay className="h-5 w-5" />
          </CardTitle>
          <CardDescription>אלו הלוגואים הזמינים בשרת. הלוגואים אינם משוייכים לערוץ ספציפי בשלב זה.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
             </div>
           ) : logos.length > 0 ? (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {logos.map((logo) => (
                    <Card key={logo.name} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="truncate" title={logo.name}>{logo.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex items-center justify-center bg-muted/30 p-4">
                            <Image 
                                src={`data:${logo.content_type};base64,${logo.content}`}
                                alt={logo.name}
                                width={150}
                                height={150}
                                className="max-w-full max-h-24 object-contain"
                            />
                        </CardContent>
                        <CardFooter className="p-2 border-t">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full" disabled={actioningLogo === logo.name}>
                                        {actioningLogo === logo.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        <span className="mr-2">מחק</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="text-right">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            פעולה זו תמחק את הלוגו <strong>{logo.name}</strong> לצמיתות מהשרת.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteLogo(logo)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            כן, מחק
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
           ) : (
             <div className="text-center py-16">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">לא נמצאו לוגואים</h3>
                <p className="mt-2 text-sm text-muted-foreground">התחל על ידי הוספת הלוגו הראשון שלך.</p>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
