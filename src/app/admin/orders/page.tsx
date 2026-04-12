
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, User, Users, UserCheck, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendVerificationEmail } from '@/services/email';

export default function OrdersPage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [invitationEmail, setInvitationEmail] = useState('');
    const { toast } = useToast();

    const handleSendInvitation = async () => {
        if (!invitationEmail) {
          toast({ variant: 'destructive', title: 'כתובת מייל חסרה' });
          return;
        }
        setIsProcessing(true);
        const result = await sendVerificationEmail(invitationEmail, 'משתמש יקר');
        if (!result.error) {
            toast({ title: 'הזמנה נשלחה', description: `שאלון הרשמה נשלח אל ${invitationEmail}` });
            setInvitationEmail('');
            // Consider closing the dialog here if it's open
        } else {
             toast({ variant: "destructive", title: "שגיאה בשליחת מייל", description: result.error });
        }
        setIsProcessing(false);
    };

  return (
    <div className="space-y-8 text-right">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">הזמנות</h1>
        <p className="text-muted-foreground">
          כאן תוכל לשלוח הזמנות הרשמה למשתמשים, לקוחות וצופים.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-end gap-2">
             שליחת הזמנות
            <Briefcase className="h-5 w-5" />
          </CardTitle>
           <CardDescription>
            בחר את סוג המשתמש שאליו תרצה לשלוח הזמנה למילוי שאלון הרשמה.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
             <Dialog>
                 <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-24 flex-col gap-2">
                        <Users className="h-6 w-6" />
                        הזמנה ללקוח
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-md text-right">
                     <DialogHeader>
                        <DialogTitle>הזמנת לקוח חדש</DialogTitle>
                        <DialogDescription>הזן את כתובת המייל של הלקוח. הוא יקבל הזמנה למילוי שאלון.</DialogDescription>
                     </DialogHeader>
                     <div className="py-4 space-y-2">
                        <Label htmlFor="client-email" className="sr-only">אימייל</Label>
                        <Input id="client-email" type="email" dir="ltr" placeholder="client@example.com" value={invitationEmail} onChange={(e) => setInvitationEmail(e.target.value)} />
                     </div>
                     <DialogFooter>
                         <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                         <Button onClick={handleSendInvitation} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                             שלח הזמנה
                         </Button>
                     </DialogFooter>
                 </DialogContent>
             </Dialog>

              <Button variant="outline" className="w-full h-24 flex-col gap-2" disabled>
                  <User className="h-6 w-6" />
                  הזמנה למשתמש (בבנייה)
              </Button>
             
              <Button variant="outline" className="w-full h-24 flex-col gap-2" disabled>
                    <UserCheck className="h-6 w-6" />
                    הזמנה לצופה (בבנייה)
              </Button>
        </CardContent>
      </Card>
    </div>
  );
}
