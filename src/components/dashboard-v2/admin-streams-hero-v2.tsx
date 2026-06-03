'use client';

import { PlusCircle, RadioTower, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  streamsCount: number;
  onlineCount: number;
  offlineCount: number;
  canCreateStreams: boolean;
  onCreateClick: React.ReactNode;
};

export function AdminStreamsHeroV2({
  streamsCount,
  onlineCount,
  offlineCount,
  canCreateStreams,
  onCreateClick,
}: Props) {
  return (
    <section className="admin-glass-card p-5 md:p-6">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.35em] text-cyan-300">
            מרכז שידורים
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-l from-white via-cyan-100 to-violet-300 bg-clip-text text-transparent">
            ניהול שידורים
          </h1>
          <p className="text-slate-400">
            שליטה, ניטור וניהול שידורים חיים.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full xl:w-auto">
          <div className="admin-kpi-card p-4 min-w-[120px]">
            <RadioTower className="h-5 w-5 text-violet-300 mb-2" />
            <div className="text-xs text-slate-400">סה״כ שידורים</div>
            <div className="text-3xl font-bold">{streamsCount}</div>
          </div>

          <div className="admin-kpi-card p-4 min-w-[120px]">
            <Wifi className="h-5 w-5 text-emerald-300 mb-2" />
            <div className="text-xs text-emerald-300">Online</div>
            <div className="text-3xl font-bold text-emerald-300">{onlineCount}</div>
          </div>

          <div className="admin-kpi-card p-4 min-w-[120px]">
            <WifiOff className="h-5 w-5 text-red-300 mb-2" />
            <div className="text-xs text-red-300">לא פעיל</div>
            <div className="text-3xl font-bold text-red-300">{offlineCount}</div>
          </div>
        </div>

        {canCreateStreams && (
          <div className="w-full xl:w-auto">
            {onCreateClick}
          </div>
        )}
      </div>
    </section>
  );
}
