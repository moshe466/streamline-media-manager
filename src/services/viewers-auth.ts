
'use server';

import { getDb } from '@/lib/firebase-admin';
import type { Viewer } from './viewers';
export type { Viewer } from './viewers';

const getViewersCollection = () => getDb().collection('viewers');

/**
 * Fetches a single viewer by their ID from Firestore.
 * @param viewerId The ID of the viewer to fetch.
 * @returns A promise that resolves to the viewer object or null if not found.
 */
export async function getViewerById(viewerId: string): Promise<Viewer | null> {
  console.log(`Fetching viewer by ID (auth service): ${viewerId}`);
  try {
      // The viewer's ID is their lowercase email
      const doc = await getViewersCollection().doc(viewerId.toLowerCase()).get();
      if (!doc.exists) {
          console.warn(`Viewer with ID ${viewerId} not found in Firestore.`);
          return null;
      }
      return { id: doc.id, ...doc.data() } as Viewer;
  } catch (error) {
      console.error(`Error fetching viewer ${viewerId} from Firestore:`, error);
      return null;
  }
}
