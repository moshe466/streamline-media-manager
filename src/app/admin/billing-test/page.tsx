
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Copy, ClipboardCheck, UserSearch, Users } from 'lucide-react';
import Link from 'next/link';
import { testMorningConnectionAction } from '@/actions/test-morning-action';
import { findClientByVatId, findClientsByName, type MorningClient } from '@/services/morning';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const DataRow = ({ label, value }: { label: string; value: string | number | undefined | null }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex justify-between items-center text-sm py-1.5 border-b border-border/50">
            <span className="font-mono text-muted-foreground">{value}</span>
            <span className="font-medium">{label}</span>
        </div>
    );
};


export default function BillingTestPage() {
    const { toast } = useToast();
    
    const [connectionResult, setConnectionResult] = useState<{success: boolean; message?: string; error?: string} | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isCopied, setIsCopied] = useState(false);
    
    // State for VAT ID search tool
    const [searchId, setSearchId] = useState('');
    const [isSearchingById, setIsSearchingById] = useState(false);
    const [searchedClient, setSearchedClient] = useState<MorningClient | null | undefined>(undefined);

    // State for Name search tool
    const [searchName, setSearchName] = useState('');
    const [isSearchingByName, setIsSearchingByName] = useState(false);
    const [searchedClientsByName, setSearchedClientsByName] = useState<MorningClient[] | null>(null);


    useEffect(() => {
        const checkConnection = async () => {
            setIsLoadingStatus(true);
            const result = await testMorningConnectionAction();
            setConnectionResult(result);
            setIsLoadingStatus(false);
        };
        
        checkConnection();
    }, []);
    
    const handleIdSearch = async () => {
        if (!searchId.trim()) {
            toast({ variant: 'destructive', title: 'נדרש מספר זיהוי', description: 'אנא הזן מספר עוסק / ת.ז. לחיפוש.' });
            return;
        }
        setIsSearchingById(true);
        setSearchedClient(undefined);
        try {
            const client = await findClientByVatId(searchId); 
            setSearchedClient(client);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בחיפוש', description: (error as Error).message });
            setSearchedClient(null);
        } finally {
            setIsSearchingById(false);
        }
    };
    
    const handleNameSearch = async () => {
        if (!searchName.trim()) {
            toast({ variant: 'destructive', title: 'נדרש שם לחיפוש' });
            return;
        }
        setIsSearchingByName(true);
        setSearchedClientsByName(null);
        try {
            const clients = await findClientsByName(searchName);
            setSearchedClientsByName(clients);
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה בחיפוש', description: (error as Error).message });
            setSearchedClientsByName([]);
        } finally {
            setIsSearchingByName(false);
        }
    };

    const renderConnectionResult = () => {
        if (isLoadingStatus) {
            return (
                <div className="flex items-center justify-end gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="font-bold text-lg">בודק חיבור...</span>
                </div>
            );
        }
        if (connectionResult?.success) {
            return (
                <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-6 w-6" />
                    <span className="font-bold text-lg">חיבור תקין</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-6 w-6" />
                <span className="font-bold text-lg">כשל בחיבור</span>
            </div>
        );
    };

    const handleCopy = (data: any) => {
        if (!data) return;
        const logText = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(logText).then(() => {
            setIsCopied(true);
            toast({ title: 'הלוג הועתק ללוח' });
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-8 text-right">
            <div className="flex items-center justify-between">
                <Button asChild variant="outline">
                    <Link href="/admin/development">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        חזרה לכלי פיתוח
                    </Link>
                </Button>
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">בדיקות חיוב וחשבוניות</h1>
                    <p className="text-muted-foreground">אבחון וניטור התקשורת עם מערכת Morning.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-end gap-3">
                        {renderConnectionResult()}
                        <CardTitle>חיבור למערכת Morning</CardTitle>
                    </div>
                    <CardDescription>
                        הבדיקה מנסה לאמת את המפתחות מול שירות Morning ולקבל טוקן גישה.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="p-4 bg-muted rounded-md border text-right dir-ltr">
                        <div className="flex justify-between items-center mb-2">
                             <Button variant="ghost" size="icon" onClick={() => handleCopy(connectionResult)} disabled={!connectionResult}>
                                {isCopied ? <ClipboardCheck className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </Button>
                            <h4 className="text-lg font-semibold text-right">לוג מהבדיקה:</h4>
                        </div>
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                           {isLoadingStatus ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                connectionResult ? JSON.stringify(connectionResult, null, 2) : "אין נתונים להצגה."
                            )}
                        </pre>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        בדיקת קיום לקוח (לפי מספר מזהה)
                        <UserSearch className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>הזן מספר עוסק / ח.פ / ת.ז כדי לבדוק אם הלקוח כבר קיים במערכת החיובים.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <Button onClick={handleIdSearch} disabled={isSearchingById}>
                            {isSearchingById ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UserSearch className="ml-2 h-4 w-4" />}
                            חפש
                        </Button>
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="search-id">מספר זיהוי</Label>
                            <Input id="search-id" value={searchId} onChange={(e) => setSearchId(e.target.value)} dir="ltr" />
                        </div>
                    </div>
                </CardContent>
                 {isSearchingById && (
                    <CardFooter><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>מחפש...</div></CardFooter>
                 )}
                 {searchedClient !== undefined && (
                    <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                       {searchedClient ? (
                            <div className="w-full">
                                <h3 className="font-semibold text-lg text-green-500 flex items-center justify-end gap-2">
                                    <CheckCircle2 className="h-5 w-5" />
                                    נמצא לקוח!
                                </h3>
                                <div className="mt-4 space-y-2 p-4 border rounded-md bg-muted">
                                    <DataRow label="שם" value={searchedClient.name} />
                                    <DataRow label="אימייל" value={searchedClient.email} />
                                    <DataRow label="טלפון" value={searchedClient.phone} />
                                    <DataRow label="מספר זיהוי (במורנינג)" value={searchedClient.id} />
                                    <DataRow label="כתובת" value={searchedClient.address} />
                                </div>
                            </div>
                       ) : (
                           <div className="w-full text-center">
                                <h3 className="font-semibold text-lg text-red-500 flex items-center justify-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    לא נמצא לקוח
                                </h3>
                                <p className="text-muted-foreground mt-2">
                                    לא נמצא לקוח עם מספר הזיהוי שהוזן במערכת Morning.
                                </p>
                           </div>
                       )}
                    </CardFooter>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-end gap-2">
                        חיפוש לקוחות (לפי שם)
                        <Users className="h-5 w-5" />
                    </CardTitle>
                    <CardDescription>הזן שם כדי לחפש לקוחות תואמים במערכת החיובים.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <Button onClick={handleNameSearch} disabled={isSearchingByName}>
                            {isSearchingByName ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Users className="ml-2 h-4 w-4" />}
                            חפש
                        </Button>
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="search-name">שם לקוח</Label>
                            <Input id="search-name" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
                 {isSearchingByName && (
                    <CardFooter><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>מחפש...</div></CardFooter>
                 )}
                 {searchedClientsByName && (
                    <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                        <h3 className="font-semibold text-lg">
                            {searchedClientsByName.length > 0
                                ? `נמצאו ${searchedClientsByName.length} לקוחות:`
                                : `לא נמצאו לקוחות בשם "${searchName}"`}
                        </h3>
                       {searchedClientsByName.length > 0 && (
                            <div className="w-full space-y-3">
                                {searchedClientsByName.map(client => (
                                     <div key={client.id} className="p-4 border rounded-md bg-muted">
                                        <DataRow label="שם" value={client.name} />
                                        <DataRow label="מספר זיהוי" value={client.taxId} />
                                        <DataRow label="אימייל" value={client.email} />
                                        <DataRow label="טלפון" value={client.phone} />
                                     </div>
                                ))}
                            </div>
                       )}
                    </CardFooter>
                )}
            </Card>

        </div>
    );
}
