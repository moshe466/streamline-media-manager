import { NextResponse } from "next/server";
import { getMaintenanceConfig } from "@/lib/maintenance-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getMaintenanceConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
