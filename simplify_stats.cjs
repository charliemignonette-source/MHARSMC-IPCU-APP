const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// We can just use regex or replace blocks that are unused.
// Let's replace the whole stats object being set!

const startStats = `        setStats({`;
const endStats = `        });`;

const startIdx = code.lastIndexOf(startStats);
const endIdx = code.indexOf(endStats, startIdx) + endStats.length;

if(startIdx !== -1 && endIdx !== -1) {
  let newStats = `        setStats({
          bundles: {
            today,
            mtd,
            units: Array.from(units.entries()).map(([name, scores]) => ({
              name,
              overall: scores.total > 0 ? (scores.compliant / scores.total) * 100 : 0
            }))
          },
          complianceData: last4Months.reverse(),
          hhCompliance: calcAvg(hhAudits),
          ppeCompliance: calcAvg(ppeAudits),
          envCompliance: calcAvg(envAudits),
          auditsCount: auditData.length,
          activeAMS,
          amsCount: amsData.length,
          validatedCount,
          totalCount,
          rawLogs: {
            boc: bocData,
            ams: amsData,
            nsi: nsiData,
            audits: auditData,
            outbreaks: outbreakData,
            hais: haiData
          }
        });`;
  code = code.substring(0, startIdx) + newStats + code.substring(endIdx);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Simplified stats object');
}

// Now let's remove unused computations.
const unusedToRemove = [
  `        // 2. Calculate AMS trends (Last 7 days)`,
  `        const topFocus = Object.entries(focuses).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';`
];

let a = code.indexOf(`        // 2. Calculate AMS trends (Last 7 days)`);
let b = code.indexOf(`        // Process Domain Metrics`);

if(a !== -1 && b !== -1) {
  code = code.substring(0, a) + code.substring(b);
  fs.writeFileSync('src/components/Dashboard.tsx', code);
  console.log('Removed AMS trends computation');
}

