const fs = require('fs');
const glob = require('glob'); // Not available by default, use a simple script

const files = [
  'src/App.tsx',
  'src/components/AMS.tsx',
  'src/components/Audits.tsx',
  'src/components/Dashboard.tsx',
  'src/components/HAI.tsx',
  'src/components/IPCUValidationConsole.tsx',
  'src/components/Maintenance.tsx',
  'src/components/NSI.tsx',
  'src/components/Outbreak.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  // Remove onSnapshot from firebase/firestore imports
  code = code.replace(/import \{([^}]+)\} from 'firebase\/firestore';/, (match, imports) => {
    const newImports = imports.split(',').map(s => s.trim()).filter(s => s !== 'onSnapshot');
    return `import { ${newImports.join(', ')} } from 'firebase/firestore';`;
  });
  
  // Add safeOnSnapshot import from firebase.ts
  if (code.includes('onSnapshot')) {
      if (code.includes('../lib/firebase')) {
        code = code.replace(/import \{([^}]+)\} from '\.\.\/lib\/firebase';/, (match, imports) => {
          if (!imports.includes('safeOnSnapshot')) {
             return `import { ${imports}, safeOnSnapshot } from '../lib/firebase';`;
          }
          return match;
        });
      } else if (code.includes('./lib/firebase')) {
        code = code.replace(/import \{([^}]+)\} from '\.\/lib\/firebase';/, (match, imports) => {
          if (!imports.includes('safeOnSnapshot')) {
             return `import { ${imports}, safeOnSnapshot } from './lib/firebase';`;
          }
          return match;
        });
      }
      
      // Replace onSnapshot( with safeOnSnapshot(
      code = code.replace(/onSnapshot\(/g, 'safeOnSnapshot(');
  }
  
  fs.writeFileSync(file, code);
}
