const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
/    const pendingCounts = \{[\s\S]*?unsubNSI\(\); unsubOutbreaks\(\);\n    };\n  \}, \[authStateUser, profile\]\);/g,
`    // Validation badge calculation removed to reduce Firestore queries
  }, [authStateUser, profile]);`
);

fs.writeFileSync('src/App.tsx', code);
