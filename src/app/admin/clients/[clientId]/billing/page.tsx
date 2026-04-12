

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, AlertTriangle, Edit, PlusCircle, Download, Banknote, Check, Loader2, Trash2, Save, MoreHorizontal, FilePlus2, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { getClientById, type Client } from '@/services/clients';
import { getDocuments, type MorningDocument, createDocument, createMonthlyPriceQuote } from '@/services/morning';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';


type DocumentType = 'price-quote' | 'order' | 'pro-forma' | 'invoice' | 'invoice-receipt' | 'receipt';
type PaymentType = 'cash' | 'credit-card' | 'bank-transfer' | 'cheque' | 'other';


interface DocItem {
    id: string;
    description: string;
    quantity: number;
    price: number;
    sku: string;
    discount: number;
    discountType: 'percentage' | 'amount';
    vatType: 'before' | 'after';
    isSaved: boolean; // New property
}

interface PaymentItem {
    type: PaymentType;
    date: string;
    amount: number;
    details?: {
        cardType?: number;
        last4Digits?: string;
        bankName?: string;
        accountNumber?: string;
        branchNumber?: string;
    };
}


const documentTypeMapping: Record<DocumentType, number> = {
    'price-quote': 10,
    'order': 100,
    'pro-forma': 300,
    'invoice': 305,
    'invoice-receipt': 320,
    'receipt': 400
};

const paymentTypeMapping: Record<PaymentType, number> = {
    'credit-card': 3,
    'bank-transfer': 2,
    'cash': 1,
    'cheque': 4,
    'other': 0
};

const paymentTypeText: Record<PaymentType, string> = {
    'credit-card': 'כרטיס אשראי',
    'bank-transfer': 'העברה בנקאית',
    'cash': 'מזומן',
    'cheque': 'צ\'ק',
    'other': 'אחר'
};


const getDocumentTypeText = (type: MorningDocument['type']) => {
    switch(type) {
        case 10: return 'הצעת מחיר';
        case 100: return 'הזמנה';
        case 300: return 'חשבון עסקה';
        case 305: return 'חשבונית מס';
        case 320: return 'חשבונית מס קבלה';
        case 400: return 'קבלה';
        default: return `מסמך (${type})`;
    }
};

const getStatusInfo = (doc: MorningDocument): { text: string; className: string } => {
    switch (doc.type) {
        case 320: // חשבונית מס קבלה
        case 400: // קבלה
            return { text: 'שולם', className: 'bg-green-600 text-primary-foreground border-transparent' };
        case 10: // הצעת מחיר
             if (doc.status === 'draft') {
                return { text: 'טיוטה', className: 'bg-muted-foreground' };
            }
            if (doc.status === 'closed') {
                return { text: 'סגור', className: 'bg-blue-600 text-primary-foreground border-transparent' };
            }
            return { text: 'הצעת מחיר', className: 'bg-yellow-500 text-secondary-foreground border-transparent' };
        case 100: // הזמנה
             if (doc.status === 'closed') {
                return { text: 'סגור', className: 'bg-blue-600 text-primary-foreground border-transparent' };
            }
            return { text: 'הזמנה', className: 'bg-orange-500 text-secondary-foreground border-transparent' };
        default:
            switch (doc.status) {
                case 'paid': return { text: 'שולם', className: 'bg-green-600 text-primary-foreground border-transparent' };
                case 'pending': return { text: 'ממתין', className: 'bg-blue-500 text-primary-foreground border-transparent' };
                case 'late': return { text: 'באיחור', className: 'bg-red-600 text-destructive-foreground border-transparent' };
                case 'open': return { text: '', className: '' }; // Default badge style
                 case 'draft': return { text: 'טיוטה', className: 'bg-muted-foreground' };
                default: return { text: doc.status, className: 'bg-muted-foreground' };
            }
    }
};


export default function ClientBillingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = decodeURIComponent(params.clientId as string);

  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<MorningDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  
  // State for new document dialog
  const [isNewDocDialogOpen, setIsNewDocDialogOpen] = useState(false);
  const [newDocType, setNewDocType] = useState<DocumentType | null>(null);
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [docRemarks, setDocRemarks] = useState('');
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [currentTab, setCurrentTab] = useState('items');

  const [monthlyQuote, setMonthlyQuote] = useState<MorningDocument | null>(null);


  const handleAddItem = () => {
    setDocItems([...docItems, { id: `item_${Date.now()}`, description: '', quantity: 1, price: 0, sku: '', discount: 0, discountType: 'amount', vatType: 'before', isSaved: false }]);
  };

  const handleItemChange = (id: string, field: keyof DocItem, value: string | number | boolean) => {
      setDocItems(prevItems => prevItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSaveItem = (id: string) => {
      const itemToSave = docItems.find(item => item.id === id);
      if (!itemToSave || !itemToSave.description || itemToSave.price <= 0) {
        toast({ variant: "destructive", title: "שדות חסרים", description: "יש למלא תיאור ומחיר תקין לפני שמירת הפריט." });
        return;
      }
      handleItemChange(id, 'isSaved', true);
  };

  const handleRemoveItem = (id: string) => {
    setDocItems(prevItems => prevItems.filter(item => item.id !== id));
  };


  const handlePaymentChange = (index: number, field: keyof PaymentItem, value: any) => {
    const newPayments = [...payments];
    // @ts-ignore
    newPayments[index][field] = value;
    setPayments(newPayments);
  };

  
  const docTotal = useMemo(() => docItems.reduce((acc, item) => {
      const itemTotal = Number(item.quantity) * Number(item.price);
      let itemDiscount = Number(item.discount);
      if (item.discountType === 'percentage') {
          itemDiscount = itemTotal * (itemDiscount / 100);
      }
      return acc + (itemTotal - itemDiscount);
  }, 0), [docItems]);
  
  const docTotalWithVat = useMemo(() => docTotal * 1.17, [docTotal]);
  
  const openNewDocDialog = (type: DocumentType) => {
      setNewDocType(type);
      setDocItems([]);
      setDocRemarks('');
      setCurrentTab('items'); // Always reset to the items tab first
      
      if (type === 'invoice-receipt' || type === 'receipt') {
        setPayments([{ type: 'cash', date: format(new Date(), 'yyyy-MM-dd'), amount: docTotalWithVat, details: {} }]);
      } else {
        setPayments([]);
      }
      setIsNewDocDialogOpen(true);
  };
  
  // Update payment amount whenever docTotal changes
  useEffect(() => {
    if (payments.length === 1) { // Only auto-update if there's a single payment
      setPayments(p => [{ ...p[0], amount: docTotalWithVat }]);
    }
  }, [docTotalWithVat, payments.length]);

  const getNewDocDialogTitle = () => {
    switch (newDocType) {
        case 'price-quote': return 'יצירת הצעת מחיר חדשה';
        case 'order': return 'יצירת הזמנה חדשה';
        case 'pro-forma': return 'יצירת חשבון עסקה חדש';
        case 'receipt': return 'יצירת קבלה חדשה';
        case 'invoice': return 'יצירת חשבונית מס חדשה';
        case 'invoice-receipt': return 'יצירת חשבונית מס קבלה חדשה';
        default: return 'יצירת מסמך חדש';
    }
  };
  
  const fetchDocuments = async (currentClient: Client) => {
       if (currentClient.idNumber && currentClient.idNumber.trim() !== '') {
          const morningDocs = await getDocuments(currentClient.idNumber, currentClient.createdAt);
          setDocuments(morningDocs);
           // Find the most recent monthly quote
          const monthlyBillingDescription = `חיוב חודשי קבוע עבור שירותי מדיה`;
          const latestMonthlyQuote = morningDocs
              .filter(doc => doc.type === 10 && doc.description === monthlyBillingDescription)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          setMonthlyQuote(latestMonthlyQuote || null);
        } else {
          setDocuments([]);
          setMonthlyQuote(null);
        }
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) return;
      setIsLoading(true);
      try {
        const clientData = await getClientById(clientId);
        if (!clientData) {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן למצוא את פרטי הלקוח.' });
          router.push('/admin/clients');
          return;
        }
        setClient(clientData);
        await fetchDocuments(clientData);

      } catch (error) {
        toast({ variant: 'destructive', title: 'שגיאה בטעינת נתונים', description: (error as Error).message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [clientId, router, toast]);

  const handleGenerateMonthlyQuote = async () => {
    if (!client || !monthlyAmount) {
      toast({ variant: 'destructive', title: 'שדות חסרים', description: 'יש להזין לקוח וסכום' });
      return;
    }
     if (!client.idNumber || client.idNumber.trim() === '') {
        toast({ variant: 'destructive', title: 'ח.פ חסר', description: 'יש לעדכן מספר עוסק / ח.פ בכרטיס הלקוח לפני הפקת מסמכים.' });
        return;
    }
    setIsProcessingDoc(true);
    try {
        const amount = parseFloat(monthlyAmount);
        const description = `חיוב חודשי קבוע עבור שירותי מדיה`;
        const result = await createMonthlyPriceQuote(client, amount, description);
        if(result.success) {
            toast({ title: 'הצעת מחיר נוצרה', description: `הצעת מחיר מספר ${result.documentNumber} נוצרה במערכת Morning.` });
            await fetchDocuments(client); // Refresh document list
        } else {
            throw new Error(result.error || "An unknown error occurred");
        }
    } catch (e) {
        toast({ variant: 'destructive', title: 'שגיאה ביצירת הצעת מחיר', description: (e as Error).message });
    } finally {
        setIsProcessingDoc(false);
    }
  };

  const handleCreateDocument = async (status: 'draft' | 'open') => {
    if (!client || !newDocType || docItems.some(item => !item.isSaved)) {
        toast({ variant: 'destructive', title: 'שדות חסרים', description: 'יש לשמור את כל הפריטים לפני יצירת המסמך.' });
        return;
    }
     if (!client.idNumber || client.idNumber.trim() === '') {
        toast({ variant: 'destructive', title: 'ח.פ חסר', description: 'יש לעדכן מספר עוסק / ח.פ בכרטיס הלקוח לפני הפקת מסמכים.' });
        return;
    }
    
    if ((newDocType === 'receipt' || newDocType === 'invoice-receipt') && payments.length === 0) {
        toast({ variant: 'destructive', title: 'נדרש תשלום', description: 'יש להוסיף לפחות אמצעי תשלום אחד עבור קבלה.' });
        return;
    }

    setIsProcessingDoc(true);
    try {
      const documentData = {
          docType: documentTypeMapping[newDocType],
          status: status,
          clientId: client.id,
          items: docItems.map(item => ({
              name: item.description,
              price: item.price,
              quantity: item.quantity,
              currency: "ILS", // Assuming ILS for now
              vatType: 'included', // Assuming included for now
              sku: item.sku || undefined,
              discount: {
                amount: item.discount,
                type: item.discountType,
              }
          })),
          payments: (newDocType === 'receipt' || newDocType === 'invoice-receipt')
              ? payments.map(p => ({
                  type: paymentTypeMapping[p.type],
                  date: p.date,
                  amount: p.amount,
                  ...p.details
              }))
              : undefined,
          remarks: docRemarks,
          lang: 'he',
      };
      
      const result = await createDocument(documentData);
      
      if (result.success) {
        toast({ title: `המסמך נוצר בהצלחה`, description: `מסמך מס' ${result.documentId} נוצר במערכת Morning.` });
        setIsNewDocDialogOpen(false);
        await fetchDocuments(client);
      } else {
        throw new Error(result.error || "An unknown error occurred during document creation.");
      }

    } catch (e) {
      toast({ variant: 'destructive', title: 'שגיאה ביצירת מסמך', description: (e as Error).message });
    } finally {
      setIsProcessingDoc(false);
    }
  };

  const handleCreateOrderFromQuote = async (quoteDocId: string) => {
      toast({title: `בקשה ליצירת הזמנה מהצעת מחיר ${quoteDocId} נשלחה...`});
      // Placeholder for the actual API call
      console.log(`TODO: Implement API call to create order from quote ${quoteDocId}`);
  };

  const handleCreateProFormaFromOrder = async (orderDocId: string) => {
      toast({title: `בקשה ליצירת חשבון עסקה מהזמנה ${orderDocId} נשלחה...`});
      // Placeholder for the actual API call
      console.log(`TODO: Implement API call to create pro-forma from order ${orderDocId}`);
  };


  if (isLoading) {
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

  const needsPaymentTab = newDocType === 'receipt' || newDocType === 'invoice-receipt';

  return (
    <div className="space-y-8 text-right">
       <Dialog open={isNewDocDialogOpen} onOpenChange={setIsNewDocDialogOpen}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button disabled={!client?.idNumber}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    צור מסמך חדש
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="text-right">
                    <DropdownMenuItem onSelect={() => openNewDocDialog('price-quote')}>הצעת מחיר</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openNewDocDialog('order')}>הזמנה</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openNewDocDialog('pro-forma')}>חשבון עסקה</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => openNewDocDialog('receipt')}>קבלה</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openNewDocDialog('invoice')}>חשבונית מס</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openNewDocDialog('invoice-receipt')}>חשבונית מס קבלה</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline">
                <Link href="/admin/clients">
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה
                </Link>
            </Button>
            </div>
            <div>
            <h1 className="text-3xl font-bold tracking-tight">חיוב וחשבוניות: {client?.nickname}</h1>
            <p className="text-muted-foreground">היסטוריית מסמכים וסטטוס תשלומים ממערכת Morning.</p>
            </div>
        </div>

        <DialogContent className="sm:max-w-4xl text-right text-foreground">
            <DialogHeader className="text-right items-end">
                <DialogTitle>{getNewDocDialogTitle()}</DialogTitle>
                <DialogDescription>
                    מלא את כל הפרטים ליצירת המסמך עבור {client?.nickname}.
                </DialogDescription>
                <Separator className="mt-2" />
            </DialogHeader>
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className={cn("grid w-full", needsPaymentTab ? 'grid-cols-4' : 'grid-cols-3')}>
                    <TabsTrigger value="general">פרטים כלליים</TabsTrigger>
                    <TabsTrigger value="items">פריטים</TabsTrigger>
                    {needsPaymentTab && <TabsTrigger value="payment">תשלום</TabsTrigger>}
                    <TabsTrigger value="summary">הערות וסיכום</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                     <Card>
                        <CardHeader><CardTitle className="text-base">פרטי לקוח</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p><strong>שם:</strong> {client?.nickname}</p>
                            <p><strong>ח.פ./ע.מ.:</strong> {client?.idNumber}</p>
                            <p><strong>אימייל:</strong> {client?.email}</p>
                        </CardContent>
                    </Card>
                     <div className="space-y-2">
                        <Label htmlFor="contact-person">איש קשר (אופציונלי)</Label>
                        <Input id="contact-person" placeholder="שם איש הקשר אצל הלקוח" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="value-date">תאריך ערך</Label>
                        <Input id="value-date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                    </div>
                </TabsContent>
                <TabsContent value="items" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                     <div className="space-y-3 rounded-md border p-4">
                        {docItems.map((item) => (
                             <div key={item.id} className="flex flex-col gap-4 border-b pb-4 last:border-b-0">
                                <div className="flex items-start gap-2">
                                    <div className="flex flex-col gap-1 mt-6">
                                        {!item.isSaved && (
                                            <Button variant="outline" size="icon" className="text-green-500 hover:text-green-500/80" onClick={() => handleSaveItem(item.id)}>
                                                <Save className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleRemoveItem(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        {item.isSaved && (
                                             <Button variant="ghost" size="icon" onClick={() => handleItemChange(item.id, 'isSaved', false)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1 md:col-span-2">
                                            <Label htmlFor={`item-desc-${item.id}`}>תיאור פריט</Label>
                                            <Input id={`item-desc-${item.id}`} value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} disabled={item.isSaved} />
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`item-sku-${item.id}`}>מק"ט</Label>
                                            <Input id={`item-sku-${item.id}`} value={item.sku} onChange={(e) => handleItemChange(item.id, 'sku', e.target.value)} disabled={item.isSaved}/>
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`item-quantity-${item.id}`}>כמות</Label>
                                            <Input id={`item-quantity-${item.id}`} type="number" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} disabled={item.isSaved}/>
                                        </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`item-price-${item.id}`}>מחיר יחידה</Label>
                                            <Input id={`item-price-${item.id}`} type="number" value={item.price} onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value))} disabled={item.isSaved}/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`item-discount-${item.id}`}>הנחה</Label>
                                            <div className="flex gap-1">
                                                <Input id={`item-discount-${item.id}`} type="number" value={item.discount} onChange={(e) => handleItemChange(item.id, 'discount', Number(e.target.value))} className="w-24" disabled={item.isSaved}/>
                                                <Select value={item.discountType} onValueChange={(value) => handleItemChange(item.id, 'discountType', value as 'percentage' | 'amount')} disabled={item.isSaved}>
                                                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="amount">₪</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pr-12">
                                     <RadioGroup defaultValue="before" value={item.vatType} onValueChange={(value) => handleItemChange(item.id, 'vatType', value as 'before' | 'after')} className="flex gap-4" disabled={item.isSaved}>
                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="before" id={`vat-before-${item.id}`} /><Label htmlFor={`vat-before-${item.id}`} className="text-xs">לפני מע"מ</Label></div>
                                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="after" id={`vat-after-${item.id}`} /><Label htmlFor={`vat-after-${item.id}`} className="text-xs">כולל מע"מ</Label></div>
                                    </RadioGroup>
                                </div>
                            </div>
                        ))}
                         <Button variant="outline" size="sm" onClick={handleAddItem} className="mt-2"><PlusCircle className="ml-2 h-4 w-4" />הוסף פריט</Button>
                    </div>
                </TabsContent>
                 <TabsContent value="payment" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {payments.map((payment, index) => (
                        <div key={index} className="space-y-4 rounded-lg border p-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor={`payment-type-${index}`}>אמצעי תשלום</Label>
                                    <Select dir="rtl" value={payment.type} onValueChange={(value: PaymentType) => handlePaymentChange(index, 'type', value)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(paymentTypeText).map(([key, text]) => (
                                                <SelectItem key={key} value={key}>{text}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor={`payment-date-${index}`}>תאריך תשלום</Label>
                                    <Input id={`payment-date-${index}`} type="date" value={payment.date} onChange={(e) => handlePaymentChange(index, 'date', e.target.value)} />
                                </div>
                           </div>
                             <div className="space-y-1">
                                <Label htmlFor={`payment-amount-${index}`}>סכום</Label>
                                <Input id={`payment-amount-${index}`} type="number" value={payment.amount} onChange={(e) => handlePaymentChange(index, 'amount', Number(e.target.value))} />
                            </div>
                        </div>
                    ))}
                    {/* Add/Remove payment method buttons can be added here in the future */}
                </TabsContent>
                 <TabsContent value="summary" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="space-y-2">
                        <Label htmlFor="doc-remarks">הערות (יוצגו בתחתית המסמך)</Label>
                        <Textarea id="doc-remarks" placeholder="תנאי תשלום, תוקף וכו'" rows={5} value={docRemarks} onChange={(e) => setDocRemarks(e.target.value)} />
                    </div>
                    <Separator />
                     <div className="text-left pt-4 space-y-2">
                        <p className="text-lg font-bold">סה"כ לפני מע"מ: <span className="font-mono">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(docTotal)}</span></p>
                        <p className="text-sm text-muted-foreground">מע"מ (17%): <span className="font-mono">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(docTotal * 0.17)}</span></p>
                        <p className="text-xl font-bold">סה"כ לתשלום: <span className="font-mono">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(docTotalWithVat)}</span></p>
                    </div>
                 </TabsContent>
            </Tabs>
            <DialogFooter className="sm:justify-between pt-4 border-t">
              <div>
                <Button type="button" variant="secondary" onClick={() => handleCreateDocument('draft')} disabled={isProcessingDoc || docItems.some(item => !item.isSaved)}>
                    {isProcessingDoc && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    <Save className="ml-2 h-4 w-4" />
                    שמור טיוטה
                </Button>
              </div>
              <div className="flex gap-2">
                 <DialogClose asChild>
                    <Button type="button" variant="outline">ביטול</Button>
                </DialogClose>
                <Button onClick={() => handleCreateDocument('open')} disabled={isProcessingDoc || docItems.some(item => !item.isSaved)}>
                    {isProcessingDoc && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    צור ושגר
                </Button>
              </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      {!client?.idNumber?.trim() && (
        <Alert variant="destructive" className="bg-white text-destructive border-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle>נדרש עדכון פרטי לקוח</AlertTitle>
          <div className="flex justify-between items-center">
            <p className="text-destructive">יש להזין מספר עוסק / ח.פ / ת.ז כדי למשוך מסמכים ממערכת Morning.</p>
            <Button asChild variant="destructive" size="sm">
              <Link href={`/admin/clients?edit=${encodeURIComponent(clientId)}`}>
                <Edit className="ml-2 h-4 w-4" />
                עדכון פרטי לקוח
              </Link>
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center justify-end gap-2">
                <Banknote className="h-5 w-5" />
                חיוב חודשי מהיר
            </CardTitle>
             <CardDescription>
                {monthlyQuote ? 'הצעת מחיר קבועה כבר קיימת עבור לקוח זה.' : 'הזן סכום ליצירת הצעת מחיר עבור חיוב חודשי קבוע.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
             {monthlyQuote ? (
                <div className="text-right p-4 bg-muted rounded-md border">
                    <p className="text-sm text-muted-foreground">הונפקה הצעת מחיר לחיוב חודשי קבוע בתאריך {format(parseISO(monthlyQuote.date), 'dd/MM/yyyy')}</p>
                    <p className="text-xl font-bold">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: monthlyQuote.currency }).format(monthlyQuote.total)}</p>
                </div>
             ) : (
                <div className="flex items-center justify-end gap-2 max-w-sm ml-auto">
                    <Button size="icon" onClick={handleGenerateMonthlyQuote} disabled={!monthlyAmount || isProcessingDoc}>
                        {isProcessingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <div className="flex-1">
                        <Label htmlFor="monthly-amount" className="sr-only">סכום חודשי</Label>
                        <Input
                            id="monthly-amount"
                            type="number"
                            placeholder="הזן סכום"
                            value={monthlyAmount}
                            onChange={(e) => setMonthlyAmount(e.target.value)}
                            className="text-right"
                        />
                    </div>
                </div>
            )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
            <FileText className="h-5 w-5" />
            מסמכים אחרונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]"></TableHead>
                <TableHead className="text-right w-[120px]">פעולות</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">סה"כ</TableHead>
                <TableHead className="text-right">סוג מסמך</TableHead>
                <TableHead className="text-right">תאריך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length > 0 ? (
                documents.map(doc => {
                  const statusInfo = getStatusInfo(doc);
                  return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          {doc.url && (
                            <Button asChild variant="outline" size="sm">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Download className="ml-2 h-4 w-4" />
                                הורדה
                              </a>
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="text-right">
                              {doc.type === 10 && ( // 10 is 'הצעת מחיר'
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <FilePlus2 className="ml-2 h-4 w-4" />
                                            צור הזמנה מהצעה זו
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="text-right">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>אישור יצירת הזמנה</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                פעולה זו תיצור הזמנה חדשה על בסיס הנתונים של הצעת מחיר זו. האם להמשיך?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleCreateOrderFromQuote(doc.id)}>
                                                כן, צור הזמנה
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {doc.type === 100 && ( // 100 is 'הזמנה'
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <FilePlus2 className="ml-2 h-4 w-4" />
                                            צור חשבון עסקה מהזמנה זו
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="text-right">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>אישור יצירת חשבון עסקה</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                פעולה זו תיצור חשבון עסקה חדש על בסיס הנתונים של הזמנה זו. האם להמשיך?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleCreateProFormaFromOrder(doc.id)}>
                                                כן, צור חשבון עסקה
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              )}
                              <DropdownMenuItem disabled>שכפל מסמך</DropdownMenuItem>
                              <DropdownMenuItem disabled>שלח במייל</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" disabled>בטל מסמך</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(statusInfo.className)}>{statusInfo.text}</Badge>
                        </TableCell>
                        <TableCell>{new Intl.NumberFormat('he-IL', { style: 'currency', currency: doc.currency }).format(doc.total)}</TableCell>
                        <TableCell>{getDocumentTypeText(doc.type)}</TableCell>
                        <TableCell>{doc.date ? format(parseISO(doc.date), 'dd/MM/yyyy') : '-'}</TableCell>
                      </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {client?.idNumber?.trim() ? "לא נמצאו מסמכים עבור לקוח זה." : "יש לעדכן מספר עוסק בכרטיס הלקוח כדי להציג מסמכים."}
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
