import { NextResponse } from 'next/server';
import { listLinkAnalytics } from '@/services/link-analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const links = await listLinkAnalytics(50);
    return NextResponse.json({ success: true, links });
  } catch (error) {
    console.error('admin link analytics error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
