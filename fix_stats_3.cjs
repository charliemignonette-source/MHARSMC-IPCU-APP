const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(/const complianceData = \[[\s\S]*?\];/g, '');
code = code.replace(/const amsTrends = \[[\s\S]*?\];/g, '');

fs.writeFileSync('src/components/Dashboard.tsx', code);
