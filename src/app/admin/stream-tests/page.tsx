
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TestTube2, Loader2, ServerCrash, Video, Mic, ArrowRightLeft, Rss, Tv, Power, PowerOff, Database, Film, Zap, Framer, AudioLines, Speaker, Clock, HardDrive, AlertTriangle, Search } from 'lucide-react';
import { getStreamDetails } from '@/services/flussonic';
import type { StreamDetails, StreamTrackSchema } from '@/services/flussonic-types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const DataRow = ({ label, value, unit = '', className = '' }: { label: string; value: unknown; unit?: string, className?: string }) => {
  if (value === undefined || value === null || value === '') return null;
  
  let displayValue;
  const safeValue =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? value
      : undefined;
  if (typeof safeValue === 'boolean') {
    displayValue = <Badge variant={safeValue ? 'default' : 'destructive'} className={cn(safeValue ? 'bg-green-600' : 'bg-red-600', "text-white")}>{safeValue ? 'פעיל' : 'כבוי'}</Badge>;
  } else {
    displayValue = <span className="font-mono">{safeValue}{unit}</span>;
  }

  return (
    <div className={cn("flex justify-between items-center text-sm py-1.5 border-b border-border/50", className)}>
      <span>{displayValue}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
};

const TrackCard = ({ track, type }: { track: any, type: 'קלט' | 'פלט' }) => {
  const isVideo = track.content === 'video';
  return (
    <Card className="bg-muted/50">
      <CardHeader className="p-3">
        <CardTitle className="text-base flex justify-end items-center gap-2">
            {`ערוץ ${type} (${track.track_id})`}
             {isVideo ? <Video className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-primary" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-right">
        <DataRow label="קידוד" value={track.codec} />
        <DataRow label="קצב נתונים" value={track.bitrate} unit=" kbps" />
        {isVideo && <>
            <DataRow label="רזולוציה" value={`${track.width}x${track.height}`} />
            <DataRow label="FPS" value={track.fps || track.avg_fps} />
            <DataRow label="פרופיל" value={typeof track.profile === 'string' ? track.profile : undefined} />
        </>}
         {!isVideo && <>
            <DataRow label="קצב דגימה" value={track.sample_rate} unit=" Hz" />
            <DataRow label="ערוצים" value={track.channels} />
        </>}
      </CardContent>
    </Card>
  )
}

export default function StreamTestsPage() {
  const [streamData, setStreamData] = useState<StreamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamNameInput, setStreamNameInput] = useState('');
  const [testedStreamName, setTestedStreamName] = useState('');
  const { toast } = useToast();

  const handleFetchStreamData = async () => {
    if (!streamNameInput) {
        toast({
            variant: 'destructive',
            title: 'שם שידור חסר',
            description: 'אנא הזן שם של שידור לבדיקה.',
        });
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setStreamData(null);
    setTestedStreamName(streamNameInput);

    try {
      const data = await getStreamDetails(streamNameInput);
      if (data) {
        setStreamData(data);
      } else {
        setError(`לא נמצא שידור בשם "${streamNameInput}". ודא שהשם נכון.`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'אירעה שגיאה לא צפויה.';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'שגיאה בטעינת נתונים',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderResults = () => {
    if (isLoading) {
      return (
          <div className="space-y-6 pt-8">
              <div className="flex justify-center items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-lg">טוען נתונים עבור {testedStreamName}...</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-96 w-full lg:col-span-2" />
              </div>
        </div>
      );
    }
  
    if (error) {
      return (
          <div className="pt-8">
              <Card className="border-destructive">
                  <CardHeader>
                      <CardTitle className="text-destructive flex justify-end items-center gap-2">
                          שגיאה בטעינת נתוני השידור
                          <ServerCrash className="h-6 w-6" />
                      </CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p>{error}</p>
                  </CardContent>
              </Card>
          </div>
      );
    }
    
    if (!streamData) {
        return null;
    }
  
    const inputSource = streamData.inputs?.[0];
    const inputStats = typeof inputSource === 'object' ? (inputSource as any).stats : null;
    const mainStats = streamData.stats;
    const safeStreamData = streamData as any;
    const safeMainStats = mainStats as any;
    const safeProtocols = safeStreamData?.protocols && typeof safeStreamData.protocols === 'object' ? Object.entries(safeStreamData.protocols as Record<string, boolean>) : [];
    const safeInputStats = (inputStats && typeof inputStats === 'object') ? inputStats as Record<string, unknown> : null;
    const safePushes = Array.isArray(streamData.stats?.push) ? (streamData.stats.push as any[]) : [];
    
    return (
      <div className="space-y-6 pt-8">
        <h2 className="text-2xl font-bold tracking-tight text-center">תוצאות עבור: {testedStreamName}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
             <Card className="xl:col-span-1">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">מידע כללי</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataRow label="שם" value={safeStreamData.name} />
                    <DataRow label="סטטוס" value={mainStats?.alive ? 'אונליין' : 'אופליין'} className={mainStats?.alive ? 'text-green-400' : 'text-red-400'} />
                    <DataRow label="סטטי" value={safeStreamData.static} />
                    <DataRow label="מוגדר על ידי" value={typeof safeStreamData.named_by === 'string' ? safeStreamData.named_by : undefined} />
                    <DataRow label="מיקום" value={safeStreamData.position} />
                </CardContent>
            </Card>
            
             <Card className="xl:col-span-1">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">מקור קלט (Input)</CardTitle>
                    <CardDescription>{typeof inputSource === 'object' ? (inputSource as any).url : inputSource}</CardDescription>
                </CardHeader>
                <CardContent>
                    {Boolean(safeInputStats) && (
                        <>
                            <DataRow label="פעיל" value={safeInputStats?.active} />
                            <DataRow label="כתובת IP" value={safeInputStats?.ip} />
                            <DataRow label="פרוטוקול" value={safeInputStats?.proto} />
                            <DataRow label="סוכן משתמש" value={safeInputStats?.user_agent} />
                            <div className="mt-4 space-y-2">
                                {(((safeInputStats?.media_info as any)?.tracks) ?? []).map((track: any, i: number) => <TrackCard key={i} track={track} type="קלט"/>)}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="xl:col-span-1">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">סטטיסטיקות שידור</CardTitle>
                </CardHeader>
                <CardContent>
                   {mainStats && <>
                        <DataRow label="קצב נתונים (Bitrate)" value={mainStats.bitrate} unit=" kbps" />
                        <DataRow label="צופים" value={safeMainStats.client_count} />
                        <DataRow label="זמן פעולה (Lifetime)" value={safeMainStats.lifetime} unit="s" />
                        <DataRow label="סהכ נכנס" value={typeof safeMainStats.bytes_in === 'number' ? (safeMainStats.bytes_in / 1e9).toFixed(2) : undefined} unit=" GB"/>
                        <DataRow label="סהכ יצא" value={typeof safeMainStats.bytes_out === 'number' ? (safeMainStats.bytes_out / 1e9).toFixed(2) : undefined} unit=" GB"/>
                   </>}
                </CardContent>
            </Card>
            
            <Card className="lg:col-span-2 xl:col-span-3">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">פרוטוקולי פלט</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                   {safeProtocols.map(([key, value]) => (
                       <Card key={key} className="bg-muted/30">
                            <CardHeader className="p-3 flex-row justify-between items-center">
                                <Badge variant={value ? 'default' : 'secondary'} className={value ? 'bg-green-600 text-white' : ''}>
                                    {value ? 'פעיל' : 'כבוי'}
                                </Badge>
                                <CardTitle className="text-base">{key.toUpperCase()}</CardTitle>
                            </CardHeader>
                       </Card>
                   ))}
                </CardContent>
            </Card>
            
            <Card className="lg:col-span-1 xl:col-span-2">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">הגדרות DVR</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataRow label="מופעל" value={mainStats?.dvr_enabled} />
                    <DataRow label="פרופיל" value={safeStreamData.dvr?.reference} />
                    {safeMainStats.dvr_info ? <>
                        <Separator className="my-2"/>
                        <DataRow label="עומק" value={safeMainStats.dvr_info.depth} unit="s" />
                        <DataRow label="גודל" value={(safeMainStats.dvr_info.disk_size / 1e6).toFixed(2)} unit=" MB"/>
                      </> : null}
                </CardContent>
            </Card>

             <Card className="lg:col-span-1 xl:col-span-1">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">הגדרות אחרות</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataRow label="תמונות ממוזערות" value={safeStreamData.thumbnails?.enabled} />
                    <DataRow label="לוגו" value={Object.keys(safeStreamData.logo || {}).length > 0 ? 'מוגדר' : 'לא מוגדר'} />
                </CardContent>
            </Card>
            
             {safePushes.length > 0 &&
                <Card className="lg:col-span-2 xl:col-span-3">
                    <CardHeader><CardTitle className="flex justify-end items-center gap-2">סטטוס PUSH</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {safePushes.map((p: any, i: number) => (
                            <Card key={i} className="bg-muted/30 p-3">
                                <p className="font-mono text-sm break-all dir-ltr text-left">{p.url}</p>
                                <Separator className="my-2"/>
                                <div className="flex justify-end gap-4 text-xs">
                                    <span>סטטוס: <Badge>{p.status}</Badge></span>
                                    <span>פריימים שנפלו: <Badge variant="destructive">{p.errors_dropped_frames}</Badge></span>
                                </div>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            }
            
            <Card className="lg:col-span-2 xl:col-span-3">
                <CardHeader>
                    <CardTitle className="flex justify-end items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-400"/>
                        תצורה גולמית (Config on Disk)
                    </CardTitle>
                    <CardDescription>
                        זוהי התצורה המדויקת כפי שהיא רשומה בקובץ `flussonic.conf` על השרת.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="p-4 bg-black/80 rounded-md border text-left dir-ltr text-xs overflow-auto text-green-300 font-mono">
                      {JSON.stringify(streamData.config_on_disk, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 text-right">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center justify-end gap-2">
                <TestTube2 className="h-7 w-7" />
                אבחון שידורים
            </h1>
            <p className="text-muted-foreground">
                הזן שם של שידור כדי לקבל תצוגה מפורטת של כל נתוני התצורה והסטטוס שלו מהשרת.
            </p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>בחר שידור לבדיקה</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleFetchStreamData(); }} className="flex flex-col sm:flex-row-reverse items-end gap-4">
                     <div className="w-full sm:w-auto flex-grow space-y-2">
                        <Label htmlFor="stream-name-input">שם השידור</Label>
                        <Input 
                            id="stream-name-input"
                            dir="ltr"
                            placeholder="לדוגמה: NahariyaA"
                            value={streamNameInput}
                            onChange={(e) => setStreamNameInput(e.target.value)}
                        />
                     </div>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Search className="ml-2 h-4 w-4"/>}
                        בדוק שידור
                    </Button>
                </form>
            </CardContent>
        </Card>

        {renderResults()}
    </div>
  );
}
