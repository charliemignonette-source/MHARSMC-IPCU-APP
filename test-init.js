import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
const app = initializeApp({ projectId: 'test' });
const db = initializeFirestore(app, { localCache: persistentLocalCache() }, 'my-db');
console.log(db.type);
