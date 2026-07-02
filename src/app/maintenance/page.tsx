"use client";

import { Cog } from "lucide-react";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6 text-white">
      <div className="text-center max-w-xl">

        <div className="relative w-64 h-64 mx-auto mb-10">

          <div className="absolute inset-0 rounded-full border border-orange-500/40 animate-pulse"></div>

          <Cog
            className="absolute top-6 left-10 w-20 h-20 text-gray-300 animate-spin"
            style={{animationDuration:"6s"}}
          />

          <Cog
            className="absolute top-10 right-6 w-28 h-28 text-gray-400 animate-spin"
            style={{
              animationDirection:"reverse",
              animationDuration:"8s"
            }}
          />

          <Cog
            className="absolute bottom-10 left-24 w-14 h-14 text-gray-500 animate-spin"
            style={{animationDuration:"4s"}}
          />

        </div>

        <h1 className="text-5xl font-bold mb-5">
          המערכת בשדרוג
        </h1>

        <p className="text-gray-400 text-xl mb-10">
          אנחנו מבצעים שיפורים במערכת.
          <br/>
          נחזור לפעילות מלאה בקרוב.
        </p>

        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/maintenance/status", { cache: "no-store" });
              const data = await res.json();
              if (!data?.enabled) {
                window.location.href = "/";
              } else {
                window.location.reload();
              }
            } catch {
              window.location.href = "/";
            }
          }}
          className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-orange-500 hover:text-white transition"
        >
          נסה שוב
        </button>

      </div>
    </main>
  );
}
