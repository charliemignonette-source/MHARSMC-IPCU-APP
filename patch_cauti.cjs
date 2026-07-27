const fs = require('fs');
let file = fs.readFileSync('src/constants.ts', 'utf8');

file = file.replace(/"Urine gram stain", "Urine culture", "Blood culture"/g, '"Urine gram stain positive", "Urine culture positive", "Blood culture positive"');

fs.writeFileSync('src/constants.ts', file);
