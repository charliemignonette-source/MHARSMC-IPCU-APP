const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(`          amsTrends: last7Days,`, ``);
code = code.replace(`          topIndication,`, ``);
code = code.replace(`          topFocus,`, ``);

fs.writeFileSync('src/components/Dashboard.tsx', code);
