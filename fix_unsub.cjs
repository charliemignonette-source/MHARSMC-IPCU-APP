const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
`      console.warn("Firestore quota limit reached. Falling back to cached data mode.");
      deliverCachedData();
      return;`,
`      console.warn("Firestore quota limit reached. Falling back to cached data mode.");
      try { unsub(); } catch(e) {}
      deliverCachedData();
      return;`
);

fs.writeFileSync('src/lib/firebase.ts', code);
