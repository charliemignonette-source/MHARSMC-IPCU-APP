const fs = require('fs');
let file = fs.readFileSync('src/components/Maintenance.tsx', 'utf8');

file = file.replace(/setResetStatus\('SUCCESS'\);/g, 'setResetStatus(\'SUCCESS\');\n      showToast("Changes saved successfully");');

fs.writeFileSync('src/components/Maintenance.tsx', file);
