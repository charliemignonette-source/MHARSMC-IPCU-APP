const fs = require('fs');
let code = fs.readFileSync('src/components/HAI.tsx', 'utf8');
code = code.replace(/                        <tr>\n{cases\.length === 0 \&\& \(\n                        <tr>/g, '                      {cases.length === 0 && (\n                        <tr>');
fs.writeFileSync('src/components/HAI.tsx', code);
