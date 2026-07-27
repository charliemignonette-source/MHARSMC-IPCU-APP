const fs = require('fs');
let file = fs.readFileSync('src/components/Outbreak.tsx', 'utf8');

file = file.replace(/setView\("LIST"\);\n\s*resetForm\(\);/g, 'setView("LIST");\n      resetForm();\n      showToast("Changes saved successfully");');

fs.writeFileSync('src/components/Outbreak.tsx', file);
