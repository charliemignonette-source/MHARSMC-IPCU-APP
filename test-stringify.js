import { collection, query, where, limit, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);
const q = query(collection(db, 'audits'), where('status', '==', 'PENDING'), limit(50));

function safeStringify(obj, depth = 0) {
  if (depth > 2) return '';
  if (typeof obj !== 'object' || obj === null) return String(obj);
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(x => safeStringify(x, depth + 1)).join(',') + ']';
  }

  let str = '';
  for (const key in obj) {
    if (key.startsWith('_')) {
        str += key + ':' + safeStringify(obj[key], depth + 1) + '|';
    }
  }
  return str;
}

function extractPath(q) {
    let str = "";
    try {
        str = JSON.stringify(q, (k, v) => {
            if (v && v.segments && Array.isArray(v.segments)) return v.segments.join('/');
            if (k === 'firestore' || k === '_authCredentials' || k === 'app' || k === 'db' || k === '_queue') return undefined;
            return v;
        });
    } catch(e) {}
    return str;
}
console.log("Safe:", safeStringify(q));
console.log("Extract:", extractPath(q));
