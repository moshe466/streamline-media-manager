
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateTelegramAuthLink } from '@/services/telegram';
import { Loader2, Link as LinkIcon, Bell, Save, Tv, Server, Users, FileText as FileTextIcon, UserCheck, Trash2, Video, Clock, Link2, LogIn } from "lucide-react";
import { getUserById, updateUser, type User, type AdminNotificationSettings } from '@/services/users';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function AdminTelegramSettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<string | null>(null);
    
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [adminSettings, setAdminSettings] = useState<AdminNotificationSettings>({});
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const fetchAdminData = useCallback(async () => {
        const adminId = sessionStorage.getItem('userId');
        if (!adminId) return;
        const user = await getUserById(adminId);
        if (user) {
            setAdminUser(user);
            setAdminSettings(user.adminNotificationSettings || {});
        }
    }, []);
    
    useEffect(() => {
        fetchAdminData();
    }, [fetchAdminData]);


    const handleSettingChange = (key: keyof AdminNotificationSettings, value: boolean) => {
        setAdminSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveAdminSettings = async () => {
        if (!adminUser) return;
        setIsSavingSettings(true);
        try {
            await updateUser(adminUser.id, { adminNotificationSettings: adminSettings });
            toast({ title: "הגדרות נשמרו", description: "העדפות ההתראות שלך עודכנו."});
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה בשמירת הגדרות' });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleConnectBot = async () => {
        if (!adminUser) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לזהות את המנהל.' });
            return;
        }
        setIsLoading('connect');
        try {
            const result = await generateTelegramAuthLink(adminUser.id);
            if (result.success && result.url) {
                window.open(result.url, '_blank');
            } else {
                throw new Error(result.error || "Failed to generate Telegram link.");
            }
        } catch (error) {
            toast({ variant: "destructive", title: "שגיאה", description: (error as Error).message });
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="space-y-8 text-right">
             <div className="space-y-2 text-center sm:text-left w-full sm:w-auto">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">ניהול והתראות טלגרם</h1>
                <p className="text-muted-foreground">
                    חבר את חשבון הטלגרם שלך ונהל אילו התראות ניהוליות תרצה לקבל.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center justify-start gap-2">
                                <Bell className="h-5 w-5"/>
                                הגדרות התראות
                            </CardTitle>
                             <CardDescription className="text-left">
                                הפעל או כבה קבלת התראות אוטומטיות לטלגרם עבור אירועים שונים במערכת.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-base border-b pb-2 mb-3 flex items-center justify-start gap-2">
                                    <Server className="h-5 w-5 text-primary"/>
                                    התראות מערכת ושרת
                                </h3>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onHourlyStatusReport" className="pr-2">קבלת דוח סטטוס שעתי</Label><Switch id="onHourlyStatusReport" checked={!!adminSettings.onHourlyStatusReport} onCheckedChange={(checked) => handleSettingChange('onHourlyStatusReport', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onFlussonicDown" className="pr-2">שרת המדיה אינו מגיב</Label><Switch id="onFlussonicDown" checked={!!adminSettings.onFlussonicDown} onCheckedChange={(checked) => handleSettingChange('onFlussonicDown', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onBackupSuccess" className="pr-2">גיבוי מערכת הושלם בהצלחה</Label><Switch id="onBackupSuccess" checked={!!adminSettings.onBackupSuccess} onCheckedChange={(checked) => handleSettingChange('onBackupSuccess', checked)} /></div>
                                </div>
                            </div>
                             <div>
                                <h3 className="font-semibold text-base border-b pb-2 mb-3 flex items-center justify-start gap-2">
                                    <Users className="h-5 w-5 text-primary"/>
                                    התראות לקוחות וצופים
                                </h3>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onNewQuestionnaire" className="pr-2">טופס הרשמה חדש מלקוח</Label><Switch id="onNewQuestionnaire" checked={!!adminSettings.onNewQuestionnaire} onCheckedChange={(checked) => handleSettingChange('onNewQuestionnaire', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onClientRenewalRequest" className="pr-2">בקשת חידוש מנוי של לקוח</Label><Switch id="onClientRenewalRequest" checked={!!adminSettings.onClientRenewalRequest} onCheckedChange={(checked) => handleSettingChange('onClientRenewalRequest', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onViewerCreated" className="pr-2">יצירת צופה חדש</Label><Switch id="onViewerCreated" checked={!!adminSettings.onViewerCreated} onCheckedChange={(checked) => handleSettingChange('onViewerCreated', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onAdminLogin" className="pr-2 flex items-center gap-2">התחברות מנהלים למערכת <LogIn className="h-4 w-4"/></Label><Switch id="onAdminLogin" checked={!!adminSettings.onAdminLogin} onCheckedChange={(checked) => handleSettingChange('onAdminLogin', checked)} /></div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-base border-b pb-2 mb-3 flex items-center justify-start gap-2">
                                    <Tv className="h-5 w-5 text-primary"/>
                                    התראות שידורים
                                </h3>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onStreamStatusChange" className="pr-2">שינוי סטטוס (אונליין/אופליין)</Label><Switch id="onStreamStatusChange" checked={!!adminSettings.onStreamStatusChange} onCheckedChange={(checked) => handleSettingChange('onStreamStatusChange', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onDvrStatusChange" className="pr-2">שינוי סטטוס DVR</Label><Switch id="onDvrStatusChange" checked={!!adminSettings.onDvrStatusChange} onCheckedChange={(checked) => handleSettingChange('onDvrStatusChange', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onStreamCreated" className="pr-2">יצירת שידור חדש</Label><Switch id="onStreamCreated" checked={!!adminSettings.onStreamCreated} onCheckedChange={(checked) => handleSettingChange('onStreamCreated', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onStreamDeleted" className="pr-2">מחיקת שידור</Label><Switch id="onStreamDeleted" checked={!!adminSettings.onStreamDeleted} onCheckedChange={(checked) => handleSettingChange('onStreamDeleted', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onPushAdded" className="pr-2">הפעלה/הפסקת Push</Label><Switch id="onPushAdded" checked={!!adminSettings.onPushAdded} onCheckedChange={(checked) => handleSettingChange('onPushAdded', checked)} /></div>
                                    <div className="flex items-center justify-between p-3 border rounded-md"><Label htmlFor="onSecureLinkCreated" className="pr-2 flex items-center gap-1">יצירת קישור צפייה <Link2 className="h-3 w-3"/></Label><Switch id="onSecureLinkCreated" checked={!!adminSettings.onSecureLinkCreated} onCheckedChange={(checked) => handleSettingChange('onSecureLinkCreated', checked)} /></div>
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex justify-start">
                            <Button onClick={handleSaveAdminSettings} disabled={isSavingSettings}>
                                 {isSavingSettings ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                                שמור הגדרות
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                
                <div className="lg:col-span-1 space-y-8">
                     <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center justify-start gap-2">חיבור אישי</CardTitle>
                             <CardDescription className="text-left">כדי להתחיל לקבל התראות, התחבר לבוט.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Button onClick={handleConnectBot} disabled={!!isLoading} className="w-full">
                                {isLoading === 'connect' ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <LinkIcon className="ml-2 h-4 w-4" />}
                                {adminUser?.telegramChatId ? 'התחבר מחדש / החלף משתמש' : 'התחבר לבוט'}
                            </Button>
                        </CardContent>
                         {adminUser?.telegramChatId && (
                            <CardFooter className="text-xs text-green-400 justify-center">
                                מחובר לחשבון: {adminUser.telegramChatId}
                            </CardFooter>
                         )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
