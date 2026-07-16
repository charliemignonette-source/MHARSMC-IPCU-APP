import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, onSnapshot, Query, DocumentReference, DocumentData, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

let quotaAlertShown = false;

export function isQuotaExceeded() {
  try {
    return localStorage.getItem('firebase_quota_exceeded') === 'true';
  } catch (e) {
    return false;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }

  if (errStr.includes('Quota') || errStr.includes('quota')) {
    console.warn('Firestore Quota Exceeded: ', JSON.stringify(errInfo));
    if (!quotaAlertShown) {
      quotaAlertShown = true;
      setTimeout(() => {
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode until the quota resets. Please upgrade to a Blaze plan in Firebase Console to prevent this.");
      }, 1000);
    }
    return;
  }

  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connectivity check as requested in instructions
export async function testConnection() {
  const wasExceeded = isQuotaExceeded();
  try {
    const testDoc = doc(db, 'test', 'connection_test_doc_nonexistent');
    await getDocFromServer(testDoc);
    
    // If we reach here, getDocFromServer succeeded (even if doc doesn't exist)
    try {
      localStorage.removeItem('firebase_quota_exceeded');
    } catch (e) {}
    
    if (wasExceeded) {
      console.log("Firestore connection check: Quota was previously exceeded but is now available. Reloading page to restore full service...");
      setTimeout(() => window.location.reload(), 100);
    } else {
      console.log("Firestore connection check: Succeeded. Quota is active.");
    }
  } catch (error: any) {
    const errStr = error instanceof Error ? error.message : String(error);
    const code = error?.code;
    
    if (errStr.includes('Quota') || errStr.includes('quota') || code === 'resource-exhausted') {
      console.warn("Firestore connection check: Quota exceeded. Operating in limited mode.");
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
    } else if (errStr.includes('offline') || errStr.includes('unavailable') || code === 'unavailable') {
      console.warn("Firestore connection check: Client is offline or backend unavailable. Firestore will operate in offline mode.");
    } else {
      // Any other error (e.g., permission-denied, unauthenticated) indicates we are NOT blocked by Quota limits!
      try {
        localStorage.removeItem('firebase_quota_exceeded');
      } catch (e) {}
      
      if (wasExceeded) {
        console.log("Firestore connection check: Quota was previously exceeded but is now available. Reloading page...");
        setTimeout(() => window.location.reload(), 100);
      } else {
        console.log("Firestore connection check: Succeeded (non-quota response).");
      }
    }
  }
}

// Initial connection test
testConnection();

function getQueryCacheKey(q: any): string {
  try {
    if (!q) return 'unknown';
    if (q.path) return q.path;
    if (q.id) return q.id;
    if (q._query && q._query.path) {
      return q._query.path.segments?.join('/') || q._query.path.toString() || 'query';
    }
    return q.type || 'query';
  } catch (e) {
    return 'query_fallback';
  }
}

export function safeOnSnapshot(
  q: any,
  next: (snapshot: any) => void,
  error?: (error: any) => void
) {
  const cacheKey = 'fs_cache_' + getQueryCacheKey(q);

  const deliverCachedData = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const mockSnapshot = {
          docs: parsed.map((docData: any) => ({
            id: docData.id || 'mock-id',
            data: () => docData,
            exists: () => true,
          })),
          empty: parsed.length === 0,
          size: parsed.length,
          forEach: (cb: any) => parsed.forEach((docData: any, idx: number) => {
            cb({
              id: docData.id || 'mock-id',
              data: () => docData,
              exists: () => true,
            }, idx);
          }),
        };
        next(mockSnapshot);
      } else {
        next({ docs: [], empty: true, size: 0, forEach: () => {} } as any);
      }
    } catch (e) {
      console.warn("Failed to load cached onSnapshot data:", e);
    }
  };

  if (isQuotaExceeded()) {
    setTimeout(deliverCachedData, 0);
    const handleUpdate = () => {
      deliverCachedData();
    };
    window.addEventListener('fs_cache_update', handleUpdate);
    return () => {
      window.removeEventListener('fs_cache_update', handleUpdate);
    };
  }

  const unsub = onSnapshot(q, (snapshot: any) => {
    try {
      const docsData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...(doc.data() as any)
      }));
      localStorage.setItem(cacheKey, JSON.stringify(docsData));
    } catch (e) {
      console.warn("Failed to cache snapshot data:", e);
    }
    next(snapshot);
  }, (err: any) => {
     if (err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted') {
       try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
       if (!quotaAlertShown) {
           quotaAlertShown = true;
           alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
       }
       setTimeout(() => window.location.reload(), 1500);
     }
     if (error) {
       error(err);
     } else {
       console.warn("Snapshot error caught in safeOnSnapshot:", err);
     }
  });

  return unsub;
}

export async function safeGetDocs(q: any): Promise<any> {
  const cacheKey = 'fs_cache_' + getQueryCacheKey(q);

  const getCachedDocs = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          docs: parsed.map((docData: any) => ({
            id: docData.id || 'mock-id',
            data: () => docData,
            exists: () => true,
          })),
          empty: parsed.length === 0,
          size: parsed.length,
          forEach: (cb: any) => parsed.forEach((docData: any, idx: number) => {
            cb({
              id: docData.id || 'mock-id',
              data: () => docData,
              exists: () => true,
            }, idx);
          }),
        };
      }
    } catch (e) {
      console.warn("Failed to retrieve cached getDocs data:", e);
    }
    return { docs: [], empty: true, size: 0, forEach: () => {} };
  };

  if (isQuotaExceeded()) {
    return getCachedDocs();
  }

  try {
    const snapshot = await getDocs(q);
    try {
      const docsData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...(doc.data() as any)
      }));
      localStorage.setItem(cacheKey, JSON.stringify(docsData));
    } catch (e) {
      console.warn("Failed to cache getDocs data:", e);
    }
    return snapshot;
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      return getCachedDocs();
    }
    throw error;
  }
}

export async function safeGetDoc(docRef: any): Promise<any> {
  const docPath = docRef.path;
  const segments = docPath.split('/');
  const collPath = segments.slice(0, -1).join('/');
  const docId = segments[segments.length - 1];
  const cacheKey = 'fs_cache_' + collPath;

  const getCachedDoc = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const docData = parsed.find((d: any) => d.id === docId);
        if (docData) {
          return {
            id: docId,
            data: () => docData,
            exists: () => true,
          };
        }
      }
    } catch (e) {}
    return { id: docId, data: () => null, exists: () => false };
  };

  if (isQuotaExceeded()) {
    return getCachedDoc();
  }

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      try {
        const cached = localStorage.getItem(cacheKey);
        let parsed = cached ? JSON.parse(cached) : [];
        const idx = parsed.findIndex((d: any) => d.id === docId);
        const docData = { id: docId, ...(docSnap.data() as any) };
        if (idx !== -1) {
          parsed[idx] = docData;
        } else {
          parsed.push(docData);
        }
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch (e) {}
    }
    return docSnap;
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      return getCachedDoc();
    }
    throw error;
  }
}

export async function safeAddDoc(collRef: any, data: any): Promise<any> {
  const collPath = getQueryCacheKey(collRef);
  const cacheKey = 'fs_cache_' + collPath;

  const performCachedAdd = () => {
    const id = 'offline_' + Math.random().toString(36).substr(2, 9);
    const newDoc = { id, ...data };
    try {
      const cached = localStorage.getItem(cacheKey);
      const parsed = cached ? JSON.parse(cached) : [];
      parsed.push(newDoc);
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
      window.dispatchEvent(new Event('fs_cache_update'));
    } catch (e) {
      console.warn("Failed to write to local offline cache:", e);
    }
    return { id, path: `${collPath}/${id}` };
  };

  if (isQuotaExceeded()) {
    return performCachedAdd();
  }

  try {
    const docRef = await addDoc(collRef, data);
    try {
      const cached = localStorage.getItem(cacheKey);
      const parsed = cached ? JSON.parse(cached) : [];
      parsed.push({ id: docRef.id, ...data });
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (e) {}
    return docRef;
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      return performCachedAdd();
    }
    throw error;
  }
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {
  const docPath = docRef.path;
  const segments = docPath.split('/');
  const collPath = segments.slice(0, -1).join('/');
  const docId = segments[segments.length - 1];
  const cacheKey = 'fs_cache_' + collPath;

  const performCachedSet = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      let parsed = cached ? JSON.parse(cached) : [];
      const idx = parsed.findIndex((d: any) => d.id === docId);
      const updatedDoc = options?.merge && idx !== -1 
        ? { ...parsed[idx], ...data } 
        : { id: docId, ...data };
      
      if (idx !== -1) {
        parsed[idx] = updatedDoc;
      } else {
        parsed.push(updatedDoc);
      }
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
      window.dispatchEvent(new Event('fs_cache_update'));
    } catch (e) {
      console.warn("Failed to set doc in local cache:", e);
    }
  };

  if (isQuotaExceeded()) {
    performCachedSet();
    return;
  }

  try {
    await setDoc(docRef, data, options);
    performCachedSet();
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      performCachedSet();
      return;
    }
    throw error;
  }
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {
  const docPath = docRef.path;
  const segments = docPath.split('/');
  const collPath = segments.slice(0, -1).join('/');
  const docId = segments[segments.length - 1];
  const cacheKey = 'fs_cache_' + collPath;

  const performCachedUpdate = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      let parsed = cached ? JSON.parse(cached) : [];
      const idx = parsed.findIndex((d: any) => d.id === docId);
      if (idx !== -1) {
        parsed[idx] = { ...parsed[idx], ...data };
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
        window.dispatchEvent(new Event('fs_cache_update'));
      }
    } catch (e) {
      console.warn("Failed to update doc in local cache:", e);
    }
  };

  if (isQuotaExceeded()) {
    performCachedUpdate();
    return;
  }

  try {
    await updateDoc(docRef, data);
    performCachedUpdate();
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      performCachedUpdate();
      return;
    }
    throw error;
  }
}

export async function safeDeleteDoc(docRef: any): Promise<any> {
  const docPath = docRef.path;
  const segments = docPath.split('/');
  const collPath = segments.slice(0, -1).join('/');
  const docId = segments[segments.length - 1];
  const cacheKey = 'fs_cache_' + collPath;

  const performCachedDelete = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      let parsed = cached ? JSON.parse(cached) : [];
      parsed = parsed.filter((d: any) => d.id !== docId);
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
      window.dispatchEvent(new Event('fs_cache_update'));
    } catch (e) {
      console.warn("Failed to delete doc in local cache:", e);
    }
  };

  if (isQuotaExceeded()) {
    performCachedDelete();
    return;
  }

  try {
    await deleteDoc(docRef);
    performCachedDelete();
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
      if (!quotaAlertShown) {
        quotaAlertShown = true;
        alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
      }
      setTimeout(() => window.location.reload(), 1500);
      performCachedDelete();
      return;
    }
    throw error;
  }
}
