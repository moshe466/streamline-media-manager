'use client';

import { useEffect, useState } from 'react';
import { Eye, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type LinkAnalytics = {
  id: string;
  linkId?: string;
  streamName?: string;
  currentViewers?: number;
  peakViewers?: number;
  totalHeartbeats?: number;
  updatedAt?: string;
};

export function LinkViewersCard() {
  const [links, setLinks] = useState<LinkAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
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

  return (
    <Card className="text-right">
      <CardHeader className="flex flex-row-reverse items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          צופים בלינקים בזמן אמת
        </CardTitle>
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </CardHeader>

      <CardContent>
        {links.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            עדיין אין נתוני צפייה ללינקים.
          </div>
        ) : (
          <div className="space-y-3">
            {links.slice(0, 10).map((link) => (
              <div key={link.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Eye className="h-3 w-3" />
                    עכשיו: {link.currentViewers || 0}
                  </Badge>
                  <div className="font-medium truncate">
                    {link.streamName || 'שידור לא ידוע'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>שיא צפיות: {link.peakViewers || 0}</div>
                  <div>פעימות: {link.totalHeartbeats || 0}</div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground ltr text-left">
                  <LinkIcon className="h-3 w-3" />
                  <code>{link.linkId || link.id}</code>
                </div>

                <div className="text-xs text-muted-foreground">
                  עודכן: {link.updatedAt ? new Date(link.updatedAt).toLocaleString('he-IL') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
