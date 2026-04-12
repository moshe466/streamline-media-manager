// This file is intentionally left empty as the DVR auth logic has been removed.
// It can be deleted in a future cleanup.
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
