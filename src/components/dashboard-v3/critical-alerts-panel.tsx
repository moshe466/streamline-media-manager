import { AlertTriangle, WifiOff, Eye, CheckCircle } from "lucide-react";

export function CriticalAlertsPanel({ streams }: { streams: any[] }) {

  const offline = streams.filter((s: any) => s.status !== "online").slice(0, 10);

  return (
    <section className="admin-glass-card p-5">
      <div className="flex items-center gap-2 mb-4 justify-end">
        <h2 className="text-xl font-bold text-cyan-100">
          התראות קריטיות
        </h2>
        <AlertTriangle className="h-5 w-5 text-red-400" />
      </div>

      <div className="space-y-3">

        {offline.length === 0 ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 flex items-center justify-between">
            <span className="text-emerald-300">כל השידורים תקינים</span>
            <CheckCircle className="h-5 w-5 text-emerald-300" />
          </div>
        ) : (
          offline.map((stream: any) => (
            <div
              key={stream.name}
              className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4 flex items-center justify-between"
            >
              <div className="text-red-300">
                לא פעיל
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200">
                  {stream.name}
                </span>

                <WifiOff className="h-4 w-4 text-red-300" />
              </div>
            </div>
          ))
        )}

      </div>
    </section>
  );
}
