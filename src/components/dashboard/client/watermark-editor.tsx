

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { uploadUserAssetAction, deleteFileAction } from '@/services/storage';
import { updateClientDetails, type Client, type WatermarkSettings } from '@/services/clients';
import { Loader2, Upload, Trash2, Save, Pipette } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from '@/components/ui/switch';


interface WatermarkEditorProps {
  client: Client;
  setClient: React.Dispatch<React.SetStateAction<Client | null>>;
}

const DEFAULT_SETTINGS: WatermarkSettings = {
    url: null,
    position: { x: 80, y: 5 },
    size: 15,
    opacity: 0.8,
    displayMode: 'image',
};

export function WatermarkEditor({ client, setClient }: WatermarkEditorProps) {
    const { toast } = useToast();
    const [settings, setSettings] = useState<WatermarkSettings>(client.watermarkSettings || DEFAULT_SETTINGS);
    const [isProcessing, setIsProcessing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Local state for pixel-based editing to avoid jumps
    const [editState, setEditState] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    // Effect to initialize or update the pixel-based state when settings or container change
    useEffect(() => {
        if (settings.url && containerRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const containerHeight = containerRef.current.offsetHeight;
            const widthInPixels = (settings.size / 100) * containerWidth;

            // This needs the image's aspect ratio to calculate height correctly.
            // We'll approximate or use a fixed aspect ratio for now. A better solution would load the image to get its dimensions.
            const img = new window.Image();
            img.src = settings.url;
            img.onload = () => {
                 const aspectRatio = img.naturalWidth / img.naturalHeight;
                 const heightInPixels = widthInPixels / aspectRatio;
                 setEditState({
                    x: (settings.position.x / 100) * containerWidth,
                    y: (settings.position.y / 100) * containerHeight,
                    width: widthInPixels,
                    height: heightInPixels,
                });
            }
        } else {
            setEditState(null);
        }
    }, [settings.url, settings.position, settings.size]);
    
     useEffect(() => {
        setSettings(client.watermarkSettings || DEFAULT_SETTINGS);
    }, [client.watermarkSettings]);

    const handleFileChangeAndUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/png')) {
            toast({ variant: 'destructive', title: 'קובץ לא נתמך', description: 'יש להעלות קובץ בפורמט PNG בלבד.' });
            return;
        }

        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', client.id);
            formData.append('fileType', 'watermark');

            const uploadResult = await uploadUserAssetAction(formData);

            if (!uploadResult.success || !uploadResult.publicUrl) {
                throw new Error(uploadResult.error || "Failed to upload new watermark image.");
            }
            
            const newWatermarkSettings: WatermarkSettings = {
                ...DEFAULT_SETTINGS, // Start with defaults
                url: uploadResult.publicUrl,
            };

            const updatedClient = await updateClientDetails(client.id, { watermarkSettings: newWatermarkSettings });
            
            setClient(updatedClient);
            setSettings(newWatermarkSettings); 

            sessionStorage.setItem('clientData', JSON.stringify(updatedClient));
            window.dispatchEvent(new Event('clientDataUpdated'));

            toast({ title: "הלוגו הועלה בהצלחה!", description: "כעת תוכל למקם אותו ולשמור את ההגדרות." });

        } catch (error) {
            toast({ variant: "destructive", title: "שגיאה בהעלאה", description: (error as Error).message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSaveSettings = async () => {
        setIsProcessing(true);
        try {
            if (!settings.url || !containerRef.current || !editState) {
                throw new Error("No watermark or editor state to save.");
            }
            
            const bounds = containerRef.current.getBoundingClientRect();

            // Convert final pixel state back to percentages for saving
            const finalSettings: WatermarkSettings = {
                ...settings, // This includes the current opacity and displayMode
                url: settings.url,
                size: (editState.width / bounds.width) * 100,
                position: {
                    x: (editState.x / bounds.width) * 100,
                    y: (editState.y / bounds.height) * 100,
                }
            };

            const updatedClient = await updateClientDetails(client.id, { watermarkSettings: finalSettings });
            setClient(updatedClient);
            setSettings(finalSettings); // Update the main settings state
            sessionStorage.setItem('clientData', JSON.stringify(updatedClient));
            window.dispatchEvent(new Event('clientDataUpdated'));
            toast({ title: "הגדרות סימן המים נשמרו!" });
        } catch (error) {
            toast({ variant: "destructive", title: "שגיאה בשמירה", description: (error as Error).message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async () => {
        if (!client.watermarkSettings?.url) return;
        setIsProcessing(true);
        try {
            const urlPath = new URL(client.watermarkSettings.url).pathname;
            const fullPath = decodeURIComponent(urlPath.substring(urlPath.indexOf('/', 1) + 1));
            deleteFileAction(fullPath).catch(console.warn);
            const updatedClient = await updateClientDetails(client.id, { watermarkSettings: null });
            setClient(updatedClient);
            sessionStorage.setItem('clientData', JSON.stringify(updatedClient));
            window.dispatchEvent(new Event('clientDataUpdated'));
            setSettings(DEFAULT_SETTINGS);
            setEditState(null);
            toast({ title: "סימן המים הוסר" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בהסרה', description: (error as Error).message });
        } finally {
            setIsProcessing(false);
        }
    };


    const onDragStop = (e: any, d: any) => {
        setEditState(s => s ? { ...s, x: d.x, y: d.y } : null);
    };

    const onResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
       setEditState(s => s ? {
           ...s,
           width: ref.offsetWidth,
           height: ref.offsetHeight,
           x: position.x,
           y: position.y
       } : null);
    };

    if (!settings.url) {
        return (
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg h-48">
                <p className="text-sm text-muted-foreground mb-4">העלה קובץ PNG כדי להתחיל.</p>
                <Button asChild variant="outline" disabled={isProcessing}>
                    <Label htmlFor="watermark-upload" className="cursor-pointer">
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Upload className="ml-2 h-4 w-4" />}
                        העלה סימן מים
                    </Label>
                </Button>
                <Input id="watermark-upload" type="file" accept="image/png" className="sr-only" onChange={handleFileChangeAndUpload} disabled={isProcessing} />
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <div className="aspect-video w-full bg-black rounded-md relative overflow-hidden border" ref={containerRef}>
                {settings.url && containerRef.current && editState && (
                    <Rnd
                        size={{
                            width: editState.width,
                            height: editState.height,
                        }}
                        position={{
                            x: editState.x,
                            y: editState.y
                        }}
                        onDragStop={onDragStop}
                        onResizeStop={onResizeStop}
                        bounds="parent"
                        lockAspectRatio
                        className="flex items-center justify-center border border-dashed border-white/30"
                    >
                         <Image src={settings.url} alt="Watermark Preview" layout="fill" objectFit="contain" style={{ opacity: settings.opacity }} unoptimized />
                    </Rnd>
                )}
            </div>

            <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-2">
                    <Label>שקיפות</Label>
                    <Slider
                        value={[settings.opacity]}
                        onValueChange={(val) => setSettings(s => ({...s, opacity: val[0]}))}
                        max={1}
                        step={0.05}
                    />
                </div>
                
                <div className="flex items-center justify-between">
                    <Switch
                        id="display-mode-switch"
                        checked={settings.displayMode === 'lines'}
                        onCheckedChange={(checked) => setSettings(s => ({ ...s, displayMode: checked ? 'lines' : 'image' }))}
                    />
                    <Label htmlFor="display-mode-switch" className="flex items-center gap-2">
                         <Pipette className="h-4 w-4" />
                        הצג כקווים נעים על המסך
                    </Label>
                </div>


                <div className="flex justify-between items-center gap-4 pt-4 border-t">
                    <Button asChild variant="outline" size="sm">
                        <Label htmlFor="watermark-replace-upload" className="cursor-pointer">
                            <Upload className="ml-2 h-4 w-4" />
                           החלף תמונה
                        </Label>
                    </Button>
                    <Input id="watermark-replace-upload" type="file" accept="image/png" className="sr-only" onChange={handleFileChangeAndUpload} />
                    
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isProcessing}>
                                <Trash2 className="ml-2 h-4 w-4" />
                                הסר
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="text-right">
                            <AlertDialogHeader><AlertDialogTitle>האם להסיר את סימן המים?</AlertDialogTitle><AlertDialogDescription>פעולה זו תמחק את התמונה וההגדרות לצמיתות.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">כן, הסר</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                     <Button onClick={handleSaveSettings} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
                        שמור הגדרות
                    </Button>
                </div>
            </div>
        </div>
    );
}

    
