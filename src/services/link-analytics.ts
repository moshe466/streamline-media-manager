'use server';

import { getDb } from '@/lib/firebase-admin';

const analyticsCollection = () => getDb().collection('secure_link_analytics');

export async function recordLinkHeartbeat(params: {
  linkId: string;
  streamName?: string;
  ip?: string;
  userAgent?: string;
}) {
  const now = new Date();
  const ref = analyticsCollection().doc(params.linkId);
  const doc = await ref.get();
  const data = doc.exists ? doc.data() || {} : {};

  const currentSessions = data.currentSessions || {};
  const sessionKey = `${params.ip || 'unknown'}:${params.userAgent || 'unknown'}`;

  currentSessions[sessionKey] = {
    ip: params.ip || '',
    userAgent: params.userAgent || '',
    lastSeenAt: now.toISOString(),
  };

  const activeCutoff = Date.now() - 30 * 1000;
  const activeSessions = Object.fromEntries(
    Object.entries(currentSessions).filter(([, value]: any) => {
      return new Date(value.lastSeenAt).getTime() >= activeCutoff;
    })
  );

  const currentViewers = Object.keys(activeSessions).length;
  const peakViewers = Math.max(data.peakViewers || 0, currentViewers);

  await ref.set({
    linkId: params.linkId,
    streamName: params.streamName || data.streamName || '',
    currentViewers,
    peakViewers,
    currentSessions: activeSessions,
    totalHeartbeats: (data.totalHeartbeats || 0) + 1,
    updatedAt: now.toISOString(),
    createdAt: data.createdAt || now.toISOString(),
  }, { merge: true });

  return { currentViewers, peakViewers };
}

export async function getLinkAnalytics(linkId: string) {
  const doc = await analyticsCollection().doc(linkId).get();
  return doc.exists ? doc.data() : null;
}

export async function listLinkAnalytics(limit = 20) {
  const snapshot = await analyticsCollection()
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
