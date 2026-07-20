const fs = require('fs');
let code = fs.readFileSync('src/components/IPCUValidationConsole.tsx', 'utf8');

code = code.replace(/safeOnSnapshot\(/g, 'safeGetDocs(');
code = code.replace(/const unsub(.*?) = safeGetDocs\((.*?), \(snap\) => \{/g, `safeGetDocs($2).then((snap) => {`);
code = code.replace(/import \{ db, handleFirestoreError, safeOnSnapshot, OperationType/g, `import { db, handleFirestoreError, safeGetDocs, OperationType`);

fs.writeFileSync('src/components/IPCUValidationConsole.tsx', code);
