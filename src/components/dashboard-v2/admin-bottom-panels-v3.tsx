'use client';

import { Activity, AlertTriangle, UserCheck, Server, Zap } from 'lucide-react';

type Props = {
  onlineCount: number;
  offlineCount: number;
};

export function AdminBottomPanelsV3({ onlineCount, offlineCount }: Props) {
  return (
    <section className="grid gap-4 xl:grid-cols-4">
      <div className="admin-command-panel p-4">
        <h3 className="font-bold text-cyan-100 mb-3">פעילות אחרונה</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between"><span>12:45:01</span><span>שידור Commander הופעל</span></div>
          <div className="flex justify-between"><span>12:44:21</span><span>חיבור מקור לשידור 13</span></div>
          <div className="flex justify-between"><span>12:41:33</span><span>משתמש admin נכנס</span></div>
        </div>
      </div>

      <div className="admin-command-panel p-4">
        <h3 className="font-bold text-cyan-100 mb-3">התראות אחרונות</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-center justify-between"><span>נפילת מקור שידור</span><AlertTriangle className="h-4 w-4 text-red-400" /></div>
          <div className="flex items-center justify-between"><span>שימוש גבוה ברשת</span><Zap className="h-4 w-4 text-yellow-300" /></div>
          <div className="flex items-center justify-between"><span>שרת מדיה פעיל</span><Server className="h-4 w-4 text-emerald-300" /></div>
        </div>
      </div>

      <div className="admin-command-panel p-4 xl:col-span-1">
        <h3 className="font-bold text-cyan-100 mb-4">שידורים לפי סטטוס</h3>
        <div className="h-3 rounded-full overflow-hidden bg-slate-800 flex">
          <div className="bg-emerald-400" style={{ width: `${Math.max(1, onlineCount)}%` }} />
          <div className="bg-red-500 flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-center">
          <div>
            <div className="text-emerald-300 text-2xl font-bold">{onlineCount}</div>
            <div className="text-xs text-slate-400">פעילים</div>
          </div>
          <div>
            <div className="text-red-300 text-2xl font-bold">{offlineCount}</div>
            <div className="text-xs text-slate-400">לא פעילים</div>
          </div>
        </div>
      </div>

      <div className="admin-command-panel p-4">
        <h3 className="font-bold text-cyan-100 mb-3">קיצורי דרך</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button className="rounded-xl border border-cyan-400/10 bg-cyan-500/5 p-3">צור שידור</button>
          <button className="rounded-xl border border-cyan-400/10 bg-cyan-500/5 p-3">הוסף מקור</button>
          <button className="rounded-xl border border-cyan-400/10 bg-cyan-500/5 p-3">MultiView</button>
          <button className="rounded-xl border border-cyan-400/10 bg-cyan-500/5 p-3">דוח מערכת</button>
        </div>
      </div>
    </section>
  );
}
