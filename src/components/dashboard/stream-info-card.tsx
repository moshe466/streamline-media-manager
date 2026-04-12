
"use client";

import type { StreamDetails } from "@/services/flussonic-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Video, Mic, Film, Zap, AudioLines, Users, Tv, Framer, Speaker, ExternalLink, Power, PowerOff, Server, Info, Fingerprint } from "lucide-react";
import { Badge } from "../ui/badge";

type StreamInfoCardProps = {
  stream: StreamDetails;
  display?: "full" | "compact" | "video" | "audio";
};

const DataRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number | boolean | undefined | null }) => {
    if (value === undefined || value === null || value === '' || value === 0) return null;
    let displayValue = value;
    if (typeof value === 'boolean') {
        displayValue = value ? 'כן' : 'לא';
    }
    return (
      <div className="flex items-center justify-between py-2 text-sm border-b last:border-b-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span>{label}</span>
        </div>
        <span className="font-mono text-muted-foreground">{String(displayValue)}</span>
      </div>
    );
};

export function StreamInfoCard({ stream, display = 'full' }: StreamInfoCardProps) {
  if (!stream || !stream.stats) {
    return <Card><CardContent><p className="text-center text-muted-foreground p-4">אין נתוני שידור זמינים.</p></CardContent></Card>
  }
  
  const videoTrack = stream.stats?.media_info?.tracks?.find((t: any) => t.content === 'video');
  const audioTrack = stream.stats?.media_info?.tracks?.find((t: any) => t.content === 'audio');
  
  const sourceVideoTrack = stream.stats?.input_media_info?.tracks?.find((t: any) => t.content === 'video');
  const sourceAudioTrack = stream.stats?.input_media_info?.tracks?.find((t: any) => t.content === 'audio');

  const inputStats = ((stream.inputs?.[0] && typeof stream.inputs[0] === 'object') ? (stream.inputs[0] as any).stats : null) as any;
  
  const hasVideo = videoTrack || sourceVideoTrack;
  const hasAudio = audioTrack || sourceAudioTrack;

  const renderVideoSection = () => (
     <>
        <h3 className="flex justify-start items-center gap-2 text-lg font-semibold mt-4">
            <Video className="h-5 w-5" />
            <span>וידאו (פלט)</span>
        </h3>
        <DataRow icon={Film} label="קידוד" value={videoTrack?.codec ?? sourceVideoTrack?.codec} />
        <DataRow icon={Zap} label="קצב נתונים (Bitrate)" value={videoTrack?.bitrate ? `${(videoTrack.bitrate / 1000).toFixed(0)} kbps` : (sourceVideoTrack?.bitrate ? `${(sourceVideoTrack.bitrate / 1000).toFixed(0)} kbps` : undefined)} />
        <DataRow icon={Zap} label="רזולוציה" value={(videoTrack?.width && videoTrack?.height) ? `${videoTrack.width}x${videoTrack.height}` : (sourceVideoTrack?.width && sourceVideoTrack?.height) ? `${sourceVideoTrack.width}x${sourceVideoTrack.height}`: undefined} />
        <DataRow icon={Framer} label="קצב פריימים (FPS)" value={videoTrack?.fps || sourceVideoTrack?.fps || videoTrack?.avg_fps || sourceVideoTrack?.avg_fps} />
    </>
  )

  const renderAudioSection = () => (
    <>
        <h3 className="flex justify-start items-center gap-2 text-lg font-semibold mt-4">
            <Mic className="h-5 w-5" />
            <span>שמע (פלט)</span>
        </h3>
        <DataRow icon={AudioLines} label="קידוד" value={audioTrack?.codec ?? sourceAudioTrack?.codec} />
        <DataRow icon={Zap} label="קצב נתונים (Bitrate)" value={audioTrack?.bitrate ? `${(audioTrack.bitrate / 1000).toFixed(0)} kbps` : (sourceAudioTrack?.bitrate ? `${(sourceAudioTrack.bitrate / 1000).toFixed(0)} kbps` : undefined)} />
        <DataRow icon={Zap} label="קצב דגימה" value={audioTrack?.sample_rate || sourceAudioTrack?.sample_rate ? `${audioTrack?.sample_rate || sourceAudioTrack?.sample_rate} Hz` : undefined} />
        <DataRow icon={Speaker} label="ערוצים" value={audioTrack?.channels ?? sourceAudioTrack?.channels} />
    </>
  )

  if (display === 'video') {
    return (
        <Card>
            <CardHeader>
                <h3 className="flex justify-start items-center gap-2 text-lg font-semibold">
                    <Video className="h-5 w-5" />
                    <span>וידאו</span>
                </h3>
            </CardHeader>
            <CardContent>
                {hasVideo ? (
                    <>
                        <DataRow icon={Film} label="קידוד" value={videoTrack?.codec ?? sourceVideoTrack?.codec} />
                        <DataRow icon={Zap} label="קצב נתונים" value={videoTrack?.bitrate ? `${(videoTrack.bitrate / 1000).toFixed(0)} kbps` : (sourceVideoTrack?.bitrate ? `${(sourceVideoTrack.bitrate / 1000).toFixed(0)} kbps` : undefined)} />
                        <DataRow icon={Zap} label="רזולוציה" value={(videoTrack?.width && videoTrack?.height) ? `${videoTrack.width}x${videoTrack.height}` : (sourceVideoTrack?.width && sourceVideoTrack?.height) ? `${sourceVideoTrack.width}x${sourceVideoTrack.height}`: undefined} />
                        <DataRow icon={Framer} label="FPS" value={videoTrack?.fps || sourceVideoTrack?.fps || videoTrack?.avg_fps || sourceVideoTrack?.avg_fps} />
                    </>
                ) : <p className="text-sm text-muted-foreground text-center">אין נתוני וידאו</p>}
            </CardContent>
        </Card>
    );
  }

  if (display === 'audio') {
      return (
        <Card>
            <CardHeader>
                <h3 className="flex justify-start items-center gap-2 text-lg font-semibold">
                    <Mic className="h-5 w-5" />
                    <span>שמע</span>
                </h3>
            </CardHeader>
            <CardContent>
                {hasAudio ? (
                    <>
                        <DataRow icon={AudioLines} label="קידוד" value={audioTrack?.codec ?? sourceAudioTrack?.codec} />
                        <DataRow icon={Zap} label="קצב נתונים" value={audioTrack?.bitrate ? `${(audioTrack.bitrate / 1000).toFixed(0)} kbps` : (sourceAudioTrack?.bitrate ? `${(sourceAudioTrack.bitrate / 1000).toFixed(0)} kbps` : undefined)} />
                        <DataRow icon={Zap} label="קצב דגימה" value={audioTrack?.sample_rate || sourceAudioTrack?.sample_rate ? `${audioTrack?.sample_rate || sourceAudioTrack?.sample_rate} Hz` : undefined} />
                        <DataRow icon={Speaker} label="ערוצים" value={audioTrack?.channels ?? sourceAudioTrack?.channels} />
                    </>
                ) : <p className="text-sm text-muted-foreground text-center">אין נתוני שמע</p>}
            </CardContent>
        </Card>
      )
  }
  
  // Full display
  return (
    <Card className="h-full">
        <CardContent className="p-6">
            <h3 className="flex justify-start items-center gap-2 text-lg font-semibold">
                <Info className="h-5 w-5" />
                <span>מידע כללי וקלט</span>
            </h3>
            <DataRow icon={Tv} label="סטטי" value={typeof stream.static === 'boolean' ? stream.static : (stream.static != null ? String(stream.static) : undefined)} />
            <DataRow icon={Tv} label="מיקום" value={stream.position != null ? String(stream.position) : undefined} />
            <DataRow icon={Fingerprint} label="סוכן משתמש" value={inputStats?.user_agent} />
            <DataRow icon={Server} label="פרוטוקול קלט" value={inputStats?.proto} />
            <DataRow icon={Server} label="כתובת IP קלט" value={inputStats?.ip} />

            {hasVideo ? renderVideoSection() : <p className="text-sm text-muted-foreground text-center py-4">אין נתוני וידאו</p>}
            <Separator className="my-4" />
            {hasAudio ? renderAudioSection() : <p className="text-sm text-muted-foreground text-center py-4">אין נתוני שמע</p>}
        </CardContent>
    </Card>
  )
}
