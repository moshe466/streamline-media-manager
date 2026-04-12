

'use server';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logEvent } from './logger';
import { type TelegramChat } from './clients';

// Defines the structure of a message waiting to be sent.
export type ArmedMessage = {
  id?: string;
  clientId: string;
  streamName: string;
  title: string;
  footer: string;
  targetChats: TelegramChat[];
  armedAt: string;
  status: 'armed' | 'sent';
};

const getMessagingCollection = () => getDb().collection('armed_messages');

/**
 * Saves or "arms" a message to be sent later based on a trigger.
 * It overwrites any existing armed message for the same stream.
 * @param message - The message object to be armed.
 * @returns A promise resolving to the ID of the armed message document.
 */
export async function armMessage(message: Omit<ArmedMessage, 'id' | 'status' | 'armedAt'>): Promise<string> {
  try {
    const docRef = getMessagingCollection().doc(`${message.clientId}_${message.streamName}`);
    
    const messageToSave = {
      ...message,
      status: 'armed',
      armedAt: new Date().toISOString(),
    };
    
    await docRef.set(messageToSave, { merge: true });
    
    await logEvent('MESSAGE_ARMED', `Message for stream ${message.streamName} has been armed by client ${message.clientId}.`);
    return docRef.id;
  } catch (error) {
    console.error("Error arming message:", error);
    await logEvent('MESSAGE_ARM_FAILED', `Failed to arm message for stream ${message.streamName}. Error: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Finds the armed message for a specific stream.
 * @param streamName - The name of the stream to check for an armed message.
 * @returns A promise resolving to the ArmedMessage object or null if not found.
 */
export async function findArmedMessageForStream(streamName: string): Promise<ArmedMessage | null> {
    try {
        const snapshot = await getMessagingCollection()
            .where('streamName', '==', streamName)
            .where('status', '==', 'armed')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as ArmedMessage;
    } catch (error) {
        console.error(`Error finding armed message for stream ${streamName}:`, error);
        return null;
    }
}


/**
 * Deletes an armed message after it has been sent.
 * @param messageId - The ID of the armed message document to delete.
 */
export async function disarmMessage(messageId: string): Promise<void> {
  try {
    await getMessagingCollection().doc(messageId).delete();
    await logEvent('MESSAGE_DISARMED', `Message ${messageId} was sent and disarmed.`);
  } catch (error) {
    console.error(`Error disarming message ${messageId}:`, error);
  }
}
