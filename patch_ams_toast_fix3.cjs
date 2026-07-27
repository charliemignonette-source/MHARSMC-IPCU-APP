const fs = require('fs');
let file = fs.readFileSync('src/components/AMS.tsx', 'utf8');

file = file.replace(/ \}\)\}\)\}/, ' })}');

fs.writeFileSync('src/components/AMS.tsx', file);
