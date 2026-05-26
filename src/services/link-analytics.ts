'use server';

import { getDb } from '@/lib/firebase-admin';
import { sendTelegramLogMessage } from '@/services/telegram';

const analyticsCollection = () => getDb().collection('secure_link_analytics');

const ACTIVE_WINDOW_MS = 30 * 1000;
const ALERT_VIEWERS_THRESHOLD = 5;
const SUSPICIOUS_SESSIONS_THRESHOLD = 3;

export async function recordLinkHeartbeat(params: {
  linkId: string;
  streamName?: string;
  ip?: string;
  userAgent?: string;
}) {
  const now = new Date();
  const nowMs = now.getTime();

  const ref = analyticsCollection().doc(params.linkId);
  const doc = await ref.get();
  const data = doc.exists ? doc.data() || {} : {};

  const currentSessions = data.currentSessions || {};
  const sessionKey = `${params.ip || 'unknown'}:${params.userAgent || 'unknown'}`;

  const existingSession = currentSessions[sessionKey] || {};
  const firstSeenAt = existingSession.firstSeenAt || now.toISOString();

  currentSessions[sessionKey] = {
    ip: params.ip || '',
    userAgent: params.userAgent || '',
    firstSeenAt,
    lastSeenAt: now.toISOString(),
    watchSeconds: Math.max(
      0,
      Math.floor((nowMs - new Date(firstSeenAt).getTime()) / 1000)
    ),
  };

  const activeSessions = Object.fromEntries(
    Object.entries(currentSessions).filter(([, value]: any) => {
      return new Date(value.lastSeenAt).getTime() >= nowMs - ACTIVE_WINDOW_MS;
    })
  );

  const currentViewers = Object.keys(activeSessions).length;
  const peakViewers = Math.max(data.peakViewers || 0, currentViewers);

  const uniqueIps = Array.from(
    new Set(Object.values(activeSessions).map((s: any) => s.ip).filter(Boolean))
  );

  const suspectedSharing =
    uniqueIps.length >= SUSPICIOUS_SESSIONS_THRESHOLD ||
    currentViewers >= SUSPICIOUS_SESSIONS_THRESHOLD;

  const history = Array.isArray(data.history) ? data.history : [];
  const nextHistory = [
    ...history.slice(-59),
    {
      at: now.toISOString(),
      viewers: currentViewers,
    },
  ];

  const shouldAlert =
    currentViewers >= ALERT_VIEWERS_THRESHOLD &&
    data.lastViewerThresholdAlertCount !== currentViewers;

  await ref.set({
    linkId: params.linkId,
    streamName: params.streamName || data.streamName || '',
    currentViewers,
    peakViewers,
    isLiveNow: currentViewers > 0,
    currentSessions: activeSessions,
    uniqueIps,
    uniqueIpCount: uniqueIps.length,
    suspectedSharing,
    history: nextHistory,
    totalHeartbeats: (data.totalHeartbeats || 0) + 1,
    updatedAt: now.toISOString(),
    createdAt: data.createdAt || now.toISOString(),
    lastViewerThresholdAlertCount: shouldAlert
      ? currentViewers
      : data.lastViewerThresholdAlertCount || 0,
  }, { merge: true });

  if (shouldAlert) {
    await sendTelegramLogMessage(
      `🔔 לינק הגיע ל-${currentViewers} צופים\n\n` +
      `🔗 ${params.linkId}\n` +
      `📡 ${params.streamName || data.streamName || '—'}\n` +
      `⚠️ חשד לשיתוף: ${suspectedSharing ? 'כן' : 'לא'}`
    );
  }

  return { currentViewers, peakViewers, suspectedSharing };
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
