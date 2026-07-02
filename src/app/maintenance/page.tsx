export const dynamic = "force-dynamic";

async function getConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/maintenance/status`, { cache: "no-store" });
    return await res.json();
  } catch {
    return {
      title: "המערכת בשדרוג",
      message: "אנחנו מבצעים שיפורים במערכת. נחזור בקרוב.",
      gifUrl: "/maintenance.gif",
    };
  }
}

export default async function MaintenancePage() {
  const config = await getConfig();

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">{config.title}</h1>
        <p className="text-lg text-white/80">{config.message}</p>
        {config.gifUrl && (
          <img src={config.gifUrl} alt="המערכת בשדרוג" className="mx-auto max-h-72 object-contain rounded-xl" />
        )}
        <a href="/" className="inline-block px-6 py-3 rounded-lg bg-white text-black font-bold">
          נסה שוב
        </a>
      </div>
    </main>
  );
}
