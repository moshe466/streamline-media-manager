

'use server';

import { getSystemCredentials } from './users';
import { logEvent } from './logger';
import { format } from 'date-fns';
import { getDb } from '@/lib/firebase-admin';
import type { Client } from './clients';

const MORNING_API_BASE_URL = 'https://api.greeninvoice.co.il/api/v1';
const getSettingsCollection = () => getDb().collection('settings');

export async function getAuthToken(): Promise<string> {
    const tokenDocRef = getSettingsCollection().doc('morning_token');
    
    try {
        const tokenDoc = await tokenDocRef.get();
        if (tokenDoc.exists) {
            const tokenData = tokenDoc.data();
            if (tokenData && tokenData.token && tokenData.expiresAt && new Date(tokenData.expiresAt) > new Date()) {
                return tokenData.token;
            }
        }
    } catch (error) {
        console.warn("Could not read Morning token from Firestore. Will request a new one.", error);
    }


    console.log('Morning JWT token is expired or not available in Firestore. Requesting a new one.');
    
    const credentials = await getSystemCredentials();
    const apiKey = credentials.morningApiKey;
    const apiSecret = credentials.morningApiSecret;

    if (!apiKey || !apiSecret) {
        await logEvent('MORNING_API_ERROR', 'Morning API key or secret are not configured.');
        throw new Error('Morning API credentials are not configured in settings.');
    }

    const response = await fetch(`${MORNING_API_BASE_URL}/account/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: apiKey, secret: apiSecret }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        const errorMessage = `Failed to get Morning auth token: ${errorBody.errorMessage || response.statusText}`;
        await logEvent('MORNING_AUTH_FAILURE', errorMessage);
        throw new Error(errorMessage);
    }
    
    const data = await response.json();
    const newToken = data.token;
    const newExpiry = new Date(Date.now() + 55 * 60 * 1000).toISOString(); 

    await tokenDocRef.set({
        token: newToken,
        expiresAt: newExpiry,
    });

    await logEvent('MORNING_AUTH_SUCCESS', 'Successfully obtained and stored new Morning API token.');
    return newToken;
}

export type MorningDocument = {
    id: string;
    type: number;
    date: string;
    total: number;
    currency: 'ILS' | 'USD' | string;
    status: 'open' | 'paid' | 'late' | 'pending' | 'draft' | 'closed';
    url?: string;
    description?: string;
};

export type MorningClient = {
    id: string;
    name: string;
    email: string;
    phone: string;
    taxId: string;
    address: string;
};


export async function getDocuments(clientIdNumber: string, createdAfter?: string | null): Promise<MorningDocument[]> {
    if (!clientIdNumber || clientIdNumber.trim() === '') {
        console.log("No client ID number provided, skipping document fetch from Morning.");
        return [];
    }

    try {
        const token = await getAuthToken();

        const searchPayload: {
            client: { vatId: string },
            income: boolean,
            sort: string,
            order: string,
            from?: string
        } = {
            client: { vatId: clientIdNumber },
            income: true,
            sort: 'date',
            order: 'desc',
        };

        if (createdAfter) {
            searchPayload.from = format(new Date(createdAfter), 'yyyy-MM-dd');
        }
        
        await logEvent('MORNING_API_REQUEST', JSON.stringify(searchPayload, null, 2));

        const response = await fetch(`${MORNING_API_BASE_URL}/documents/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(searchPayload),
        });

        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
             await logEvent('MORNING_API_ERROR_RESPONSE', JSON.stringify({ status: response.status, body: responseData }, null, 2));

            if (response.status === 404 || (responseData.errorCode === 2411 && responseData.errorMessage?.includes("לא נמצאו תוצאות"))) {
                console.log(`No documents found in Morning for vatId: ${clientIdNumber}`);
                return [];
            }
            throw new Error(`Morning API error searching documents: ${responseData.errorMessage || response.statusText}`);
        }

        await logEvent('MORNING_API_RESPONSE', JSON.stringify(responseData, null, 2));
        
        return (responseData.items || []).map((item: any) => ({
            id: item.id,
            type: item.type,
            date: item.documentDate,
            total: item.amount,
            currency: item.currency,
            status: item.paymentStatus,
            url: item.url?.he || item.url?.origin,
            description: item.description,
        }));

    } catch (error) {
        console.error("Error fetching documents from Morning:", error);
        await logEvent('MORNING_API_ERROR', `Failed to fetch documents for client vatId ${clientIdNumber}. Error: ${(error as Error).message}`);
        return [];
    }
}


export async function findClientByVatId(vatId: string): Promise<MorningClient | null> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${MORNING_API_BASE_URL}/clients/search?query=${encodeURIComponent(vatId)}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const responseData = await response.json();
            throw new Error(responseData.errorMessage || `Failed with status ${response.status}`);
        }

        const responseData = await response.json();
        
        if (responseData && Array.isArray(responseData.items)) {
             // Find the client with the exact matching taxId
            const exactMatch = responseData.items.find((item: any) => item.taxId === vatId);
            if (exactMatch) {
                return {
                    id: exactMatch.id,
                    name: exactMatch.name,
                    email: exactMatch.emails?.[0],
                    phone: exactMatch.phone,
                    taxId: exactMatch.taxId,
                    address: exactMatch.address
                };
            }
        }
        
        return null;

    } catch (error) {
        console.error(`Error finding client by VAT ID ${vatId}:`, error);
        throw error;
    }
}

export async function findClientsByName(name: string): Promise<MorningClient[]> {
    try {
        const token = await getAuthToken();
        const response = await fetch(`${MORNING_API_BASE_URL}/clients/search?query=${encodeURIComponent(name)}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
             const responseData = await response.json();
             throw new Error(responseData.errorMessage || `Failed with status ${response.status}`);
        }

        const responseData = await response.json();
        
        if (responseData && Array.isArray(responseData.items)) {
            return responseData.items.map((item: any) => ({
                id: item.id,
                name: item.name,
                email: item.emails?.[0],
                phone: item.phone,
                taxId: item.taxId,
                address: item.address
            }));
        }

        return [];

    } catch (error) {
        console.error(`Error finding clients by name "${name}":`, error);
        throw error;
    }
}


async function ensureClientExistsInMorning(client: Client): Promise<string> {
    const token = await getAuthToken();
    
    // First, try to find the client by VAT ID if it exists
    if (client.idNumber) {
        const existingClient = await findClientByVatId(client.idNumber);
        if (existingClient) {
            console.log(`Client with vatId ${client.idNumber} found in Morning. Using existing client ID: ${existingClient.id}`);
            return existingClient.id;
        }
    }


    // If not found, create the client
    const payload = {
        name: client.nickname,
        emails: [client.email],
        taxId: client.idNumber,
        phone: client.phone,
        active: true
    };

    await logEvent('MORNING_API_REQUEST', `Creating client: ${JSON.stringify(payload, null, 2)}`);
    const response = await fetch(`${MORNING_API_BASE_URL}/clients`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    if (!response.ok) {
        await logEvent('MORNING_API_ERROR_RESPONSE', JSON.stringify({ status: response.status, body: responseData }, null, 2));
        throw new Error(`Failed to create client in Morning: ${responseData.errorMessage || response.statusText}`);
    }
    
    await logEvent('MORNING_API_RESPONSE', `Client created: ${JSON.stringify(responseData, null, 2)}`);
    return responseData.id;
}


export async function createMonthlyPriceQuote(
    client: Client,
    amount: number,
    description: string
): Promise<{ success: boolean; documentNumber?: string, error?: string }> {
    if (!client.idNumber) {
        return { success: false, error: 'Client has no VAT ID.' };
    }
    
    try {
        await ensureClientExistsInMorning(client);
        
        const token = await getAuthToken();

        const payload = {
            type: 10, // Document type for 'Price Quote'
            status: 'open', // Create the document as open/final
            lang: 'he',
            client: {
                vatId: client.idNumber,
                name: client.nickname,
            },
            income: [
                {
                    name: description, // Use name instead of description for items
                    quantity: 1,
                    price: amount,
                    currency: "ILS",
                    vatType: 'included'
                },
            ],
            currency: 'ILS',
            description: description, // Also add to the main description for visibility
        };

        await logEvent('MORNING_API_REQUEST', `Creating price quote: ${JSON.stringify(payload, null, 2)}`);
        const response = await fetch(`${MORNING_API_BASE_URL}/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        
        const responseData = await response.json();
        if (!response.ok) {
            await logEvent('MORNING_API_ERROR_RESPONSE', JSON.stringify({ status: response.status, body: responseData }, null, 2));
            throw new Error(`Failed to create price quote in Morning: ${responseData.errorMessage || response.statusText}`);
        }
        
        await logEvent('MORNING_API_RESPONSE', `Price quote created: ${JSON.stringify(responseData, null, 2)}`);
        return { success: true, documentNumber: responseData.number };

    } catch (error) {
        console.error("Error creating price quote in Morning:", error);
        return { success: false, error: (error as Error).message };
    }
}


type DocumentItem = {
    name: string;
    price: number;
    quantity: number;
    currency: string;
    vatType: string;
    sku?: string;
    discount?: { amount: number; type: string };
};

type PaymentItem = {
    type: number;
    date: string;
    amount: number;
    [key: string]: any; // For other payment details
};


type CreateDocumentPayload = {
    docType: number;
    status: 'draft' | 'open';
    clientId: string;
    items: DocumentItem[];
    payments?: PaymentItem[];
    remarks?: string;
    lang: string;
};

export async function createDocument(data: CreateDocumentPayload): Promise<{ success: boolean; documentId?: string; error?: string; }> {
    
    try {
        const clientRef = getDb().collection('clients').doc(data.clientId);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists) {
            throw new Error("Client not found");
        }
        const clientData = clientDoc.data() as Client;

        if (!clientData.idNumber) {
            throw new Error("Client is missing VAT ID.");
        }

        // Ensure client exists in Morning
        await ensureClientExistsInMorning(clientData);
        const token = await getAuthToken();

        const morningPayload: any = {
            type: data.docType,
            status: data.status,
            lang: data.lang,
            client: {
                vatId: clientData.idNumber,
                name: clientData.nickname, // Add the client name here
                emails: [clientData.email],
                phone: clientData.phone
            },
            income: data.items,
            currency: 'ILS', // Assuming ILS for simplicity for now
            description: data.remarks,
        };

        if (data.payments && data.payments.length > 0) {
            morningPayload.payment = data.payments;
        }

        await logEvent('MORNING_API_REQUEST', `Creating document: ${JSON.stringify(morningPayload, null, 2)}`);
        
        const response = await fetch(`${MORNING_API_BASE_URL}/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(morningPayload),
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            await logEvent('MORNING_API_ERROR_RESPONSE', JSON.stringify({ status: response.status, body: responseData }, null, 2));
            throw new Error(responseData.errorMessage || `Failed to create document in Morning: ${response.statusText}`);
        }

        await logEvent('MORNING_API_RESPONSE', `Document created: ${JSON.stringify(responseData, null, 2)}`);
        return { success: true, documentId: responseData.id };

    } catch (error) {
        console.error("Error creating document in Morning service:", error);
        return { success: false, error: (error as Error).message };
    }
}
