import { NextResponse } from 'next/server';
import { recordLinkHeartbeat } from '@/services/link-analytics';
import { getAndViewSecureLink } from '@/services/secure-links';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const linkId = String(body.linkId || '').trim();

    if (!linkId) {
      return NextResponse.json({ success: false, error: 'Missing linkId' }, { status: 400 });
    }

    const linkData = await getAndViewSecureLink(linkId);
    if (linkData.error || !linkData.streamName) {
      return NextResponse.json({ success: false, error: linkData.error || 'Invalid link' }, { status: 404 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';

    const userAgent = request.headers.get('user-agent') || '';

    const stats = await recordLinkHeartbeat({
      linkId,
      streamName: linkData.streamName,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error('link analytics heartbeat error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
