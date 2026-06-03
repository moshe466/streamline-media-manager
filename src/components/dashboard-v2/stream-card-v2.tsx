'use client';

import Link from 'next/link';
import { MoreHorizontal, Trash2, Settings, Eye, Wifi, WifiOff, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { StreamCardImage } from '@/components/dashboard/stream-card-image';
import type { FlussonicStream } from '@/services/flussonic';
import type { Client } from '@/services/clients';

type Props = {
  stream: FlussonicStream;
  streamClient?: Client | null;
  userType: 'admin' | 'client';
  canDeleteStreams: boolean;
  actioningStream: string | null;
  onOpenPreview: (name: string) => void;
  onDeleteStream: (stream: FlussonicStream) => void;
  managementLink: string;
};

export function StreamCardV2({
  stream,
  streamClient,
  userType,
  canDeleteStreams,
  actioningStream,
  onOpenPreview,
  onDeleteStream,
  managementLink,
}: Props) {
  const isOnline = stream.status === 'online';

  return (
    <Card
      className={cn(
        'admin-stream-card overflow-hidden flex flex-col group text-right',
        isOnline ? 'admin-stream-online' : 'admin-stream-offline'
      )}
    >
      <div className="aspect-video relative overflow-hidden bg-slate-950">
        {isOnline ? (
          <StreamCardImage stream={stream} client={streamClient} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(124,58,237,.18),transparent_45%),linear-gradient(135deg,#020617,#0f172a)]">
            <WifiOff className="h-12 w-12 text-red-300/80 mb-3" />
            <div className="text-[11px] tracking-[0.35em] text-red-200/80">אין מקור שידור פעיל</div>
            <div className="text-sm text-slate-500 mt-1">ממתין לחיבור מקור שידור</div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

        <div
          className={cn(
            'absolute top-3 right-3 flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border backdrop-blur-md',
            isOnline
              ? 'bg-green-500/15 border-green-400/30 text-green-200'
              : 'bg-red-500/15 border-red-400/30 text-red-200'
          )}
        >
          <span className={cn('admin-status-dot', isOnline ? 'online' : 'offline')} />
          {isOnline ? 'פעיל' : 'לא פעיל'}
        </div>

        <div className="absolute bottom-3 right-3 left-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] tracking-[0.28em] text-cyan-200/80">
              מזהה שידור
            </div>
            <div className="text-lg font-bold text-white truncate">{stream.name}</div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200 backdrop-blur-md">
            {isOnline ? 'מקור פעיל' : 'לא פעיל'}
          </div>
        </div>
      </div>

      <CardContent className="p-3 flex-1">
        <CardTitle className="truncate text-lg" title={stream.name}>
          {stream.name}
        </CardTitle>

        <CardDescription className="mt-1 truncate text-slate-400" title={stream.title}>
          {stream.title || 'ללא כותרת'}
        </CardDescription>

        {stream.comment && userType === 'admin' && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-2 justify-end">
            <span>{stream.comment}</span>
            <User className="h-3 w-3" />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="text-slate-500">RTMP</div>
            <div className="font-mono text-cyan-200">מוכן</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="text-slate-500">HLS</div>
            <div className="font-mono text-cyan-200">אוטומטי</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <div className="text-slate-500">מצב</div>
            <div className={cn('font-mono', isOnline ? 'text-emerald-300' : 'text-red-300')}>
              {isOnline ? 'פעיל' : 'ממתין'}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-white/10 bg-white/[0.03] p-3 flex justify-between gap-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => onOpenPreview(stream.name)}
            disabled={!isOnline}
          >
            <Eye className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                disabled={actioningStream === stream.name}
              >
                {actioningStream === stream.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="text-right">
              {canDeleteStreams && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      <span>מחק שידור</span>
                    </DropdownMenuItem>
                  </AlertDialogTrigger>

                  <AlertDialogContent className="text-right">
                    <AlertDialogHeader>
                      <AlertDialogTitle>למחוק את {stream.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        פעולה זו לא ניתנת לביטול.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDeleteStream(stream)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        כן, מחק
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          asChild
          variant="secondary"
          className="flex-1 rounded-full bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 border border-violet-400/20"
          size="sm"
        >
          <Link href={managementLink}>
            <Settings className="ml-2 h-4 w-4" />
            ניהול
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
