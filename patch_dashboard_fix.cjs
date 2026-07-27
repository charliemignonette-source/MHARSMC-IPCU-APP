const fs = require('fs');
let file = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

file = file.replace(/<\/AnimatePresence>\n    <\/div>\n  \);\n\}/, '</AnimatePresence>\n      </div>\n    </div>\n  );\n}');

fs.writeFileSync('src/components/Dashboard.tsx', file);
