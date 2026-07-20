const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const startStr = `    const pendingCounts = {`;
const endStr = `unsubNSI(); unsubOutbreaks();\n    };\n  }, [authStateUser, profile]);`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + `// Validation queries removed to save quota\n  }, [authStateUser, profile]);` + code.substring(endIndex);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Replaced');
} else {
  console.log('Not found');
}
