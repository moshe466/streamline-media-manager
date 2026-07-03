"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWeatherForBroadcastTeams, type CityWeather } from "@/services/weather";
import {
  Activity,
  AlertTriangle,
  CloudSun,
  Database,
  Eye,
  RadioTower,
  Server,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StreamCardImage } from "@/components/dashboard/stream-card-image";
import type { FlussonicStream } from "@/services/flussonic-types";

function getViewerCount(stream: any) {
  return Number(stream?.stats?.client_count ?? stream?.stats?.clients ?? stream?.client_count ?? 0);
}

export function LiveAlertsTicker({
  streams,
  isServerOnline,
  isDbConnected,
}: {
  streams: FlussonicStream[];
  isServerOnline: boolean;
  isDbConnected: boolean;
}) {
  const online = streams.filter((s: any) => s.status === "online").length;
  const offline = streams.length - online;
  const totalViewers = streams.reduce((sum: number, s: any) => sum + getViewerCount(s), 0);

  const items = [
    `🟢 ${online} שידורים פעילים`,
    `🔴 ${offline} שידורים לא פעילים`,
    `👁️ ${totalViewers} צופים מחוברים`,
    `${isServerOnline ? "🟢" : "🔴"} שרת מדיה ${isServerOnline ? "מחובר" : "מנותק"}`,
    `${isDbConnected ? "🟢" : "🔴"} Firestore ${isDbConnected ? "פעיל" : "מנותק"}`,
  ];

  return (
    <section className="admin-glass-card p-3 news-ticker">
      <div className="news-ticker-track text-sm text-cyan-100">
        {[...items, ...items, ...items].map((item, index) => (
          <span key={index}>{item}</span>
        ))}
      </div>
    </section>
  );
}

export function MiniMcrPanel({ streams }: { streams: FlussonicStream[] }) {
  const liveStreams = streams.filter((s: any) => s.status === "online").slice(0, 6);

  return (
    <section className="admin-glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/mcr">פתח MCR</Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold text-cyan-100">Mini MCR חי</h2>
          <p className="text-sm text-slate-500">תצוגה מהירה של שידורים פעילים</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {liveStreams.length ? liveStreams.map((stream: any) => (
          <Link
            key={stream.name}
            href={`/admin/streams/${encodeURIComponent(stream.name)}`}
            className="group relative aspect-video overflow-hidden rounded-2xl border border-cyan-400/10 bg-slate-950"
          >
            <StreamCardImage stream={stream} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            <div className="absolute bottom-2 right-2 left-2 flex justify-between items-end">
              <span className="text-xs text-cyan-100">{getViewerCount(stream)} צופים</span>
              <span className="font-bold text-white truncate">{stream.name}</span>
            </div>
          </Link>
        )) : (
          <div className="col-span-full rounded-2xl border border-cyan-400/10 p-8 text-center text-slate-400">
            אין כרגע שידורים פעילים להצגה.
          </div>
        )}
      </div>
    </section>
  );
}

export function StreamStatusMap({ streams }: { streams: FlussonicStream[] }) {
  return (
    <section className="admin-glass-card p-5">
      <h2 className="text-xl font-bold text-cyan-100 mb-4">מפת סטטוס שידורים</h2>

      <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-14 xl:grid-cols-20 gap-2">
        {streams.map((stream: any) => {
          const isOnline = stream.status === "online";
          return (
            <Link
              key={stream.name}
              href={`/admin/streams/${encodeURIComponent(stream.name)}`}
              title={`${stream.name} - ${isOnline ? "פעיל" : "לא פעיל"}`}
              className={`broadcast-grid-dot h-5 rounded-md border ${
                isOnline
                  ? "bg-emerald-400/80 border-emerald-300/40 shadow-[0_0_12px_rgba(52,211,153,.7)]"
                  : "bg-red-500/70 border-red-300/30 shadow-[0_0_10px_rgba(239,68,68,.55)]"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}

export function ActivityFeed({
  streams,
  isServerOnline,
  isDbConnected,
}: {
  streams: FlussonicStream[];
  isServerOnline: boolean;
  isDbConnected: boolean;
}) {
  const online = streams.filter((s: any) => s.status === "online").slice(0, 4);
  const time = new Date().toLocaleTimeString("he-IL");

  const events = [
    { icon: <Server className="h-4 w-4 text-cyan-300" />, text: `שרת מדיה ${isServerOnline ? "מחובר ופעיל" : "מנותק"}` },
    { icon: <Database className="h-4 w-4 text-cyan-300" />, text: `מסד נתונים ${isDbConnected ? "פעיל" : "מנותק"}` },
    ...online.map((s: any) => ({ icon: <RadioTower className="h-4 w-4 text-emerald-300" />, text: `השידור ${s.name} באוויר` })),
  ];

  return (
    <section className="admin-glass-card p-5">
      <h2 className="text-xl font-bold text-cyan-100 mb-4">Activity Feed</h2>
      <div className="space-y-3">
        {events.slice(0, 7).map((event, index) => (
          <div key={index} className="flex items-center justify-between border-b border-cyan-400/10 pb-2 text-sm">
            <span className="text-slate-500">{time}</span>
            <div className="flex items-center gap-2 text-slate-300">
              <span>{event.text}</span>
              {event.icon}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WeatherStrip() {
  const [weather, setWeather] = useState<CityWeather[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadWeather() {
      try {
        const data = await getWeatherForBroadcastTeams();
        if (mounted) {
          setWeather(data);
          setError(false);
        }
      } catch {
        if (mounted) setError(true);
      }
    }

    loadWeather();
    const interval = window.setInterval(loadWeather, 10 * 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section className="admin-glass-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-cyan-100">
          <CloudSun className="h-5 w-5 text-yellow-300" />
          מזג אוויר לצוותי שידור
        </div>

        <div className="flex flex-wrap gap-4 text-slate-300">
          {weather.length > 0 ? (
            weather.map((item) => (
              <span key={item.city}>
                {item.city} — {item.temperature}° · רוח {item.windSpeed} קמ״ש
              </span>
            ))
          ) : (
            <span className="text-slate-500">
              {error ? "לא ניתן לטעון מזג אוויר" : "טוען מזג אוויר..."}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function SystemHealthRing({
  isServerOnline,
  isDbConnected,
  onlineCount,
  totalStreams,
}: {
  isServerOnline: boolean;
  isDbConnected: boolean;
  onlineCount: number;
  totalStreams: number;
}) {
  const streamScore = totalStreams ? Math.round((onlineCount / totalStreams) * 100) : 0;
  const health = Math.round(((isServerOnline ? 35 : 0) + (isDbConnected ? 35 : 0) + Math.min(streamScore, 30)));
  const healthStyle = { "--health": `${health}%` } as React.CSSProperties;

  return (
    <section className="admin-glass-card p-5">
      <h2 className="text-xl font-bold text-cyan-100 mb-4">System Health</h2>

      <div className="flex items-center justify-center">
        <div
          className="system-health-ring h-36 w-36 sm:h-44 sm:w-44 rounded-full p-3"
          style={healthStyle}
        >
          <div className="h-full w-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
            <div className="text-3xl sm:text-4xl font-bold text-emerald-300">{health}%</div>
            <div className="text-xs text-slate-500">בריאות מערכת</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
        <div className="rounded-xl border border-cyan-400/10 p-2 text-slate-300">שרת</div>
        <div className="rounded-xl border border-cyan-400/10 p-2 text-slate-300">DB</div>
        <div className="rounded-xl border border-cyan-400/10 p-2 text-slate-300">שידורים</div>
      </div>
    </section>
  );
}

export function AdvancedStreamHoverGrid({ streams }: { streams: FlussonicStream[] }) {
  const featured = streams.slice(0, 8);

  return (
    <section className="admin-glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/streams">לכל השידורים</Link>
        </Button>
        <div>
          <h2 className="text-xl font-bold text-cyan-100">כרטיסי שידור מתקדמים</h2>
          <p className="text-sm text-slate-500">Hover מקצועי עם נתוני צפייה וניהול</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {featured.map((stream: any) => {
          const isOnline = stream.status === "online";
          return (
            <Link
              key={stream.name}
              href={`/admin/streams/${encodeURIComponent(stream.name)}`}
              className="group relative aspect-[16/8] overflow-hidden rounded-2xl border border-cyan-400/10 bg-slate-950"
            >
              {isOnline ? (
                <StreamCardImage stream={stream} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  אין מקור פעיל
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

              <div className="absolute bottom-2 right-2 left-2 flex items-end justify-between">
                <span className={isOnline ? "text-emerald-300 text-xs" : "text-red-300 text-xs"}>
                  {isOnline ? "פעיל" : "לא פעיל"}
                </span>
                <span className="text-white font-bold truncate">{stream.name}</span>
              </div>

              <div className="broadcast-card-hover flex flex-col justify-end p-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-cyan-500/10 p-2">
                    <Eye className="h-4 w-4 mx-auto text-cyan-300" />
                    {getViewerCount(stream)}
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-2">
                    <Wifi className="h-4 w-4 mx-auto text-emerald-300" />
                    מקור
                  </div>
                  <div className="rounded-xl bg-slate-500/10 p-2">
                    <Settings className="h-4 w-4 mx-auto text-slate-300" />
                    ניהול
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
