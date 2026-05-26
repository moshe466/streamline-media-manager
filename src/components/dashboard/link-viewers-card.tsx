'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Link as LinkIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ViewerSession = {
  ip?: string;
  userAgent?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  watchSeconds?: number;
};

type LinkAnalytics = {
  id: string;
  linkId?: string;
  streamName?: string;
  currentViewers?: number;
  peakViewers?: number;
  totalHeartbeats?: number;
  updatedAt?: string;
  isLiveNow?: boolean;
  uniqueIpCount?: number;
  suspectedSharing?: boolean;
  currentSessions?: Record<string, ViewerSession>;
  history?: { at: string; viewers: number }[];
};

function formatSeconds(seconds = 0) {
  if (seconds < 60) return `${seconds} שנ׳`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} דק׳ ${rest} שנ׳`;
}

export function LinkViewersCard() {
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  async function toggleBlock(linkId: string, blocked: boolean) {
    try {
      await fetch('/api/admin/link-analytics/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, blocked }),
      });
      await load();
    } catch (error) {
      console.error('Failed toggling link block', error);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/link-analytics', { cache: 'no-store' });
      const data = await res.json();
      setLinks(data.links || []);
    } catch (error) {
      console.error('Failed loading link analytics', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const totalLiveViewers = useMemo(
    () => links.reduce((sum, link) => sum + (link.currentViewers || 0), 0),
    [links]
  );

  return (
    <Card className="text-right">
      <CardHeader className="flex flex-row-reverse items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          צופים בלינקים בזמן אמת
          <Badge variant="secondary">סה״כ עכשיו: {totalLiveViewers}</Badge>
        </CardTitle>

        <button onClick={load} className="rounded-md p-1 hover:bg-muted transition" title="רענן נתונים">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>

      <CardContent>
        {links.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            עדיין אין נתוני צפייה ללינקים.
          </div>
        ) : (
          <div className="space-y-3">
            {links.slice(0, 10).map((link) => {
              const sessions = Object.entries(link.currentSessions || {});
              const maxWatch = Math.max(0, ...sessions.map(([, s]) => s.watchSeconds || 0));
              const maxHistory = Math.max(1, ...(link.history || []).map(p => p.viewers || 0));

              return (
                <div key={link.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={link.isLiveNow ? 'default' : 'secondary'}>
                        {link.isLiveNow ? '🟢 מחובר עכשיו' : '⚪ לא פעיל'}
                      </Badge>
                      {link.suspectedSharing && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          חשד לשיתוף
                        </Badge>
                      )}
                      {(link as any).isBlocked && (
                        <Badge variant="destructive">חסום</Badge>
                      )}
                      <button
                        onClick={() => toggleBlock(link.linkId || link.id, !(link as any).isBlocked)}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {(link as any).isBlocked ? 'שחרר חסימה' : 'חסום לינק'}
                      </button>
                    </div>

                    <div className="font-medium truncate">
                      {link.streamName || 'שידור לא ידוע'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>👁️ עכשיו: {link.currentViewers || 0}</div>
                    <div>📈 שיא: {link.peakViewers || 0}</div>
                    <div>🌍 IPs: {link.uniqueIpCount || 0}</div>
                    <div>⏱️ צפייה מקס׳: {formatSeconds(maxWatch)}</div>
                  </div>

                  <div className="flex h-10 items-end gap-1 border rounded p-2">
                    {(link.history || []).slice(-30).map((point, idx) => (
                      <div
                        key={`${point.at}-${idx}`}
                        title={`${point.viewers} צופים`}
                        className="w-2 bg-primary rounded-sm"
                        style={{ height: `${Math.max(8, (point.viewers / maxHistory) * 32)}px` }}
                      />
                    ))}
                  </div>

                  <div className="space-y-1">
                    {sessions.slice(0, 5).map(([key, session]) => (
                      <div key={key} className="text-xs text-muted-foreground border rounded p-2">
                        <div>🌐 IP: <code>{session.ip || '—'}</code></div>
                        <div>⏱️ זמן צפייה: {formatSeconds(session.watchSeconds || 0)}</div>
                        <div className="truncate">🧭 {session.userAgent || '—'}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground ltr text-left">
                    <LinkIcon className="h-3 w-3" />
                    <code>{link.linkId || link.id}</code>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    עודכן: {link.updatedAt ? new Date(link.updatedAt).toLocaleString('he-IL') : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
