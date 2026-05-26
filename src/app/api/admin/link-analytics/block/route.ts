import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const linkId = String(body.linkId || '').trim();
    const blocked = Boolean(body.blocked);

    if (!linkId) {
      return NextResponse.json({ success: false, error: 'Missing linkId' }, { status: 400 });
    }

    await getDb().collection('secure_link_analytics').doc(linkId).set({
      isBlocked: blocked,
      blockedAt: blocked ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true, linkId, isBlocked: blocked });
  } catch (error) {
    console.error('block link analytics error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
