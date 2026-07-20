const fs = require('fs');
let code = fs.readFileSync('src/components/Audits.tsx', 'utf8');

const startStr = `{/* Hand hygiene detail render */}`;
const endStr = `            {type === 'SAFE_INJECTION' && details?.safeInjection && (`;
const idxStart = code.indexOf(startStr);
const idxEnd = code.indexOf(endStr);

console.log("Start idx:", idxStart);
console.log("End idx:", idxEnd);

