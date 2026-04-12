
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UploadCloud, File, Paperclip, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadClientDocumentAction, listClientDocuments, deleteClientDocument } from '@/services/storage';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getClientById, type Client } from '@/services/clients';

type UploadedFile = {
    name: string;
    url: string;
    timeCreated: string;
    fullPath: string;
};

export default function AdminClientUploadsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = decodeURIComponent(params.clientId as string);

    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [client, setClient] = useState<Client | null>(null);
    const [actioningFile, setActioningFile] = useState<string | null>(null);


    const fetchPageData = useCallback(async () => {
        if (!clientId) return;
        setIsLoadingList(true);
        try {
            const [files, clientData] = await Promise.all([
                listClientDocuments(clientId),
                getClientById(clientId)
            ]);

            if (!clientData) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן למצוא את פרטי הלקוח.' });
                router.push('/admin/clients');
                return;
            }
            setClient(clientData);

            files.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
            setUploadedFiles(files);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת הקבצים.' });
        } finally {
            setIsLoadingList(false);
        }
    }, [clientId, toast, router]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

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
        formData.append('uploadedBy', 'admin'); // Indicate upload is from admin

        try {
            const result = await uploadClientDocumentAction(formData);
            if (result.success) {
                toast({ title: 'העלאה הושלמה', description: `הקובץ "${selectedFile.name}" הועלה בהצלחה.` });
                setSelectedFile(null);
                (document.getElementById('document-upload') as HTMLInputElement).value = '';
                await fetchPageData(); // Refresh the list of files
            } else {
                throw new Error(result.error || "An unknown error occurred during upload.");
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה בהעלאה', description: (e as Error).message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (filePath: string) => {
        setActioningFile(filePath);
        try {
            const result = await deleteClientDocument(filePath);
            if(result.success) {
                toast({ title: "הקובץ נמחק", variant: "destructive" });
                await fetchPageData();
            } else {
                 throw new Error(result.error || "An unknown error occurred during deletion.");
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'שגיאה במחיקה', description: (e as Error).message });
        } finally {
            setActioningFile(null);
        }
    }

    if (isLoadingList) {
      return (
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-40" />
                    <div className="text-right">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-48 mt-2" />
                    </div>
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                           <Skeleton className="h-12 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                 <Button asChild variant="outline">
                    <Link href="/admin/clients">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לרשימת הלקוחות
                    </Link>
                </Button>
                <div className="space-y-2 text-right">
                    <h1 className="text-3xl font-bold tracking-tight">מסמכים עבור: {client?.nickname}</h1>
                    <p className="text-muted-foreground">
                        כאן תוכל לנהל מסמכים עבור הלקוח.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>העלאת קובץ חדש</CardTitle>
                    <CardDescription>בחר קובץ מהמחשב שלך. הקובץ יהיה זמין לצפייה אצל הלקוח.</CardDescription>
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
                        העלה קובץ ללקוח
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>המסמכים של {client?.nickname}</CardTitle>
                    <CardDescription>רשימת הקבצים בחשבון הלקוח, מהחדש לישן.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingList ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
                        </div>
                    ) : uploadedFiles.length > 0 ? (
                        <div className="space-y-2">
                            {uploadedFiles.map(file => (
                                <div key={file.url} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={actioningFile === file.fullPath} className="text-destructive hover:text-destructive/80">
                                                    {actioningFile === file.fullPath ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="text-right">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>למחוק את הקובץ?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        הקובץ "{file.name}" יימחק לצמיתות מהשרת. לא ניתן לבטל פעולה זו.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(file.fullPath)} className="bg-destructive hover:bg-destructive/90">מחק לצמיתות</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button asChild variant="outline" size="sm">
                                            <a href={file.url} target="_blank" rel="noopener noreferrer">צפה</a>
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 text-right">
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{file.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                הועלה בתאריך: {format(new Date(file.timeCreated), 'dd/MM/yyyy HH:mm')}
                                            </span>
                                        </div>
                                        <Paperclip className="h-4 w-4 text-primary"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">עדיין לא הועלו קבצים עבור לקוח זה.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
