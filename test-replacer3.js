import { collection, query, where, limit, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);
const c = collection(db, 'audits');

console.log("c.path:", c.path);
console.log("c.id:", c.id);
console.log("c._path:", c._path);
