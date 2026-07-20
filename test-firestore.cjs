const fs = require('fs');

const content = `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, getDocFromServer, onSnapshot, Query, DocumentReference, DocumentData, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocsFromCache, getDocFromCache
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

let quotaAlertShown = false;
try {
  localStorage.removeItem('firebase_quota_exceeded');
} catch (e) {}

export function isQuotaExceeded() {
  try {
    return localStorage.getItem('firebase_quota_exceeded') === 'true';
  } catch (e) {
    return false;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  if (errStr.includes('Quota') || errStr.includes('quota') || errStr.includes('resource-exhausted')) {
    if (!quotaAlertShown) {
      quotaAlertShown = true;
      console.warn("Firestore quota limit reached. Falling back to cached data mode.");
    }
    return;
  }
  throw new Error(errStr);
}

export async function testConnection() {
  const wasExceeded = isQuotaExceeded();
  try {
    const testDoc = doc(db, 'test', 'connection_test_doc_nonexistent');
    await getDocFromServer(testDoc);
    
    try { localStorage.removeItem('firebase_quota_exceeded'); } catch (e) {}
    
    if (wasExceeded) {
      setTimeout(() => window.location.reload(), 100);
    }
  } catch (error: any) {
    const errStr = error instanceof Error ? error.message : String(error);
    const code = error?.code;
    
    if (errStr.includes('Quota') || errStr.includes('quota') || code === 'resource-exhausted') {
      try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
    } else if (errStr.includes('offline') || errStr.includes('unavailable') || code === 'unavailable') {
      console.warn("Firestore connection check: Client is offline.");
    } else {
      try { localStorage.removeItem('firebase_quota_exceeded'); } catch (e) {}
      if (wasExceeded) {
        setTimeout(() => window.location.reload(), 100);
      }
    }
  }
}

function handleQuotaError() {
  if (!isQuotaExceeded()) {
    try { localStorage.setItem('firebase_quota_exceeded', 'true'); } catch(e) {}
    if (!quotaAlertShown) {
      quotaAlertShown = true;
      console.warn("Firestore quota limit reached. Using IndexedDB cache only.");
    }
  }
}

export function safeOnSnapshot(
  q: any,
  next: (snapshot: any) => void,
  errorCb?: (error: any) => void
) {
  if (isQuotaExceeded()) {
    getDocsFromCache(q).then(snap => next(snap)).catch(e => console.warn(e));
    return () => {};
  }
  const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot: any) => {
    next(snapshot);
  }, (err: any) => {
    if (err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted') {
      handleQuotaError();
      try { unsub(); } catch(e) {}
      getDocsFromCache(q).then(snap => next(snap)).catch(e => console.warn(e));
    } else {
      if (errorCb) errorCb(err);
      else console.warn("Snapshot error:", err);
    }
  });
  return unsub;
}

export async function safeGetDocs(q: any): Promise<any> {
  if (isQuotaExceeded()) return getDocsFromCache(q);
  try {
    return await getDocs(q);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
      return getDocsFromCache(q);
    }
    throw error;
  }
}

export async function safeGetDoc(docRef: any): Promise<any> {
  if (isQuotaExceeded()) return getDocFromCache(docRef);
  try {
    return await getDoc(docRef);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
      return getDocFromCache(docRef);
    }
    throw error;
  }
}

export async function safeAddDoc(collRef: any, data: any): Promise<any> {
  if (isQuotaExceeded()) throw new Error("Cannot add documents while quota exceeded.");
  try {
    return await addDoc(collRef, data);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
    }
    throw error;
  }
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {
  if (isQuotaExceeded()) throw new Error("Cannot modify documents while quota exceeded.");
  try {
    return await setDoc(docRef, data, options);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
    }
    throw error;
  }
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {
  if (isQuotaExceeded()) throw new Error("Cannot modify documents while quota exceeded.");
  try {
    return await updateDoc(docRef, data);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
    }
    throw error;
  }
}

export async function safeDeleteDoc(docRef: any): Promise<any> {
  if (isQuotaExceeded()) throw new Error("Cannot modify documents while quota exceeded.");
  try {
    return await deleteDoc(docRef);
  } catch (error: any) {
    if (error.message?.includes('Quota') || error.message?.includes('quota') || error.code === 'resource-exhausted') {
      handleQuotaError();
    }
    throw error;
  }
}
`;

fs.writeFileSync('src/lib/firebase.ts', content);
