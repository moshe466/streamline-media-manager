
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Wand2, ArrowRight, GripVertical, Edit, Trash2, Save, Music, Upload, Loader2, Play, Pause, Image as ImageIcon, EyeOff, Eye } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { uploadTourAssetAction, saveTourData, getTourData, type TourData, type TourStep } from '@/services/storage';
import NextImage from 'next/image';
import { Switch } from '@/components/ui/switch';

export default function VirtualTourAdminPage() {
    const router = useRouter();
    const { toast } = useToast();

    const [tourData, setTourData] = useState<TourData>({ steps: [], musicUrl: null, isEnabled: true });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
    const [currentStep, setCurrentStep] = useState<Partial<TourStep> | null>(null);
    const [isUploadingStepImage, setIsUploadingStepImage] = useState(false);
    
    const audioRef = React.useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await getTourData();
                setTourData(data);
            } catch (error) {
                toast({ variant: 'destructive', title: 'שגיאה בטעינת נתוני הסיור' });
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [toast]);
    
    const handleSaveData = async (updatedData: Partial<TourData>) => {
        setIsSaving(true);
        const result = await saveTourData(updatedData);
        if (!result.success) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את השינויים.' });
        }
        setIsSaving(false);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => { dragItem.current = index; };
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => { dragOverItem.current = index; };
    const handleDragEnd = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const newTourSteps = [...tourData.steps];
            const dragItemContent = newTourSteps.splice(dragItem.current, 1)[0];
            newTourSteps.splice(dragOverItem.current, 0, dragItemContent);
            setTourData(prev => ({ ...prev, steps: newTourSteps }));
            handleSaveData({ steps: newTourSteps });
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const handleOpenDialog = (mode: 'add' | 'edit', step?: TourStep) => {
        setDialogMode(mode);
        setCurrentStep(step || { title: '', intro: '', image: null });
        setIsDialogOpen(true);
    };

    const handleSaveStep = () => {
        if (!currentStep || !currentStep.title) {
            toast({variant: 'destructive', title: "שדה חובה", description: "יש להזין כותרת לשלב."});
            return;
        }

        let newSteps;
        if (dialogMode === 'add') {
            const newStep: TourStep = { id: `step_${Date.now()}`, title: currentStep.title, intro: currentStep.intro || '', image: currentStep.image || null };
            newSteps = [...tourData.steps, newStep];
        } else {
            newSteps = tourData.steps.map(step => step.id === currentStep.id ? { ...step, ...currentStep } as TourStep : step);
        }
        setTourData(prev => ({ ...prev, steps: newSteps }));
        handleSaveData({ steps: newSteps });
        setIsDialogOpen(false);
        setCurrentStep(null);
    };

    const handleDeleteStep = (stepId: string) => {
        const newSteps = tourData.steps.filter(step => step.id !== stepId);
        setTourData(prev => ({ ...prev, steps: newSteps }));
        handleSaveData({ steps: newSteps });
        toast({ variant: 'destructive', title: 'השלב נמחק' });
    };

    const handleMusicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsLoading(true); // Re-use isLoading for music upload
        try {
            const formData = new FormData();
            formData.append('assetFile', file);
            formData.append('assetType', 'music');
            const result = await uploadTourAssetAction(formData);
            if (result.success && result.publicUrl) {
                setTourData(prev => ({ ...prev, musicUrl: result.publicUrl ?? null }));
                await handleSaveData({ musicUrl: result.publicUrl ?? null });
                toast({ title: 'המוזיקה הועלתה והוגדרה בהצלחה!' });
            } else { throw new Error(result.error || 'העלאת הקובץ נכשלה.'); }
        } catch (error) { toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (error as Error).message }); } finally { setIsLoading(false); }
    };

     const handleStepImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploadingStepImage(true);
        try {
            const formData = new FormData();
            formData.append('assetFile', file);
            formData.append('assetType', 'image');
            const result = await uploadTourAssetAction(formData);
            if (result.success && result.publicUrl) {
                setCurrentStep(s => ({...s, image: result.publicUrl}));
            } else { throw new Error(result.error || 'העלאת התמונה נכשלה.'); }
        } catch (error) { toast({ variant: 'destructive', title: 'שגיאה בהעלאת תמונה', description: (error as Error).message }); } finally { setIsUploadingStepImage(false); }
    };

    const toggleAudio = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };
    
    if (isLoading) {
        return (
             <div className="space-y-8 text-right">
                <div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-80" /></div></div>
                <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
            </div>
        )
    }

    return (
        <div className="space-y-8 text-right">
             <div className="flex items-center justify-between">
                <Button asChild variant="outline"><Link href="/admin/development"><ArrowRight className="ml-2 h-4 w-4" />חזרה לכלי פיתוח</Link></Button>
                <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">ניהול סיור וירטואלי</h1><p className="text-muted-foreground">ערוך, סדר והעלה תמונות לשלבי הסיור.</p></div>
            </div>
            
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg text-right"><DialogHeader><DialogTitle>{dialogMode === 'add' ? 'הוספת שלב חדש' : 'עריכת שלב'}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="step-title">כותרת</Label><Input id="step-title" value={currentStep?.title || ''} onChange={(e) => setCurrentStep(s => ({...s, title: e.target.value}))} /></div>
                        <div className="space-y-2"><Label htmlFor="step-intro">תוכן/הסבר</Label><Textarea id="step-intro" value={currentStep?.intro || ''} onChange={(e) => setCurrentStep(s => ({...s, intro: e.target.value}))} rows={4}/></div>
                        <div className="space-y-2"><Label htmlFor="step-image">תמונת השלב</Label>
                            <div className="flex items-center gap-4">
                                <Button asChild variant="outline"><Label htmlFor="step-image-upload" className="cursor-pointer">{isUploadingStepImage ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Upload className="ml-2 h-4 w-4"/>}העלה תמונה</Label></Button>
                                <Input id="step-image-upload" type="file" accept="image/*" className="sr-only" onChange={handleStepImageUpload} disabled={isUploadingStepImage}/>
                                <div className="w-24 h-16 rounded-md border bg-muted flex items-center justify-center">
                                    {currentStep?.image ? <NextImage src={currentStep.image} alt="תצוגה מקדימה" width={96} height={64} style={{objectFit: 'contain'}} unoptimized/> : <ImageIcon className="h-6 w-6 text-muted-foreground"/>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleSaveStep}><Save className="ml-2 h-4 w-4" />שמור שלב</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                 <div className="lg:col-span-2">
                     <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <Button onClick={() => handleOpenDialog('add')} disabled={isSaving}><PlusCircle className="ml-2 h-4 w-4" />הוסף שלב</Button>
                                <CardTitle className="flex items-center justify-end gap-2"><Wand2 className="h-5 w-5" />שלבי הסיור ({tourData.steps.length}) {isSaving && <Loader2 className="h-4 w-4 animate-spin"/>}</CardTitle>
                            </div>
                            <CardDescription>סדר את השלבים בגרירה. השינויים נשמרים אוטומטית.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {tourData.steps.map((step, index) => (
                                <div key={step.id} className="p-4 flex items-center justify-between hover:bg-muted/30 border rounded-md" draggable onDragStart={(e) => handleDragStart(e, index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}>
                                   <div className="flex items-center gap-2">
                                       <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteStep(step.id)} disabled={isSaving}><Trash2 className="h-4 w-4"/></Button>
                                       <Button variant="ghost" size="icon" onClick={() => handleOpenDialog('edit', step)} disabled={isSaving}><Edit className="h-4 w-4"/></Button>
                                    </div>
                                   <div className="flex-1 mx-4 min-w-0 text-right"><p className="font-bold">{step.title}</p><p className="text-sm text-muted-foreground truncate">{step.intro}</p></div>
                                   <div className="flex items-center gap-2">
                                       <div className="w-20 h-12 rounded-md border bg-muted flex items-center justify-center">
                                           {step.image ? <NextImage src={step.image} alt="תצוגה מקדימה" width={80} height={48} style={{objectFit: 'contain'}} unoptimized /> : <ImageIcon className="h-5 w-5 text-muted-foreground"/>}
                                       </div>
                                       <span className="text-lg font-bold text-muted-foreground">{index + 1}</span>
                                       <Button variant="ghost" size="icon" className="cursor-grab"><GripVertical className="h-5 w-5"/></Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                 </div>
                 <div className="lg:col-span-1 space-y-8">
                     <Card>
                        <CardHeader><CardTitle className="flex items-center justify-end gap-2"><Music className="h-5 w-5"/>מוזיקת רקע</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {tourData.musicUrl && <audio ref={audioRef} src={tourData.musicUrl} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} loop />}
                            <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                {tourData.musicUrl && <Button size="icon" variant="ghost" onClick={toggleAudio}>{isPlaying ? <Pause className="h-4 w-4"/> : <Play className="h-4 w-4"/>}</Button>}
                                <p className="flex-1 text-xs truncate text-right">{tourData.musicUrl ? 'מוזיקה הוגדרה' : 'לא נבחרה מוזיקה'}</p>
                            </div>
                            <Button asChild className="w-full" variant="outline"><Label className="cursor-pointer">{isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Upload className="ml-2 h-4 w-4"/>}{isLoading ? 'מעלה...' : 'העלה / החלף מוזיקה'}<Input type="file" className="sr-only" accept="audio/*" onChange={handleMusicUpload} disabled={isLoading}/></Label></Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="flex items-center justify-end gap-2"><Eye className="h-5 w-5"/>נראות הסיור</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <Switch
                                    id="tour-enabled"
                                    checked={tourData.isEnabled}
                                    onCheckedChange={(checked) => {
                                        setTourData(prev => ({...prev, isEnabled: checked}));
                                        handleSaveData({ isEnabled: checked });
                                    }}
                                    disabled={isSaving}
                                />
                                <Label htmlFor="tour-enabled" className="flex items-center gap-2">
                                    הפעל סיור וירטואלי ללקוחות
                                </Label>
                            </div>
                        </CardContent>
                    </Card>
                 </div>
            </div>
        </div>
    );
}
