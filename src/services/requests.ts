
'use server';

import { getDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { logEvent } from './logger';
import type { Viewer } from './viewers';
import { getClientById, addClient, type Client, updateClientDetails } from './clients';
import { sendPermissionApprovedEmail, sendApprovalAndSummaryEmail } from './email';

const getRequestsCollection = () => getDb().collection('permissionRequests');
const getViewersCollection = () => getDb().collection('viewers');
const getClientsCollection = () => getDb().collection('clients');


export type PermissionRequest = {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'in_progress';
    requestedAt: string;
    resolvedAt?: string;
    requestorType: 'client' | 'viewer' | 'new_client_questionnaire';
    requestorId: string; 
    requestorNickname: string;
    requestorEmail: string;
    clientId: string;
    questionnaireData?: any;
    existingData?: Partial<Client>;
};


export async function createPermissionRequestFromQuestionnaire(formData: any, emailExists: boolean, existingClientData?: Client): Promise<{success: boolean, requestId: string, error?: string}> {
    const requestType = 'new_client_questionnaire';
    const email = formData.email.toLowerCase();
    
    // Base request object
    const newRequest: Omit<PermissionRequest, 'id' | 'existingData'> & { existingData?: Partial<Client> } = {
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requestorType: requestType,
        requestorId: email, // Use email as identifier for new signups
        requestorNickname: formData.firstName ? `${formData.firstName} ${formData.lastName}` : 'טופס חדש',
        requestorEmail: email,
        clientId: email, // For new clients, their email will be their ID
        questionnaireData: formData,
    };
    
    // Only add existingData if the client actually exists
    if (emailExists && existingClientData) {
        newRequest.existingData = {
            firstName: existingClientData.firstName,
            lastName: existingClientData.lastName,
            nickname: existingClientData.nickname,
            phone: existingClientData.phone,
            idNumber: existingClientData.idNumber,
            permissions: existingClientData.permissions,
        };
    }
    
    const docRef = await getRequestsCollection().add(newRequest);
    await logEvent('QUESTIONNAIRE_SUBMITTED', `New questionnaire submitted by ${email}. Email exists: ${emailExists}`);
    
    // Send Telegram notification via business HUB to break cycles
    const { sendTelegramLogMessage } = await import('./telegram');
    const companyName = formData.companyName ? ` (${formData.companyName})` : '';
    const message = 
        `📝 <b>טופס הרשמה חדש התקבל!</b> 📝\n\n` +
        `<b>סוג:</b> ${emailExists ? 'לקוח קיים ביקש עדכון' : 'לקוח חדש'}\n` +
        `<b>שם:</b> ${newRequest.requestorNickname}${companyName}\n` +
        `<b>אימייל:</b> ${newRequest.requestorEmail}\n` +
        `<b>טלפון:</b> ${formData.phone}\n\n` +
        `<a href="https://app.mizrachitv.co.il/admin/requests">לחץ כאן לצפייה וטיפול בבקשה</a>`;

    await sendTelegramLogMessage(message, 'onNewQuestionnaire');

    revalidatePath('/admin/requests');
    return { success: true, requestId: docRef.id };
}


export async function requestPermissionRenewalForViewer(viewerId: string, rawClientId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const viewerDoc = await getViewersCollection().doc(viewerId).get();
        if (!viewerDoc.exists) {
            return { success: false, error: "לא ניתן למצוא את פרטי הצופה." };
        }
        const viewerData = viewerDoc.data() as Viewer;
        
        const clientId = decodeURIComponent(rawClientId).toLowerCase();

        const existingRequestSnapshot = await getRequestsCollection()
            .where('requestorId', '==', viewerId)
            .where('status', 'in', ['pending', 'in_progress'])
            .limit(1)
            .get();

        if (!existingRequestSnapshot.empty) {
            return { success: false, error: "כבר קיימת בקשה פתוחה עבורך. אנא המתן לאישור." };
        }

        const requestId = getRequestsCollection().doc().id;
        const newRequest: Omit<PermissionRequest, 'id'> = {
            clientId,
            requestorId: viewerId,
            requestorNickname: viewerData.nickname,
            requestorEmail: viewerData.email,
            requestorType: 'viewer',
            status: 'pending',
            requestedAt: new Date().toISOString(),
        };

        await getRequestsCollection().doc(requestId).set(newRequest);
        await logEvent('PERMISSION_REQUEST_CREATED', `Viewer ${viewerData.nickname} (${viewerId}) requested permission renewal from client ${clientId}.`);
        
        // Notify the client about the request via dynamic import hub
        const { notifyViewerRequest } = await import('./notifications');
        await notifyViewerRequest(clientId, viewerData.nickname);

        revalidatePath(`/client/${clientId}/dashboard`);
        revalidatePath(`/client/${clientId}/requests`);
        
        return { success: true };
    } catch (error) {
        console.error("Error creating permission renewal request for viewer:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function requestPermissionRenewalForClient(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const clientRef = getClientsCollection().doc(clientId);
        const clientDoc = await clientRef.get();
        if (!clientDoc.exists) {
            return { success: false, error: "לא ניתן למצוא את פרטי הלקוח." };
        }
        const clientData = clientDoc.data() as Client;

        const existingRequestSnapshot = await getRequestsCollection()
            .where('requestorId', '==', clientId)
            .where('status', 'in', ['pending', 'in_progress'])
            .limit(1)
            .get();

        if (!existingRequestSnapshot.empty) {
            return { success: false, error: "כבר שלחת בקשת חידוש. המתן לאישור המנהל." };
        }

        const requestId = getRequestsCollection().doc().id;
        const newRequest: Omit<PermissionRequest, 'id'> = {
            clientId: clientId, // For clients, clientId and requestorId are the same
            requestorId: clientId,
            requestorNickname: clientData.nickname,
            requestorEmail: clientData.email,
            requestorType: 'client',
            status: 'pending',
            requestedAt: new Date().toISOString(),
        };

        const batch = getDb().batch();
        batch.set(getRequestsCollection().doc(requestId), newRequest);
        // Also update the client's status to "בהמתנה"
        batch.update(clientRef, { status: 'בהמתנה' });
        
        await batch.commit();

        await logEvent('PERMISSION_REQUEST_CREATED', `Client ${clientData.nickname} (${clientId}) requested account renewal.`);
        const { sendTelegramLogMessage } = await import('./telegram');
        const message = ` renewing a subscription\n\nClient Name: ${clientData.nickname}\nClient Email: ${clientData.email}\n\n<a href="https://app.mizrachitv.co.il/admin/requests">Go to requests page</a>`;
        await sendTelegramLogMessage(message, 'onClientRenewalRequest');

        revalidatePath(`/admin/requests`);
        
        return { success: true };
    } catch (error) {
        console.error("Error creating permission renewal request for client:", error);
        return { success: false, error: (error as Error).message };
    }
}

export async function getViewerRequestsByClientId(rawClientId: string): Promise<PermissionRequest[]> {
    try {
        const clientId = decodeURIComponent(rawClientId).toLowerCase();
        const snapshot = await getRequestsCollection()
            .where('clientId', '==', clientId)
            .where('requestorType', '==', 'viewer')
            .get();
            
        if (snapshot.empty) return [];
        
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionRequest));
        
        // Sort manually in code instead of in the query
        requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
        
        return requests;

    } catch (error: any) {
        if (error.code === 5 || error.code === 9) { // This can happen if the index is not ready
            console.warn("Could not query viewers requests by clientId, likely due to a missing Firestore index. Please check Firestore console for index creation links.");
            return [];
        }
        console.error(`Error fetching viewer requests for client ${rawClientId}:`, error);
        return [];
    }
}

export async function getAllRequestsForAdmin(): Promise<PermissionRequest[]> {
    try {
        const snapshot = await getRequestsCollection()
            .orderBy('requestedAt', 'desc')
            .get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionRequest));
    } catch (error) {
        console.error("Error fetching all requests for admin:", error);
        return [];
    }
}

export async function getPendingRequestsCount(rawClientId?: string): Promise<number> {
    try {
        let query = getRequestsCollection().where('status', '==', 'pending');
        
        if (rawClientId) {
             const clientId = decodeURIComponent(rawClientId).toLowerCase();
             query = query.where('clientId', '==', clientId);
        }

        const snapshot = await query.count().get();
        return snapshot.data().count;
    } catch (error: any) {
        if (error.code === 5 || error.code === 9) {
            console.warn("Could not query for pending requests count, likely due to a missing Firestore index.");
            return 0;
        }
        console.error("Error fetching pending requests count:", error);
        return 0;
    }
}


export async function getRequestById(id: string): Promise<PermissionRequest | null> {
    try {
        const doc = await getRequestsCollection().doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as PermissionRequest;
    } catch (error) {
        console.error(`Error fetching request by ID ${id}:`, error);
        return null;
    }
}

export async function resolveRequestByViewerId(viewerId: string, action: 'approve' | 'reject'): Promise<{success: boolean}> {
    const requestsRef = getRequestsCollection();
    const snapshot = await requestsRef.where('requestorId', '==', viewerId).where('status', '==', 'pending').get();

    if (snapshot.empty) {
        return { success: true }; 
    }

    const batch = getDb().batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: action === 'approve' ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() });
    });

    await batch.commit();
    await logEvent('VIEWER_REQUEST_RESOLVED_BY_EDIT', `Request(s) for viewer ${viewerId} were resolved as '${action}' after manual edit.`);
    revalidatePath('/admin/requests'); 
    revalidatePath('/client', 'layout');
    return { success: true };
}


export async function resolveRequest(
    requestId: string, 
    action: 'approve' | 'reject' | 'review', 
    resolverRole: 'client' | 'admin',
    defaultRenewalHours: number = 24
): Promise<{ success: boolean; error?: string; clientId?: string; }> {
    try {
        const requestRef = getRequestsCollection().doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) throw new Error("Request not found.");

        const requestData = requestDoc.data() as PermissionRequest;
        
        const batch = getDb().batch();

        let status: PermissionRequest['status'];
        let finalClientId: string | undefined = requestData.clientId;
        let isNewClient = false;
        
        switch(action) {
            case 'approve': status = 'approved'; break;
            case 'reject': status = 'rejected'; break;
            case 'review': status = 'in_progress'; break;
        }

        const resolutionData = {
            status,
            resolvedAt: new Date().toISOString(),
            resolvedBy: resolverRole
        };
        
        batch.update(requestRef, resolutionData);

        if (action === 'approve') {
             if (requestData.requestorType === 'new_client_questionnaire') {
                const client = await getClientById(requestData.clientId);
                if (client) {
                    isNewClient = !requestData.existingData; 
                    await sendApprovalAndSummaryEmail(client, isNewClient);
                }
            } else if (requestData.requestorType === 'viewer') {
                const newExpiryDate = new Date(Date.now() + defaultRenewalHours * 60 * 60 * 1000).toISOString();
                const viewerRef = getViewersCollection().doc(requestData.requestorId);
                batch.update(viewerRef, { expiresAt: newExpiryDate });
                
                const viewerDoc = await viewerRef.get();
                const viewerData = viewerDoc.data();
                if (viewerData) {
                    await sendPermissionApprovedEmail(viewerData.email, viewerData.nickname, `הגישה שלך למערכת הלקוח חודשה בהצלחה!`);
                }
            } else if (requestData.requestorType === 'client') {
                 const clientRef = getClientsCollection().doc(requestData.requestorId);
                 batch.update(clientRef, { status: 'פעיל', activeUntil: null });
                 const clientDoc = await clientRef.get();
                 const clientData = clientDoc.data();
                 if (clientData) {
                     await sendPermissionApprovedEmail(clientData.email, clientData.nickname, 'חשבונך חודש בהצלחה והוא פעיל כעת.');
                 }
            }
        } else if (action === 'review' && (requestData.requestorType === 'new_client_questionnaire' || requestData.requestorType === 'client')) {
            const formData = requestData.questionnaireData;
            
            if (requestData.requestorType === 'new_client_questionnaire' && !requestData.existingData) {
                const newClientData = {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    nickname: formData.companyName || `${formData.firstName} ${formData.lastName}`,
                    phone: formData.phone,
                    email: formData.email,
                    idNumber: formData.idNumber || '',
                };
                const { newClient } = await addClient(newClientData, 'admin'); 
                finalClientId = newClient.id;
                batch.update(requestRef, { clientId: finalClientId });
            } else if (requestData.existingData) { 
                const client = await getClientById(requestData.clientId);
                if (client) {
                     await updateClientDetails(client.id, {
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        nickname: formData.companyName || `${formData.firstName} ${formData.lastName}`,
                        phone: formData.phone,
                        idNumber: formData.idNumber || '',
                    });
                }
            }
             batch.update(requestRef, { status: 'in_progress' });
        }
        
        await batch.commit();
        
        await logEvent('PERMISSION_REQUEST_RESOLVED', `Request ${requestId} for ${requestData.requestorType} ${requestData.requestorNickname} was ${action}d by an ${resolverRole}.`);

        revalidatePath(`/client/${requestData.clientId}/requests`);
        revalidatePath(`/client/${requestData.clientId}/dashboard`);
        revalidatePath(`/admin/requests`);
        
        return { success: true, clientId: finalClientId };

    } catch (error) {
        console.error(`Error resolving request ${requestId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}

export async function cleanupRejectedRequests(): Promise<{ deletedCount: number }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); 
    const requestsRef = getRequestsCollection();
    
    try {
        const snapshot = await requestsRef
            .where('status', '==', 'rejected')
            .where('resolvedAt', '<', fiveMinutesAgo.toISOString())
            .get();

        if (snapshot.empty) {
            return { deletedCount: 0 };
        }

        const batch = getDb().batch();
        let deletedCount = 0;

        for (const doc of snapshot.docs) {
            const request = doc.data() as PermissionRequest;
            
            batch.delete(doc.ref);
            
            if (request.requestorType === 'new_client_questionnaire') {
                const clientRef = getClientsCollection().doc(request.clientId);
                const clientDoc = await clientRef.get();
                if(clientDoc.exists) {
                    batch.delete(clientRef);
                }
            }
            deletedCount++;
        }

        await batch.commit();
        if (deletedCount > 0) {
            await logEvent('REJECTED_REQUESTS_CLEANUP', `Cleaned up ${deletedCount} rejected requests older than 5 minutes.`);
        }
        
        return { deletedCount };

    } catch (error) {
        console.error("Error cleaning up rejected requests:", error);
        return { deletedCount: 0 };
    }
}

export async function forceDeleteRejectedRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const requestRef = getRequestsCollection().doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return { success: true }; 
        }

        const request = requestDoc.data() as PermissionRequest;
        const batch = getDb().batch();

        batch.delete(requestRef);

        if (request.requestorType === 'new_client_questionnaire' && request.status === 'rejected') {
            const clientRef = getClientsCollection().doc(request.clientId);
            const clientDoc = await clientRef.get();
            if (clientDoc.exists) {
                batch.delete(clientRef);
            }
        }
        
        await batch.commit();
        await logEvent('MANUAL_REQUEST_DELETE', `Request ${requestId} was manually deleted by an admin.`);
        revalidatePath('/admin/requests');
        return { success: true };
    } catch (error) {
        console.error(`Error forcing deletion for request ${requestId}:`, error);
        return { success: false, error: (error as Error).message };
    }
}
