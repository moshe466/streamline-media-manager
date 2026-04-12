

'use server';

import { getDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

const getLinksCollection = () => getDb().collection('quick-links');

export type QuickLink = {
  id: string;
  title: string;
  description: string;
  url: string;
  icon: string; // Icon name from lucide-react
};

export async function getQuickLinks(): Promise<QuickLink[]> {
  try {
    const snapshot = await getLinksCollection().get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickLink));
  } catch (error: any) {
     if (error.code === 5) { // NOT_FOUND, collection doesn't exist
        console.log("`quick-links` collection does not exist. Returning empty array.");
        return [];
    }
    console.error("Error fetching quick links:", error);
    return [];
  }
}

export async function addQuickLink(data: Omit<QuickLink, 'id'>): Promise<QuickLink> {
  const newLinkRef = await getLinksCollection().add(data);
  revalidatePath('/admin/links');
  revalidatePath('/admin/dashboard');
  return { id: newLinkRef.id, ...data };
}

export async function updateQuickLink(id: string, updates: Partial<Omit<QuickLink, 'id'>>): Promise<QuickLink> {
  const linkRef = getLinksCollection().doc(id);
  await linkRef.update(updates);
  revalidatePath('/admin/links');
  revalidatePath('/admin/dashboard');
  const updatedDoc = await linkRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as QuickLink;
}

export async function deleteQuickLink(id: string): Promise<{ success: boolean }> {
  await getLinksCollection().doc(id).delete();
  revalidatePath('/admin/links');
  revalidatePath('/admin/dashboard');
  return { success: true };
}
