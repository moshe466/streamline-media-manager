'use server';

import { getDb } from '@/lib/firebase-admin';

const requestsCollection = () => getDb().collection('telegram_link_access_requests');
const permissionsCollection = () => getDb().collection('telegram_link_permissions');

export type TelegramLinkPermissionRecord = {
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatId?: string;
  isActive?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
};

export async function createLinkAccessRequest(data: {
  telegramUserId: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatId: string | number;
}): Promise<{ created: boolean; reason?: 'already_pending' | 'already_approved' }> {
  const userId = String(data.telegramUserId);

  const existingPermission = await permissionsCollection().doc(userId).get();
  if (existingPermission.exists) {
    const p = existingPermission.data() as TelegramLinkPermissionRecord | undefined;
    if (p?.isActive === true) {
      return { created: false, reason: 'already_approved' };
    }
  }

  const existingRequest = await requestsCollection().doc(userId).get();
  if (existingRequest.exists) {
    const r = existingRequest.data() as { status?: string } | undefined;
    if (r?.status === 'pending') {
      return { created: false, reason: 'already_pending' };
    }
  }

  await requestsCollection().doc(userId).set({
    telegramUserId: userId,
    username: data.username || '',
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    chatId: String(data.chatId),
    status: 'pending',
    requestedAt: new Date().toISOString(),
  });

  return { created: true };
}

export async function isTelegramUserAllowedToCreateLinks(userId: string | number): Promise<boolean> {
  const doc = await permissionsCollection().doc(String(userId)).get();
  if (!doc.exists) return false;
  const data = doc.data() as TelegramLinkPermissionRecord | undefined;
  return data?.isActive === true;
}

export async function approveTelegramUserLinkAccess(params: {
  targetTelegramUserId: string | number;
  approvedByTelegramUserId: string | number;
}): Promise<void> {
  const targetId = String(params.targetTelegramUserId);
  const approvedBy = String(params.approvedByTelegramUserId);

  const reqDoc = await requestsCollection().doc(targetId).get();
  const reqData = (reqDoc.exists ? reqDoc.data() : {}) as Partial<TelegramLinkPermissionRecord> & { chatId?: string };

  await permissionsCollection().doc(targetId).set({
    telegramUserId: targetId,
    username: reqData.username || '',
    firstName: reqData.firstName || '',
    lastName: reqData.lastName || '',
    chatId: reqData.chatId || '',
    isActive: true,
    approvedAt: new Date().toISOString(),
    approvedBy,
  }, { merge: true });

  await requestsCollection().doc(targetId).set({
    status: 'approved',
    handledAt: new Date().toISOString(),
    handledBy: approvedBy,
  }, { merge: true });
}

export async function revokeTelegramUserLinkAccess(params: {
  targetTelegramUserId: string | number;
  revokedByTelegramUserId: string | number;
}): Promise<void> {
  const targetId = String(params.targetTelegramUserId);
  const revokedBy = String(params.revokedByTelegramUserId);

  await permissionsCollection().doc(targetId).set({
    isActive: false,
    revokedAt: new Date().toISOString(),
    revokedBy,
  }, { merge: true });
}

export async function rejectTelegramUserLinkAccess(params: {
  targetTelegramUserId: string | number;
  rejectedByTelegramUserId: string | number;
}): Promise<void> {
  const targetId = String(params.targetTelegramUserId);
  const rejectedBy = String(params.rejectedByTelegramUserId);

  await requestsCollection().doc(targetId).set({
    status: 'rejected',
    handledAt: new Date().toISOString(),
    handledBy: rejectedBy,
  }, { merge: true });
}

export async function getTelegramLinkAccessRequest(userId: string | number) {
  const doc = await requestsCollection().doc(String(userId)).get();
  return doc.exists ? doc.data() : null;
}

export async function listApprovedTelegramLinkUsers(): Promise<TelegramLinkPermissionRecord[]> {
  const snapshot = await permissionsCollection().where('isActive', '==', true).get();

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({
    telegramUserId: doc.id,
    ...(doc.data() as Omit<TelegramLinkPermissionRecord, 'telegramUserId'>)
  }));
}

export async function getTelegramLinkPermission(userId: string | number) {
  const doc = await permissionsCollection().doc(String(userId)).get();
  return doc.exists ? doc.data() : null;
}

export async function setTelegramUserCustomDisplayName(params: {
  targetTelegramUserId: string | number;
  customDisplayName: string;
}) {
  const targetId = String(params.targetTelegramUserId);

  await permissionsCollection().doc(targetId).set({
    customDisplayName: params.customDisplayName.trim(),
  }, { merge: true });
}


export type TelegramLinkAccessRequestRecord = {
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  chatId?: string;
  status?: string;
  requestedAt?: string;
  handledAt?: string;
  handledBy?: string;
};

export async function listPendingTelegramLinkAccessRequests(): Promise<TelegramLinkAccessRequestRecord[]> {
  const snapshot = await requestsCollection()
    .where('status', '==', 'pending')
    .get();

  if (snapshot.empty) return [];

  return snapshot.docs
    .map(doc => ({
      telegramUserId: doc.id,
      ...(doc.data() as Omit<TelegramLinkAccessRequestRecord, 'telegramUserId'>)
    }))
    .sort((a, b) => {
      const at = new Date(a.requestedAt || 0).getTime();
      const bt = new Date(b.requestedAt || 0).getTime();
      return bt - at;
    });
}
