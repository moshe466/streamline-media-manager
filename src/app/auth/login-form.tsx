
"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Send } from "lucide-react";
import React from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { verifyUser, requestPasswordReset } from "@/services/auth";
import { Logo } from "@/components/logo";
import Link from 'next/link';
import { Separator } from "@/components/ui/separator";

export function LoginForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  
  // State for reset dialog
  const [resetEmail, setResetEmail] = React.useState("");
  const [isResetting, setIsResetting] = React.useState(false);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  const { toast } = useToast();
  const router = useRouter();

  const handleResetRequest = async () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: "כתובת מייל חסרה", description: "אנא הזן את כתובת המייל שלך." });
      return;
    }
    setIsResetting(true);
    try {
      const result = await requestPasswordReset(resetEmail);
      if (result.success) {
        toast({ title: "הקוד נשלח!", description: "קוד אימות חדש נשלח לכתובת המייל שלך." });
        setResetDialogOpen(false);
        setResetEmail("");
      } else {
        toast({ variant: "destructive", title: "שגיאה", description: result.error || "לא ניתן היה לשלוח קוד חדש." });
      }
    } catch (error) {
       toast({ variant: "destructive", title: "שגיאה", description: "אירעה שגיאה בלתי צפויה." });
    } finally {
      setIsResetting(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await verifyUser(email, password);

      if (result.success && result.role && result.activeSessionId) {
        // Store user info in session storage
        sessionStorage.setItem('userRole', result.role);
        sessionStorage.setItem('userId', result.id!.toLowerCase());
        sessionStorage.setItem('userNickname', result.nickname!);
        sessionStorage.setItem('userEmail', result.email!);
        sessionStorage.setItem('activeSessionId', result.activeSessionId);


        if (result.role === 'client' && result.client) {
            sessionStorage.setItem('clientData', JSON.stringify(result.client));
        }

        if (result.role === 'viewer' && result.clientId) {
          sessionStorage.setItem('clientId', result.clientId);
        }

        // Redirect to the loading page which will handle the final redirection
        router.push('/');

      } else {
        toast({
          variant: "destructive",
          title: "שגיאת התחברות",
          description: "אימייל או סיסמה שגויים.",
        });
        setIsLoading(false); // Stop loading only on failure
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "שגיאה",
        description: "אירעה שגיאה בלתי צפויה. נסה שוב מאוחר יותר.",
      });
      console.error(error);
      setIsLoading(false); // Stop loading on error
    }
  };

  return (
    <Card className="w-full bg-card border-border/50 shadow-xl">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-3xl font-headline">
          כניסת מורשים
        </CardTitle>
        <CardDescription>
          הזן כתובת מייל וסיסמה או קוד אימות
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email" className="sr-only">אימייל</Label>
            <Input
              id="email"
              type="email"
              placeholder="כתובת אימייל"
              required
              className="bg-input border-border text-foreground placeholder:text-muted-foreground text-right"
              dir="rtl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" className="sr-only">סיסמה</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="סיסמה"
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10 text-right"
                dir="rtl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" variant="accent" disabled={isLoading}>
            {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : "התחברות"}
          </Button>
        </form>
         <div className="mt-4 text-center">
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="link" className="text-muted-foreground" disabled={isLoading}>
                    שכחתי סיסמה / קוד
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md text-right">
                    <DialogHeader>
                        <DialogTitle>איפוס קוד כניסה</DialogTitle>
                        <DialogDescription>
                            הזן את כתובת המייל שלך ואנו נשלח אליך קוד אימות חדש.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">כתובת אימייל</Label>
                            <Input
                                id="reset-email"
                                type="email"
                                placeholder="user@example.com"
                                dir="ltr"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                disabled={isResetting}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">ביטול</Button></DialogClose>
                        <Button onClick={handleResetRequest} disabled={isResetting}>
                            {isResetting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
                            שלח קוד חדש
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Separator className="my-2" />
             <Button asChild variant="link" className="text-primary hover:text-primary/90 font-semibold" disabled={isLoading}>
                <Link href="/questionnaire">
                    עדיין אין לך חשבון? להרשמה
                </Link>
            </Button>
         </div>
      </CardContent>
    </Card>
  );
}
