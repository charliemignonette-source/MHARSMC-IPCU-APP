const fs = require('fs');
let file = fs.readFileSync('src/constants.ts', 'utf8');

file = file.replace(/VAP_ADULT: \[\n\s*"Temperature", "FiO2", "PEEP", "WBC", "New onset rales\/ronchi\/stridor", "Repeat chest X‑ray done"\n\s*\],/, 'VAP_ADULT: [\n    "Temperature > 38 °C or < 36°C", "Increase in daily minimum FiO2", "Increase in daily minimum PEEP values", "WBC count ≥ 12,000 cells/mm3 or ≤ 4,000 cells/mm3", "New onset rales/ronchi/stridor", "Repeat chest X‑ray done"\n  ],');

fs.writeFileSync('src/constants.ts', file);
