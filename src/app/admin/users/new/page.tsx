
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addUser, type User } from '@/services/users';
import type { AuthContext } from '@/services/security';
import Link from 'next/link';

export default function NewUserPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');

  const auth: AuthContext = {
    userId: sessionStorage.getItem('userId') || '',
    sessionId: sessionStorage.getItem('activeSessionId') || ''
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nickname || !email) {
      toast({ variant: "destructive", title: "שדות חסרים", description: "אנא מלא את כל הפרטים." });
      return;
    }
    setIsProcessing(true);
    
    try {
      await addUser(auth, { nickname, email, role });
      toast({ title: "הצלחה", description: `משתמש "${nickname}" נוצר וקוד אימות נשלח אליו במייל.` });
      router.push('/admin/users');
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

  return (
    <div className="space-y-8 text-right">
       <div className="flex items-center justify-between">
         <Button asChild variant="outline">
            <Link href="/admin/users">
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה לרשימה
            </Link>
         </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">יצירת משתמש חדש</h1>
          <p className="text-muted-foreground">מלא את הפרטים ליצירת משתמש חדש. קוד אימות יישלח אליו במייל.</p>
        </div>
      </div>
      
      <form onSubmit={handleFormSubmit}>
        <Card>
            <CardContent className="pt-6 space-y-4">
               <div className="space-y-2">
                <Label htmlFor="nickname">כינוי</Label>
                <Input id="nickname" placeholder="שם שיוצג במערכת" dir="rtl" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" type="email" placeholder="user@example.com" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="role">תפקיד</Label>
                <Select dir="rtl" value={role} onValueChange={(value: 'admin' | 'editor') => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תפקיד..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">עורך</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="flex justify-start">
                <Button type="submit" disabled={isProcessing}>
                    {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    צור משתמש
                </Button>
            </CardFooter>
        </Card>
      </form>
    </div>
  );
}
