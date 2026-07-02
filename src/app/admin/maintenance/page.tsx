"use client";

import { useEffect, useState } from "react";

const DEFAULT_TITLE = "🔧 המערכת נמצאת כעת בשדרוג";
const DEFAULT_MESSAGE = "אנחנו מבצעים שדרוגים ושיפורים במערכת כדי לספק לכם חוויית שימוש טובה, מהירה ויציבה יותר. נחזור לפעילות מלאה בקרוב. תודה על הסבלנות.";
const DEFAULT_GIF = "/maintenance.gif";

export default function AdminMaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance/status", { cache: "no-store" })
      .then(r => r.json())
      .then(data => setEnabled(!!data.enabled));
  }, []);

  async function toggleMaintenance(nextValue: boolean) {
    setSaving(true);

    await fetch("/api/maintenance/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: nextValue,
        title: DEFAULT_TITLE,
        message: DEFAULT_MESSAGE,
        gifUrl: DEFAULT_GIF,
      }),
    });

    setEnabled(nextValue);
    setSaving(false);
  }

  return (
    <main dir="rtl" className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">מצב שדרוג מערכת</h1>

      <div className="rounded-2xl border p-8 bg-white/5 space-y-6">
        <div>
          <h2 className="text-xl font-bold">
            {enabled ? "מצב שדרוג פעיל" : "מצב שדרוג כבוי"}
          </h2>
          <p className="text-sm opacity-70 mt-2">
            בלחיצה אחת ניתן להעביר את כל המשתמשים לדף שדרוג אוטומטי.
          </p>
        </div>

        <button
          disabled={saving}
          onClick={() => toggleMaintenance(!enabled)}
          className={`rounded-xl px-8 py-4 font-bold text-white ${enabled ? "bg-red-600" : "bg-green-600"}`}
        >
          {saving ? "מעדכן..." : enabled ? "כבה מצב שדרוג" : "הפעל מצב שדרוג"}
        </button>
      </div>
    </main>
  );
}
