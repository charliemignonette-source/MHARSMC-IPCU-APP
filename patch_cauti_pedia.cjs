const fs = require('fs');
let file = fs.readFileSync('src/constants.ts', 'utf8');

file = file.replace(/CAUTI_PEDIA: \[\n\s*"Fever ≥ 38°C", "Dysuria", "Urgency", "Frequency", "Costovertebral pain\/tenderness", "Suprapubic tenderness", "Chills", "No symptoms", "Urinalysis leukocyte positive", "Urinalysis nitrite positive", "Pyuria", "Urine gram stain positive", "Urine culture positive", "Blood culture positive"\n\s*\],/, 'CAUTI_PEDIA: [\n    "Fever ≥ 38°C", "Dysuria", "Urgency", "Frequency", "Costovertebral pain/tenderness", "Suprapubic tenderness", "Chills", "No symptoms", "Urinalysis leukocyte positive", "Urinalysis nitrite positive", "Pyuria", "Urine gram stain", "Urine culture", "Blood culture"\n  ],');

fs.writeFileSync('src/constants.ts', file);
