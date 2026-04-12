'use server';

import { testFirestoreConnection } from "@/debug/test-firestore";

export async function testFirestoreConnectionAction() {
    return await testFirestoreConnection();
}
