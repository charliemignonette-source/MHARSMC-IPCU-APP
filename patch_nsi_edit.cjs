const fs = require('fs');
let file = fs.readFileSync('src/components/NSI.tsx', 'utf8');

file = file.replace(/setIsAdding\(true\)/g, "setActiveTab('form')");
file = file.replace(/setIsAdding\(false\)/g, "setActiveTab('list')");

fs.writeFileSync('src/components/NSI.tsx', file);
