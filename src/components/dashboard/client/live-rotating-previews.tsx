'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { FlussonicStream } from '@/services/flussonic';

function PreviewPlayer({ host, name }: { host: string; name: string }) {
  const src =
    'https://' +
    host +
    '/' +
    name +
    '/embed.html?proto=hls&dvr=false&muted=true&autoplay=true&controls=false&chromeless=true&quality=lowest';

  return (
    <iframe
      src={src}
      allow="autoplay"
      className="absolute inset-0 h-full w-full border-0 bg-black"
    />
  );
}

export function LiveRotatingPreviews({
  streams,
  clientId,
  host,
}: {
  streams: FlussonicStream[];
  clientId: string;
  host: string;
}) {
  const activeStreams = useMemo(
    () => streams.filter((stream) => stream.status === 'online'),
    [streams]
  );

  const [slots, setSlots] = useState([0, 1, 2, 3]);

  useEffect(() => {
    if (activeStreams.length <= 4) return;

    const timers = [
      window.setInterval(() => setSlots((prev) => prev.map((v, i) => i === 0 ? (v + 4) % activeStreams.length : v)), 50000),
      window.setInterval(() => setSlots((prev) => prev.map((v, i) => i === 1 ? (v + 4) % activeStreams.length : v)), 80000),
      window.setInterval(() => setSlots((prev) => prev.map((v, i) => i === 2 ? (v + 4) % activeStreams.length : v)), 50000),
      window.setInterval(() => setSlots((prev) => prev.map((v, i) => i === 3 ? (v + 4) % activeStreams.length : v)), 80000),
    ];

    return () => timers.forEach(window.clearInterval);
  }, [activeStreams.length]);

  if (activeStreams.length === 0) return null;

  const shown = slots.map((slot) => activeStreams[slot % activeStreams.length]).filter(Boolean);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {shown.map((stream, index) => (
        <Link
          key={stream.name + '-' + index}
          href={'/client/' + clientId + '/streams/' + encodeURIComponent(stream.name)}
        >
          <div className="group overflow-hidden rounded-2xl border border-white/10 bg-black transition hover:border-cyan-400/40">
            <div className="relative aspect-video overflow-hidden bg-black">
              <PreviewPlayer host={host} name={stream.name} />

              <div className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                LIVE
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-black/65 px-3 py-2 backdrop-blur">
                <p className="truncate text-xl font-black text-white">{stream.name}</p>
                <p className="text-sm text-green-300">Online</p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
