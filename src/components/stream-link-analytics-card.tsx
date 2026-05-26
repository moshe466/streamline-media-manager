'use client';

import { useEffect, useState } from 'react';
import { Eye, AlertTriangle, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type StreamLinkAnalytics = {
  id: string;
  streamName: string;
  createdAt?: string;
  expiresAt?: string;
  currentViewers: number;
  peakViewers: number;
  uniqueIpCount: number;
  suspectedSharing: boolean;
  isBlocked: boolean;
  updatedAt?: string | null;
};

type ResponseData = {
  summary: {
    activeLinks: number;
    currentViewers: number;
    peakViewers: number;
    suspectedLinks: number;
    blockedLinks: number;
  };
  links: StreamLinkAnalytics[];
};

export function StreamLinkAnalyticsCard({ streamName }: { streamName: string }) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stream-link-analytics/${encodeURIComponent(streamName)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setData({
          summary: json.summary,
          links: json.links || [],
        });
      }
    } catch (error) {
      console.error('Failed loading stream link analytics', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!streamName) return;

    load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [streamName]);

  const summary = data?.summary;

  return (
    <Card className="text-right">
      <CardHeader className="text-right" dir="rtl">
        <div className="flex w-full items-center justify-between gap-2">
          <CardTitle className="w-full">
            <div className="flex w-full items-center justify-start gap-2 text-right">
              <Eye className="h-5 w-5" />
              <span>צפיות בלינקים של השידור</span>
            </div>
          </CardTitle>

          <button onClick={load} className="rounded-md p-1 hover:bg-muted transition" title="רענן">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!summary ? (
          <div className="text-sm text-muted-foreground">טוען נתונים...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Badge variant="secondary">🔗 לינקים פעילים: {summary.activeLinks}</Badge>
              <Badge variant="secondary">👁️ צופים עכשיו: {summary.currentViewers}</Badge>
              <Badge variant="secondary">📈 שיא: {summary.peakViewers}</Badge>
              <Badge variant={summary.suspectedLinks ? 'destructive' : 'secondary'}>
                ⚠️ חשודים: {summary.suspectedLinks}
              </Badge>
              <Badge variant={summary.blockedLinks ? 'destructive' : 'secondary'}>
                🚫 חסומים: {summary.blockedLinks}
              </Badge>
            </div>

            {!data?.links?.length ? (
              <div className="text-sm text-muted-foreground">
                אין כרגע לינקים פעילים לשידור הזה.
              </div>
            ) : (
              <div className="space-y-2">
                {data.links.map((link) => (
                  <div key={link.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">👁️ עכשיו: {link.currentViewers}</Badge>
                        <Badge variant="secondary">📈 שיא: {link.peakViewers}</Badge>
                        <Badge variant="secondary">🌍 IPs: {link.uniqueIpCount}</Badge>
                        {link.suspectedSharing && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            חשד לשיתוף
                          </Badge>
                        )}
                        {link.isBlocked && <Badge variant="destructive">חסום</Badge>}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground ltr text-left">
                        <LinkIcon className="h-3 w-3" />
                        <code>{link.id}</code>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div>נוצר: {link.createdAt ? new Date(link.createdAt).toLocaleString('he-IL') : '—'}</div>
                      <div>בתוקף עד: {link.expiresAt ? new Date(link.expiresAt).toLocaleString('he-IL') : '—'}</div>
                      <div>עודכן: {link.updatedAt ? new Date(link.updatedAt).toLocaleString('he-IL') : '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
