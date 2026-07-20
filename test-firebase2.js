import { collection, query, where, limit, getFirestore } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);
const q = query(collection(db, 'audits'), limit(50));

function getQueryCacheKey(q) {
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

console.log(getQueryCacheKey(q));
