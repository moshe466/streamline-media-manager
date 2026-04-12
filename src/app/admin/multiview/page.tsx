'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, X, Tv, Loader2, ExternalLink, Copy } from 'lucide-react';
import { getStreams, type FlussonicStream, getFlussonicConnectionDetails } from '@/services/flussonic';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getUserById, updateUser, type MultiviewSettings } from '@/services/users';
import { createMultiviewRequest } from '@/services/multiview-tokens';


export default function MultiviewPage() {
    const { toast } = useToast();
    const [allStreams, setAllStreams] = useState<FlussonicStream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedStreamNames, setSelectedStreamNames] = useState<string[]>([]);
    const [gridColumns, setGridColumns] = useState<number>(3);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreparingWindow, setIsPreparingWindow] = useState(false);
    
    const [tempSelectedNames, setTempSelectedNames] = useState<string[]>([]);
    const [tempGridColumns, setTempGridColumns] = useState<number>(3);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const adminId = sessionStorage.getItem('userId');
            if (!adminId) throw new Error("Admin user ID not found.");

            const [streams, adminUser] = await Promise.all([
                getStreams(),
                getUserById(adminId)
            ]);
            setAllStreams(streams);
            
            const savedSettings = adminUser?.multiviewSettings;
            if (savedSettings) {
                const validStreams = savedSettings.selectedStreams.filter(name => streams.some(s => s.name === name));
                setSelectedStreamNames(validStreams);
                setGridColumns(savedSettings.gridColumns || 3);
                setTempSelectedNames(validStreams);
                setTempGridColumns(savedSettings.gridColumns || 3);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את הנתונים.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);
    
    const handleOpenSettings = () => {
        setTempSelectedNames(selectedStreamNames);
        setTempGridColumns(gridColumns);
        setIsSettingsOpen(true);
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        const adminId = sessionStorage.getItem('userId');
        if (!adminId) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לזהות את המשתמש.' });
            setIsSaving(false);
            return;
        }

        const newSettings: MultiviewSettings = {
            selectedStreams: tempSelectedNames,
            gridColumns: tempGridColumns
        };

        try {
            await updateUser(adminId, { multiviewSettings: newSettings });
            setSelectedStreamNames(tempSelectedNames);
            setGridColumns(tempGridColumns);
            setIsSettingsOpen(false);
            toast({ title: 'ההגדרות נשמרו', description: 'התצוגה עודכנה.' });
        } catch(error) {
            toast({ variant: 'destructive', title: 'שגיאה בשמירה', description: (error as Error).message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleGenerateAndOpen = async () => {
        if (selectedStreamNames.length === 0) {
            toast({ variant: 'destructive', title: 'לא נבחרו שידורים', description: 'יש לבחור לפחות שידור אחד בהגדרות.' });
            return;
        }
        setIsPreparingWindow(true);
        try {
            // Generate a random ID instead of using Node's crypto
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            const playerUrl = `/multiview-player?reqId=${requestId}`;
            window.open(playerUrl, '_blank', 'toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes');

            const result = await createMultiviewRequest(requestId, {
                selectedStreams: selectedStreamNames,
                gridColumns: gridColumns
            });

            if (!result.success) {
                throw new Error(result.error || "Failed to create a multiview request on the server.");
            }
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה ביצירת חלון צפייה', description: (error as Error).message });
        } finally {
            setIsPreparingWindow(false);
        }
    };
    
    const mobileGridTemplateColumns = `repeat(${Math.min(gridColumns, 2)}, minmax(0, 1fr))`;

    if (isLoading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full md:hidden" />
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 space-y-4 text-right">
            {/* Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-2xl text-right"><DialogHeader><DialogTitle>הגדרות תצוגה מרובה</DialogTitle><DialogDescription>בחר אילו שידורים להציג וקבע את פריסת הרשת.</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-6">
                        <div>
                             <Label className="text-base font-semibold">בחר שידורים (נבחרו: {tempSelectedNames.length})</Label>
                            <ScrollArea className="h-64 w-full rounded-md border p-4 mt-2"><div className="space-y-2">
                                {allStreams.map(stream => (<div key={stream.name} className="flex items-center justify-end gap-2">
                                    <Label htmlFor={stream.name} className="flex-1 text-right">{stream.name}</Label>
                                    <Checkbox id={stream.name} checked={tempSelectedNames.includes(stream.name)} onCheckedChange={(checked) => { setTempSelectedNames(prev => checked ? [...prev, stream.name] : prev.filter(name => name !== stream.name)); }} />
                                </div>))}
                            </div></ScrollArea>
                        </div>
                        <div>
                            <Label className="text-base font-semibold">בחר פריסה</Label>
                            <ToggleGroup type="single" value={String(tempGridColumns)} onValueChange={(val) => val && setTempGridColumns(Number(val))} className="grid grid-cols-4 gap-2 mt-2">
                                {[1, 2, 3, 4, 6, 8, 9, 12].map(cols => (<ToggleGroupItem key={cols} value={String(cols)} className="h-12 text-lg">{cols}</ToggleGroupItem>))}
                            </ToggleGroup>
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose><Button onClick={handleSaveSettings} disabled={isSaving}>{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}שמור וסגור</Button></DialogFooter>
                </DialogContent>
            </Dialog>

             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-right sm:text-left w-full">
                    <h1 className="text-3xl font-bold tracking-tight">Multiview</h1>
                    <p className="text-muted-foreground">צפה במספר שידורים במקביל.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="secondary" onClick={handleGenerateAndOpen} disabled={isPreparingWindow} className="flex-1 sm:flex-none">
                        {isPreparingWindow ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ExternalLink className="ml-2 h-4 w-4" />}
                        פתח בחלון נפרד
                    </Button>
                    <Button onClick={handleOpenSettings} variant="outline" className="flex-1 sm:flex-none"><Settings className="ml-2 h-4 w-4" />הגדרות</Button>
                </div>
            </div>
            
            {selectedStreamNames.length > 0 ? (
                <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: mobileGridTemplateColumns }}>
                    {Array.from({ length: gridColumns * gridColumns }).slice(0, selectedStreamNames.length).map((_, index) => (
                        <div key={index} className="aspect-video relative group bg-muted/50 rounded-md flex flex-col items-center justify-center border-2 border-dashed">
                           <Tv className="h-8 w-8 text-muted-foreground"/>
                           <p className="text-xs text-muted-foreground mt-2">{selectedStreamNames[index] || `נגן ${index + 1}`}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-muted/50 rounded-lg">
                    <Tv className="h-16 w-16 text-muted-foreground" /><p className="mt-4 text-lg font-semibold">לא נבחרו שידורים לתצוגה.</p><p className="text-muted-foreground">לחץ על כפתור "הגדרות" כדי להתחיל.</p>
                </div>
            )}
        </div>
    );
}
