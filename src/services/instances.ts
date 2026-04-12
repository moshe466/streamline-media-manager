
'use server';

import { getDb } from '@/lib/firebase-admin';
import { logEvent } from './logger';

export type AppInstance = {
    id: string;
    name: string;
    domain?: string;
    logoUrl?: string;
    loginBackgroundUrl?: string;
    flussonicHost?: string;
    flussonicUsername?: string;
    flussonicPassword?: string;
    publicHost?: string;
    createdAt?: string;
};

const getInstancesCollection = () => getDb().collection('instances');

export async function getInstances(): Promise<AppInstance[]> {
    try {
        const snapshot = await getInstancesCollection().get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppInstance));
    } catch (error) {
        console.error("Error fetching instances:", error);
        return [];
    }
}

export async function getInstanceByDomain(domain: string): Promise<AppInstance | null> {
    try {
        const snapshot = await getInstancesCollection().where('domain', '==', domain).limit(1).get();
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AppInstance;
    } catch (error) {
        console.error(`Error fetching instance for domain ${domain}:`, error);
        return null;
    }
}

export async function getInstanceById(id: string): Promise<AppInstance | null> {
    try {
        const doc = await getInstancesCollection().doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as AppInstance;
    } catch (error) {
        console.error(`Error fetching instance ${id}:`, error);
        return null;
    }
}

export async function upsertInstance(instance: Partial<AppInstance>): Promise<{ success: boolean; error?: string }> {
    try {
        if (!instance.id) throw new Error("Instance ID is required.");
        await getInstancesCollection().doc(instance.id).set({
            ...instance,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        await logEvent('INSTANCE_UPSERT', `Instance ${instance.id} was updated/created.`);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}
