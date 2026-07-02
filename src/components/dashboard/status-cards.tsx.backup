
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Server, AppWindow, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { checkFlussonicStatus } from '@/services/flussonic';

type ServerStatus = {
    success: boolean;
    active_streams?: number;
    [key: string]: any;
};

const AppStatusIndicator = ({ active }: { active: boolean }) => (
    <div className="flex items-center justify-end gap-2">
        <span className={`h-3 w-3 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="font-bold text-lg">{active ? 'פעילה' : 'לא פעילה'}</span>
    </div>
);

function ServerStatusIndicator({ isOnline, tooltipText }: { isOnline: boolean, tooltipText: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
            <div className="flex items-center justify-end gap-2">
                <span className={cn('h-3 w-3 rounded-full', isOnline ? 'bg-green-500' : 'bg-red-500')} />
                <span className="font-bold text-lg">
                    {isOnline ? `מחובר` : 'מנותק'}
                </span>
            </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusCards({ initialServerStatus, isDbConnected }: { initialServerStatus: ServerStatus; isDbConnected: boolean; }) {
    const router = useRouter();
    const [serverStatus, setServerStatus] = useState<ServerStatus>(initialServerStatus);
    const [lastChecked, setLastChecked] = useState(new Date());
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const fetchStatus = async () => {
            const status = await checkFlussonicStatus();
            setServerStatus(status);
            setLastChecked(new Date());
        };

        const intervalId = setInterval(fetchStatus, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(intervalId); // Cleanup on component unmount
    }, []);

    const getTooltipText = () => {
        if (!serverStatus) {
            return "בודק סטטוס שרת מדיה...";
        }
        if (serverStatus.success) {
            return `החיבור לשרת המדיה תקין. נמצאו ${serverStatus.active_streams || 0} שידורים פעילים.`;
        }
        return `לא ניתן להתחבר לשרת המדיה. ${serverStatus.error || ''}`;
    };

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">שרת MIZRACHI-TV</CardTitle>
                    <Server className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     <ServerStatusIndicator 
                        isOnline={!!serverStatus?.success} 
                        tooltipText={getTooltipText()}
                    />
                    {isClient && (
                         <p className="text-xs text-muted-foreground mt-2 text-right">
                           בדיקה אחרונה: {lastChecked.toLocaleTimeString('he-IL')}
                        </p>
                    )}
                </CardContent>
            </Card>
             <Card 
                className="bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push('/admin/status')}
             >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">סטטוס מסד נתונים</CardTitle>
                    <Database className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-end gap-2">
                        {isDbConnected ? (
                           <>
                             <span className='h-3 w-3 rounded-full bg-green-500' />
                             <span className="font-bold text-lg">מחובר</span>
                           </>
                        ) : (
                           <>
                             <AlertCircle className="h-4 w-4 text-red-500"/>
                             <span className="font-bold text-lg text-red-500">מנותק</span>
                           </>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">החיבור ל-Firestore</p>
                </CardContent>
            </Card>
            <Card className="bg-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">מצב אפליקציה</CardTitle>
                    <AppWindow className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <AppStatusIndicator active={true} />
                    <p className="text-xs text-muted-foreground mt-2">המערכת פועלת כמצופה</p>
                </CardContent>
            </Card>
        </div>
    );
}
