import { NextResponse } from "next/server";
import { saveMaintenanceConfig } from "@/lib/maintenance-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();

  saveMaintenanceConfig({
    enabled: !!body.enabled,
    title: body.title || "המערכת בשדרוג",
    message: body.message || "אנחנו מבצעים שיפורים במערכת. נחזור בקרוב.",
    gifUrl: body.gifUrl || "/maintenance.gif",
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
