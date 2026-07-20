const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
`  const getCachedDocs = () => {
    try {
      const cached = localStorage.getItem(cacheKey);`,
`  const getCachedDocs = () => {
    try {
      let cached = localStorage.getItem(cacheKey);
      if (!cached) cached = localStorage.getItem('fs_cache_query_fallback');`
);

fs.writeFileSync('src/lib/firebase.ts', code);
