import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const excluded =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (excluded) return NextResponse.next();

  try {
    const res = await fetch(new URL("/api/maintenance/status", req.url), { cache: "no-store" });
    const data = await res.json();

    if (data?.enabled) {
      return NextResponse.redirect(new URL("/maintenance", req.url));
    }
  } catch {}

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
