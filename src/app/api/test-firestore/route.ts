import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    const testDoc = await db.collection('debug').doc('test').get();
    return NextResponse.json({ success: true, exists: testDoc.exists });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any).message });
  }
}
