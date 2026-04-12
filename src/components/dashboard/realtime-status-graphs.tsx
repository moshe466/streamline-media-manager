
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Wifi, Database } from 'lucide-react';
import { checkFlussonicStatus } from '@/services/flussonic';
import { testFirestoreConnectionAction } from '@/actions/test-firestore-action';

const MAX_DATA_POINTS = 20;

type ChartDataPoint = {
    time: string;
    value: number;
};

const LiveChart = ({ data, strokeColor, fillColor, dataKey }: { data: ChartDataPoint[], strokeColor: string, fillColor: string, dataKey: string }) => (
    <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data}>
            <Tooltip
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    fontSize: '12px',
                }}
                labelStyle={{ fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={strokeColor} fill={fillColor} strokeWidth={2} />
        </AreaChart>
    </ResponsiveContainer>
);

export function RealtimeStatusGraphs({ initialFlussonicStatus, initialDbStatus }: { initialFlussonicStatus: any, initialDbStatus: any }) {
    const [networkData, setNetworkData] = useState<ChartDataPoint[]>([]);
    const [flussonicData, setFlussonicData] = useState<ChartDataPoint[]>([{ time: new Date().toLocaleTimeString(), value: initialFlussonicStatus?.active_streams || 0 }]);
    const [dbData, setDbData] = useState<ChartDataPoint[]>([{ time: new Date().toLocaleTimeString(), value: initialDbStatus?.success ? 1 : 0 }]);
    
    const [currentNetworkLatency, setCurrentNetworkLatency] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        if (document.hidden) return;

        // 1. App Network Status (Ping)
        const startTime = Date.now();
        try {
            await fetch('/api/ping');
            const latency = Date.now() - startTime;
            setCurrentNetworkLatency(latency);
            setNetworkData(prev => [...prev.slice(-MAX_DATA_POINTS + 1), { time: new Date().toLocaleTimeString(), value: latency }]);
        } catch (error) {
            setCurrentNetworkLatency(-1); // Indicate error
            setNetworkData(prev => [...prev.slice(-MAX_DATA_POINTS + 1), { time: new Date().toLocaleTimeString(), value: -1 }]);
        }

        // 2. Flussonic Status
        const flussonicStatus = await checkFlussonicStatus();
        setFlussonicData(prev => [...prev.slice(-MAX_DATA_POINTS + 1), { time: new Date().toLocaleTimeString(), value: flussonicStatus.success ? flussonicStatus.active_streams || 0 : -1 }]);
        
        // 3. Database Status
        const dbStatus = await testFirestoreConnectionAction();
        setDbData(prev => [...prev.slice(-MAX_DATA_POINTS + 1), { time: new Date().toLocaleTimeString(), value: dbStatus.success ? 1 : 0 }]);

    }, []);

    useEffect(() => {
        const intervalId = setInterval(fetchData, 7000); // Fetch every 7 seconds
        return () => clearInterval(intervalId);
    }, [fetchData]);

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">זמן תגובת שרת (Ping)</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {currentNetworkLatency === null ? 'בודק...' : `${currentNetworkLatency}ms`}
                    </div>
                    <LiveChart data={networkData} strokeColor="#8884d8" fillColor="#8884d8" dataKey="value" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">שידורים פעילים (MIzrachi-TV)</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     <div className="text-2xl font-bold">{flussonicData.at(-1)?.value ?? 'N/A'}</div>
                     <LiveChart data={flussonicData} strokeColor="#82ca9d" fillColor="#82ca9d" dataKey="value" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">סטטוס מסד נתונים</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dbData.at(-1)?.value === 1 ? 'מחובר' : 'מנותק'}{' '}
                         <span className="opacity-0">.</span>
                    </div>
                     <LiveChart data={dbData} strokeColor="#ffc658" fillColor="#ffc658" dataKey="value" />
                </CardContent>
            </Card>
        </div>
    );
}
