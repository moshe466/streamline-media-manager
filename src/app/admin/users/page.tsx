
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Edit, Send, Search, ShieldCheck } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from '@/components/ui/badge';
import { getUsers, deleteUser, updateUserOtp, updateUser, type User } from '@/services/users';
import type { AuthContext } from '@/services/security';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type EditingUser = User | null;

export default function AdminUsersPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningUser, setActioningUser] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const auth: AuthContext = {
    userId: sessionStorage.getItem('userId') || '',
    sessionId: sessionStorage.getItem('activeSessionId') || ''
  };

  // Edit Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<EditingUser>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [nickname, setNickname] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');


  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    const fetchedUsers = await getUsers(auth);
    setUsers(fetchedUsers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const role = sessionStorage.getItem('userRole');
    setUserRole(role);
    setCurrentUserEmail(sessionStorage.getItem('userEmail'));

    if (role !== 'super-admin' && role !== 'admin' && !sessionStorage.getItem('canAccessUsers')) {
        toast({ variant: 'destructive', title: 'אין הרשאה', description: 'אין לך גישה לעמוד זה.' });
        router.push('/admin/dashboard');
        return;
    }
    setIsAuthorized(true);
    fetchUsers();
  }, [router, toast, fetchUsers]);

  const resetForm = () => {
    setNickname('');
    setRole('editor');
    setEditingUser(null);
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setNickname(user.nickname);
    // super-admin is not an editable role, so we don't include it in the select
    setRole(user.role === 'super-admin' ? 'admin' : user.role); 
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingUser || !nickname) {
        toast({ variant: 'destructive', title: 'שדה חסר', description: 'כינוי הוא שדה חובה.' });
        return;
    }
    setIsProcessing(true);
    try {
        await updateUser(editingUser.id, { nickname, role });
        toast({ title: "הצלחה", description: "פרטי המשתמש עודכנו." });
        setEditDialogOpen(false);
        resetForm();
        fetchUsers();
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


  const handleDeleteUser = async (user: User) => {
     setActioningUser(user.id);
     try {
        await deleteUser(auth, user.id);
        toast({ variant: "destructive", title: "משתמש נמחק", description: `${user.nickname} הוסר מהמערכת.` });
        fetchUsers();
     } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה למחוק את המשתמש." });
     } finally {
        setActioningUser(null);
     }
  }

  const handleResendOtp = async (user: User) => {
    setActioningUser(user.id);
    try {
        await updateUserOtp(user.id);
        toast({ title: "הצלחה", description: `קוד אימות חדש נשלח ל-${user.email}.` });
        fetchUsers(); // Refresh to show new OTP
    } catch (error) {
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשלוח את המייל." });
    } finally {
        setActioningUser(null);
    }
  }

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
        user.nickname.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  });
  
  if (!isAuthorized) {
    return null; // Render nothing while redirecting
  }

  return (
    <div className="space-y-8 text-right">
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
        <Button asChild>
          <Link href="/admin/users/new">
            <PlusCircle className="ml-2 h-4 w-4" />
            הוסף משתמש
          </Link>
        </Button>
        <div className="space-y-2 text-center sm:text-right">
          <h1 className="text-3xl font-bold tracking-tight">ניהול משתמשים</h1>
          <p className="text-muted-foreground">הוספה, עריכה או הסרה של מנהלים ועורכים.</p>
        </div>
      </div>
      
       {/* Edit User Dialog */}
       <Dialog open={editDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); setEditDialogOpen(isOpen); }}>
          <DialogContent className="sm:max-w-[425px] text-right">
            <DialogHeader>
                <DialogTitle>עריכת משתמש: {editingUser?.nickname}</DialogTitle>
                 <DialogDescription>
                    שנה את הכינוי או התפקיד של המשתמש.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="space-y-2">
                <Label htmlFor="edit-email">אימייל (לא ניתן לעריכה)</Label>
                <Input id="edit-email" value={editingUser?.email || ''} disabled dir="ltr" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="edit-nickname">כינוי</Label>
                <Input id="edit-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} dir="rtl" required />
              </div>
               <div className="space-y-2">
                <Label htmlFor="edit-role">תפקיד</Label>
                <Select dir="rtl" value={role} onValueChange={(value: 'admin' | 'editor') => setRole(value)} disabled={editingUser?.role === 'super-admin'}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תפקיד..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">עורך</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                  </SelectContent>
                </Select>
                 {editingUser?.role === 'super-admin' && <p className="text-xs text-muted-foreground">לא ניתן לשנות תפקיד של מנהל ראשי.</p>}
              </div>
            </div>
            <DialogFooter>
                 <DialogClose asChild><Button variant="outline">ביטול</Button></DialogClose>
                <Button onClick={handleEditSubmit} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    שמור שינויים
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


       <Card>
        <CardHeader>
          <CardTitle>כל המשתמשים</CardTitle>
           <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="חיפוש לפי כינוי או אימייל..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent>
          <Table className="responsive-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] text-right">פעולות</TableHead>
                <TableHead className="text-right">כינוי</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">קוד אימות</TableHead>
                <TableHead className="text-right">תפקיד</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell data-label="פעולות"><Skeleton className="h-8 w-8" /></TableCell>
                    <TableCell data-label="כינוי"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell data-label="אימייל"><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell data-label="קוד אימות"><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell data-label="תפקיד"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell data-label="פעולות">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningUser === user.id}>
                                    {actioningUser === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                    <span className="sr-only">פתח תפריט</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-right">
                                <DropdownMenuLabel>פעולות</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                    <Edit className="ml-2 h-4 w-4" />
                                    <span>ערוך</span>
                                </DropdownMenuItem>
                                {(user.role === 'editor' && (userRole === 'admin' || userRole === 'super-admin')) && (
                                  <DropdownMenuItem onClick={() => router.push(`/admin/users/${encodeURIComponent(user.id)}/permissions`)}>
                                      <ShieldCheck className="ml-2 h-4 w-4" />
                                      <span>הרשאות</span>
                                  </DropdownMenuItem>
                                )}
                                {user.email !== 'admin@mizrachitv.co.il' && (
                                    <>
                                        <DropdownMenuItem onClick={() => handleResendOtp(user)}>
                                            <Send className="ml-2 h-4 w-4" />
                                            <span>שלח קוד חדש</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem 
                                                    onSelect={(e) => e.preventDefault()} 
                                                    className="text-destructive focus:text-destructive"
                                                    disabled={user.email === currentUserEmail}
                                                >
                                                    <Trash2 className="ml-2 h-4 w-4" />
                                                    <span>מחק משתמש</span>
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="text-right">
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    פעולה זו תמחק את המשתמש <strong>{user.nickname}</strong> לצמיתות.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                        כן, מחק את המשתמש
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    <TableCell data-label="כינוי" className="font-medium">{user.nickname}</TableCell>
                    <TableCell data-label="אימייל">{user.email}</TableCell>
                    <TableCell data-label="קוד אימות" className="font-mono text-xs">{user.otp || 'N/A'}</TableCell>
                    <TableCell data-label="תפקיד">
                      <Badge variant={user.role === 'admin' || user.role === 'super-admin' ? 'default' : 'secondary'}>
                        {user.role === 'super-admin' ? 'מנהל ראשי' : (user.role === 'admin' ? 'מנהל' : 'עורך')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                       {searchQuery ? `לא נמצאו משתמשים התואמים לחיפוש "${searchQuery}"` : "לא נמצאו משתמשים. לחץ על 'הוסף משתמש' כדי להתחיל."}
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
