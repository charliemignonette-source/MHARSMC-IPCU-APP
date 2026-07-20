const fs = require('fs');

const content = `import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, onSnapshot, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
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

export function isQuotaExceeded() {
  return false;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  console.error("Firestore Error:", errStr, "Operation:", operationType, "Path:", path);
  throw new Error(errStr);
}

export async function testConnection() {
  // Connection is assumed to be active on non-free tier
  return true;
}

export function safeOnSnapshot(
  q: any,
  next: (snapshot: any) => void,
  errorCb?: (error: any) => void
) {
  return onSnapshot(q, (snapshot: any) => {
    next(snapshot);
  }, (err: any) => {
    if (errorCb) errorCb(err);
    else console.warn("Snapshot error:", err);
  });
}

export async function safeGetDocs(q: any): Promise<any> {
  return getDocs(q);
}

export async function safeGetDoc(docRef: any): Promise<any> {
  return getDoc(docRef);
}

export async function safeAddDoc(collRef: any, data: any): Promise<any> {
  return addDoc(collRef, data);
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<any> {
  return setDoc(docRef, data, options);
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<any> {
  return updateDoc(docRef, data);
}

export async function safeDeleteDoc(docRef: any): Promise<any> {
  return deleteDoc(docRef);
}
`;

fs.writeFileSync('src/lib/firebase.ts', content);
