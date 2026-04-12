

import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  // Original functionality
  try {
    const db = getDb();
    const batch = db.batch();

    const adminRef = db.collection('users').doc('admin@mizrachitv.co.il');
    batch.set(adminRef, {
      email: 'admin@mizrachitv.co.il',
      nickname: 'מנהל ראשי',
      role: 'super-admin',
      otp: '',
    });

    const clientRef = db.collection('clients').doc('dummyclient');
    batch.set(clientRef, {
      firstName: 'ישראל',
      lastName: 'ישראלי',
      nickname: 'לקוח בדיקה',
      phone: '050-1234567',
      email: 'client-test@example.com',
      otp: '222222',
      status: 'פעיל',
      activeUntil: null,
      streams: 0,
      permissions: { canCreateStreams: true, canDeleteStreams: false, hasAllStreamsAccess: true, maxPushDestinations: 2, maxStreams: 5, allowedStreams: {} },
    });

    const viewerRef = db.collection('viewers').doc('dummyviewer');
    batch.set(viewerRef, {
      clientId: 'dummyClient',
      firstName: 'צופה',
      lastName: 'צפוני',
      nickname: 'צופה בדיקה',
      phone: '052-7654321',
      email: 'viewer-test@example.com',
      otp: '333333',
      permissions: {},
    });

    await batch.commit();
    return NextResponse.json({ success: true, message: 'מסד הנתונים אותחל עם מנהל ראשי, לקוח דמה ומציג דמה.' });

  } catch (error: any) {
    console.error('Failed to initialize database:', error);
    return NextResponse.json({ error: 'Failed to initialize database', details: error.message }, { status: 500 });
  }
}
