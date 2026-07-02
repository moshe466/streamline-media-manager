"use client";

import { useEffect, useState } from "react";

export default function AdminMaintenancePage() {
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("המערכת בשדרוג");
  const [message, setMessage] = useState("אנחנו מבצעים שיפורים במערכת. נחזור בקרוב.");
  const [gifUrl, setGifUrl] = useState("/maintenance.gif");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance/status", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        setEnabled(!!data.enabled);
        setTitle(data.title || "המערכת בשדרוג");
        setMessage(data.message || "");
        setGifUrl(data.gifUrl || "/maintenance.gif");
      });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/maintenance/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, title, message, gifUrl }),
    });
    setSaving(false);
    alert("נשמר בהצלחה");
  }

  return (
    <main dir="rtl" className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">מצב שדרוג מערכת</h1>

      <label className="flex items-center gap-3 text-lg">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        הפעל דף שדרוג לכל המשתמשים
      </label>

      <input className="w-full border rounded p-3" value={title} onChange={e => setTitle(e.target.value)} />

      <textarea className="w-full border rounded p-3 min-h-28" value={message} onChange={e => setMessage(e.target.value)} />

      <input dir="ltr" className="w-full border rounded p-3" value={gifUrl} onChange={e => setGifUrl(e.target.value)} />

      <button onClick={save} disabled={saving} className="bg-black text-white rounded px-6 py-3">
        {saving ? "שומר..." : "שמור"}
      </button>
    </main>
  );
}
