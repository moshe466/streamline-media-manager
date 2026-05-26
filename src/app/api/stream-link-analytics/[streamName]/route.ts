import { NextResponse } from 'next/server';
import { getActiveLinksForStream } from '@/services/secure-links';
import { getLinkAnalytics } from '@/services/link-analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { streamName: string } }
) {
  try {
    const streamName = decodeURIComponent(params.streamName);
    const links = await getActiveLinksForStream(streamName);

    const enrichedLinks = await Promise.all(
      links.map(async (link) => {
        const analytics = await getLinkAnalytics(link.id);

        return {
          id: link.id,
          streamName: link.streamName,
          createdAt: link.createdAt?.toISOString?.() || String(link.createdAt || ''),
          expiresAt: link.expiresAt?.toISOString?.() || String(link.expiresAt || ''),
          currentViewers: (analytics as any)?.currentViewers || 0,
          peakViewers: (analytics as any)?.peakViewers || 0,
          uniqueIpCount: (analytics as any)?.uniqueIpCount || 0,
          suspectedSharing: Boolean((analytics as any)?.suspectedSharing),
          isBlocked: Boolean((analytics as any)?.isBlocked),
          updatedAt: (analytics as any)?.updatedAt || null,
        };
      })
    );

    const summary = {
      activeLinks: enrichedLinks.length,
      currentViewers: enrichedLinks.reduce((sum, link) => sum + link.currentViewers, 0),
      peakViewers: Math.max(0, ...enrichedLinks.map(link => link.peakViewers)),
      suspectedLinks: enrichedLinks.filter(link => link.suspectedSharing).length,
      blockedLinks: enrichedLinks.filter(link => link.isBlocked).length,
    };

    return NextResponse.json({
      success: true,
      streamName,
      summary,
      links: enrichedLinks,
    });
  } catch (error) {
    console.error('stream link analytics error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
