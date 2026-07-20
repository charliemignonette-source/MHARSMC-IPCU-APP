const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Replace the error handler in safeOnSnapshot to call deliverCachedData() if quota exceeded
code = code.replace(
`    if (err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted') {
      try { localStorage.setItem('ignore_this', 'true'); } catch(e) {}
      console.warn("Firestore quota limit reached. Falling back to cached data mode.");
    }`,
`    if (err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted') {
      try { localStorage.setItem('ignore_this', 'true'); } catch(e) {}
      console.warn("Firestore quota limit reached. Falling back to cached data mode.");
      deliverCachedData();
      return;
    }`
);

// Fallback logic for getCachedDocs
code = code.replace(
`      const cached = localStorage.getItem(cacheKey);`,
`      let cached = localStorage.getItem(cacheKey);
      if (!cached) cached = localStorage.getItem('fs_cache_query_fallback');`
);

// Fallback logic for getCachedDoc (assuming it uses the new cacheKey logic too? Or maybe just let it be, docs is the main issue)
fs.writeFileSync('src/lib/firebase.ts', code);
