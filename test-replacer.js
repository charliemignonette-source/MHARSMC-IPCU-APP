import { collection, query, where, limit, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);
const q = query(collection(db, 'audits'), where('status', '==', 'PENDING'), limit(50));

function getQueryCacheKey(q) {
  try {
    if (!q) return 'unknown';
    if (q.path) return q.path;
    if (q.id) return q.id;
    
    // Try to safely stringify the query
    const str = JSON.stringify(q, (k, v) => {
        if (k === 'firestore' || k === '_authCredentials' || k === 'app' || k === 'db' || k === '_queue') return undefined;
        if (v && v.segments && Array.isArray(v.segments)) return v.segments.join('/');
        return v;
    });
    // Hash or return the string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return "q_" + Math.abs(hash).toString(16);
  } catch (e) {
    return 'query_fallback';
  }
}

console.log(getQueryCacheKey(q));
