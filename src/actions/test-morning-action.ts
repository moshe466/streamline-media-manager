
'use server';

import { getAuthToken } from "@/services/morning";

export async function testMorningConnectionAction(): Promise<{success: boolean, message?: string, error?: string}> {
    try {
        await getAuthToken();
        return { success: true, message: "Successfully obtained auth token." };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
