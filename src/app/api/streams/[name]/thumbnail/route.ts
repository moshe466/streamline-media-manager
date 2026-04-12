import { NextRequest, NextResponse } from 'next/server';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Secured Thumbnail Proxy
 * Prevents direct exposure of the Flussonic IP and enforces authorization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const streamName = params.name;
  const userId = request.nextUrl.searchParams.get('uid')?.toLowerCase();
  const sessionId = request.nextUrl.searchParams.get('sid');

  if (!userId || !sessionId) {
    return new NextResponse('Unauthorized: Missing uid or sid', { status: 401 });
  }

  try {
    const db = getDb();
    
    // Proper multi-collection lookup
    // We try to find the user in any of the potential collections
    let userData: any = null;
    const collections = ['clients', 'users', 'viewers'];
    
    for (const coll of collections) {
        const doc = await db.collection(coll).doc(userId).get();
        if (doc.exists) {
            userData = doc.data();
            userData.role = userData.role || (coll === 'clients' ? 'client' : 'viewer');
            break;
        }
    }

    if (!userData) {
        console.error(`[Thumbnail Proxy] User not found: ${userId}`);
        return new NextResponse('Forbidden: User not found', { status: 403 });
    }
    
    const storedSessions = userData.activeSessionId || userData.broadcastSessionId;
    const sessionIsValid = Array.isArray(storedSessions) 
        ? storedSessions.includes(sessionId) 
        : storedSessions === sessionId;

    if (!sessionIsValid) {
        console.error(`[Thumbnail Proxy] Invalid session for user: ${userId}`);
        return new NextResponse('Forbidden: Invalid Session', { status: 403 });
    }

    // Resource Ownership Check for non-admins
    if (userData.role !== 'admin' && userData.role !== 'super-admin' && userData.role !== 'editor') {
        const permissions = userData.permissions || {};
        const allowedStreams = permissions.allowedStreams || {};
        const hasAccess = permissions.hasAllStreamsAccess || !!allowedStreams[streamName];
        
        if (!hasAccess) {
            console.error(`[Thumbnail Proxy] Access denied to stream ${streamName} for user ${userId}`);
            return new NextResponse('Forbidden: No stream access', { status: 403 });
        }
    }

    // Get connection details
    const { apiUrl, authHeader } = await getFlussonicConnectionDetails();
    
    // Construct the internal Origin URL for the thumbnail
    // We use the base API URL (IP based) instead of the public host to avoid DNS/SSL loopback issues
    const originBase = apiUrl.split('/streamer')[0];
    const previewUrl = `${originBase}/${streamName}/preview.jpg`;

    const response = await fetch(previewUrl, {
      headers: { 'Authorization': authHeader },
      cache: 'no-store',
      // Allow self-signed certs for internal communication if necessary
      // @ts-ignore
      next: { revalidate: 0 }
    });

    if (!response.ok) {
        console.error(`[Thumbnail Proxy] Origin responded with ${response.status} for ${streamName} at ${previewUrl}`);
        return new NextResponse('Not Found', { status: 404 });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=10', // Cache for 10 seconds
      },
    });

  } catch (error) {
    console.error(`[Thumbnail Proxy] Critical error for ${streamName}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
