'use client';

import { AlertTriangle, Activity, Server, RadioTower, Users, Zap } from 'lucide-react';

type Props = {
  streamsCount: number;
  onlineCount: number;
  offlineCount: number;
  totalViewers: number;
};

export function AdminOpsPanelV3({ streamsCount, onlineCount, offlineCount, totalViewers }: Props) {
  const onlinePercent = streamsCount ? Math.round((onlineCount / streamsCount) * 100) : 0;

  return (
    <aside className="hidden 2xl:flex flex-col gap-4">
      <div className="admin-command-panel p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="rounded-full bg-red-500/15 text-red-300 px-2 py-0.5 text-xs">3</span>
          <h3 className="font-bold text-cyan-100">התראות מערכת</h3>
        </div>

        <div className="space-y-2 text-sm">
          <div className="rounded-xl border border-red-400/15 bg-red-500/8 p-3 flex items-center justify-between">
            <span className="text-slate-300">נפילת מקור שידור</span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="rounded-xl border border-yellow-400/15 bg-yellow-500/8 p-3 flex items-center justify-between">
            <span className="text-slate-300">שימוש גבוה ברשת</span>
            <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,.9)]" />
          </div>
          <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/8 p-3 flex items-center justify-between">
            <span className="text-slate-300">עדכון הגדרות שידור</span>
            <Activity className="h-4 w-4 text-cyan-300" />
          </div>
        </div>
      </div>

      <div className="admin-command-panel p-4">
        <h3 className="font-bold text-cyan-100 mb-4">סטטוס שרתים</h3>

        <div className="space-y-3 text-sm">
          {[
            ['Media Server #1', 82, 'פעיל'],
            ['Media Server #2', 67, 'פעיל'],
            ['Media Server #3', 91, 'אזהרה'],
            ['Backup Server', 45, 'פעיל'],
          ].map(([name, value, status]) => (
            <div key={name as string}>
              <div className="flex items-center justify-between mb-1">
                <span className={status === 'אזהרה' ? 'text-yellow-300' : 'text-emerald-300'}>{status}</span>
                <span className="text-slate-300">{name}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={status === 'אזהרה' ? 'h-full bg-yellow-400' : 'h-full bg-emerald-400'}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-command-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-cyan-300 font-bold">{totalViewers.toLocaleString('he-IL')}</span>
          <h3 className="font-bold text-cyan-100">צופים בזמן אמת</h3>
        </div>

        <div className="admin-mini-chart h-28 relative overflow-hidden">
          <div className="absolute bottom-4 left-4 right-4 h-[2px] bg-cyan-400 shadow-[0_0_18px_rgba(0,212,255,.8)]" />
          <div className="absolute bottom-10 left-10 h-[2px] w-36 rotate-[-18deg] bg-cyan-300 shadow-[0_0_18px_rgba(0,212,255,.8)]" />
          <div className="absolute bottom-16 left-40 h-[2px] w-32 rotate-[13deg] bg-cyan-300 shadow-[0_0_18px_rgba(0,212,255,.8)]" />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="rounded-xl border border-cyan-400/10 bg-cyan-500/5 p-3">
            <Users className="h-4 w-4 text-cyan-300 mb-1" />
            <div className="text-slate-400">צופים</div>
            <div className="text-xl font-bold text-cyan-200">{totalViewers.toLocaleString('he-IL')}</div>
          </div>
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/5 p-3">
            <RadioTower className="h-4 w-4 text-emerald-300 mb-1" />
            <div className="text-slate-400">זמינות</div>
            <div className="text-xl font-bold text-emerald-300">{onlinePercent}%</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
