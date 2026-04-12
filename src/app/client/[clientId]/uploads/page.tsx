
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UploadCloud, File, Paperclip, CheckCircle, AlertTriangle, Loader2, Trash2, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadClientDocumentAction, listClientDocuments } from '@/services/storage';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type UploadedFile = {
    name: string;
    url: string;
    timeCreated: string;
};

export default function ClientUploadsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    const fetchUploadedFiles = useCallback(async () => {
        if (!clientId) return;
        setIsLoadingList(true);
        try {
            const files = await listClientDocuments(clientId);
             // Sort files by creation date, newest first
            files.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
            setUploadedFiles(files);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת הקבצים.' });
        } finally {
            setIsLoadingList(false);
        }
    }, [clientId, toast]);

    useEffect(() => {
        fetchUploadedFiles();
    }, [fetchUploadedFiles]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !clientId) {
            toast({ variant: 'destructive', title: 'לא נבחר קובץ', description: 'יש לבחור קובץ להעלאה.' });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('documentFile', selectedFile);
        formData.append('clientId', clientId);
        formData.append('uploadedBy', 'client'); // Indicate upload is from client


        try {
            const result = await uploadClientDocumentAction(formData);
            if (result.success) {
                toast({ title: 'העלאה הושלמה', description: `הקובץ "${selectedFile.name}" הועלה בהצלחה.` });
                setSelectedFile(null);
                // Clear the file input
                (document.getElementById('document-upload') as HTMLInputElement).value = '';
                await fetchUploadedFiles(); // Refresh the list of files
            } else {
                throw new Error(result.error || "An unknown error occurred during upload.");
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (e as Error).message });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href={`/client/${clientId}/dashboard`}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה ללוח הבקרה
                    </Link>
                </Button>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">תשלומים והעלאת קבצים</h1>
                    <p className="text-muted-foreground">
                        כאן תוכל להעלות אישורי תשלום או כל מסמך אחר לחשבונך.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>העלאת קובץ חדש</CardTitle>
                    <CardDescription>בחר קובץ מהמחשב שלך ולחץ על "העלה".</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="document-upload">בחירת קובץ</Label>
                        <Input id="document-upload" type="file" onChange={handleFileSelect} />
                    </div>
                    {selectedFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md bg-muted/30">
                            <File className="h-4 w-4" />
                            <span>קובץ שנבחר: <strong>{selectedFile.name}</strong></span>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                        {isUploading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        <UploadCloud className="ml-2 h-4 w-4" />
                        העלה קובץ
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>המסמכים שלי</CardTitle>
                    <CardDescription>רשימת הקבצים שהעלית לחשבון, מהחדש לישן.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingList ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : uploadedFiles.length > 0 ? (
                        <div className="space-y-2">
                            {uploadedFiles.map(file => (
                                <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-md transition-colors">
                                    <Button variant="ghost" size="sm">צפה בקובץ</Button>
                                    <div className="flex items-center gap-2 text-right">
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                הועלה בתאריך: {format(new Date(file.timeCreated), 'dd/MM/yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <Paperclip className="h-4 w-4 text-primary"/>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">עדיין לא העלית קבצים.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
