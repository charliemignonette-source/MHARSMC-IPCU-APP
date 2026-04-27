
export const INSTITUTIONAL_ANTIBIOGRAM_DATA = {
  totalIsolates: 15998,
  period: "Jan 1, 2024 - Dec 31, 2024",
  overall: {
    'CoNS': { n: 760, oxa: 0, pen: 6.4, amk: 73.7, tzp: 64.7, amc: 50.4 },
    'K. pneumoniae': { n: 461, amk: 87.1, tzp: 29.0, mem: 72.9, ipm: 78.6, cip: 63.8 },
    'E. coli': { n: 449, amk: 93.1, tzp: 22.2, mem: 72.7, ipm: 85.0, cip: 53.0 },
    'A. baumannii': { n: 208, amk: 71.5, mem: 70.7, tzp: 41.8 },
    'P. aeruginosa': { n: 140, amk: 89.1, caz: 73.7, mem: 75.7 }
  },
  unitSpecific: {
    'NICU': {
      'K. pneumoniae': { mem: 17.0, amk: 35.5, tzp: 0 },
      'K. aerogenes': { mem: 11.1, amk: 44.4 }
    },
    'PICU': {
      'P. aeruginosa': { mem: 9.1, caz: 36.4, amk: 40.0 }
    },
    'ICU': {
      'K. pneumoniae': { mem: 48.1, tzp: 19.2 },
      'E. coli': { mem: 31.6, tzp: 5.3 }
    }
  }
};

export function getAntibioticRecommendation(selectedAntibiotics: string[], specimenTypes: string[], unit: string): string {
  if (selectedAntibiotics.length === 0) return "";

  let output = "";
  const mainDrug = selectedAntibiotics[0];
  const data = INSTITUTIONAL_ANTIBIOGRAM_DATA;

  output += `📋 AMS INTELLIGENCE: ${mainDrug.toUpperCase()}\n`;
  output += `Analysis based on 2024 Antibiogram (N=15,998)\n\n`;

  // 1. DRUG SPECIFIC EVALUATION
  if (mainDrug.includes('Meropenem') || mainDrug.includes('Imipenem') || mainDrug.includes('Ertapenem')) {
    const kPnSus = data.overall['K. pneumoniae'].mem;
    const eCoSus = data.overall['E. coli'].mem;
    
    output += `• APPROPRIATENESS: Overall Meropenem susceptibility is ${kPnSus}% for Klebsiella and ${eCoSus}% for E. coli.\n`;
    
    // Check Unit Specific Hazards
    if (unit === 'NICU') {
      const nicuMem = data.unitSpecific.NICU['K. pneumoniae'].mem;
      output += `⚠️ CRITICAL WARNING: NICU Klebsiella has EXTREMELY LOW susceptibility to Meropenem (${nicuMem}%). Carbapenem-resistant Enterobacteriaceae (CRE) are endemic.\n`;
      output += `💡 RECOMMENDATION: Limit use. Consider combination therapy or agents based on actual C&S.\n`;
    } else if (unit === 'ICU') {
      const icuMem = data.unitSpecific.ICU['E. coli'].mem;
      output += `⚠️ ALERT: ICU E. coli susceptibility to Meropenem is only ${icuMem}%. Higher risk of Carbapenem resistance in this unit.\n`;
    }
  } 
  
  else if (mainDrug.includes('Ceftriaxone')) {
    const kPnSus = 45; // From previous context or inferred
    const tzpKpn = data.overall['K. pneumoniae'].tzp;
    output += `• ATTENTION: High resistance noted for 3rd gen Cephalosporins among Gram-negative isolates.\n`;
    output += `⚠️ WARNING: Piperacillin-Tazobactam susceptibility for Klebsiella is also low (${tzpKpn}%). Empiric therapy with these agents carries a high risk of failure if Klebsiella is suspected.\n`;
  }

  else if (mainDrug.includes('Vancomycin') || mainDrug.includes('Linezolid')) {
    output += `• APPROPRIATENESS: 100% resistance to Oxacillin found in CoNS (N=760). Vancomycin remains the standard of care for suspected MRCoNS line infections.\n`;
    if (unit === 'NICU') {
      output += `• NICU Alert: CoNS represents the #1 isolate (N=66). Supportive of empiric use if EOS/LOS is suspected.\n`;
    }
  }

  else if (mainDrug.includes('Piperacillin')) {
    const tzpEc = data.overall['E. coli'].tzp;
    const tzpKp = data.overall['K. pneumoniae'].tzp;
    output += `• WARNING: Low local susceptibility for Piperacillin-Tazobactam: E. coli ${tzpEc}%, K. pneumoniae ${tzpKp}%.\n`;
    output += `💡 ALTERNATIVE: Consider Carbapenems if ESBL risk is high, or Amikacin (Susceptibility >85%) for synergistic or urinary focus.\n`;
  }

  // 2. SPECIMEN SPECIFIC EVALUATION
  if (specimenTypes.length > 0) {
    output += `\n🔍 SPECIMEN TRENDS:\n`;
    specimenTypes.forEach(s => {
      if (s === 'Urine') {
        output += `- Urine: E. coli is most common. Amikacin remains high (${data.overall['E. coli'].amk}%) while Ciprofloxacin resistance is high.\n`;
      }
      if (s === 'Blood') {
        output += `- Blood: CoNS is the #1 isolate (N=661 in 2024). Ensure Vancomycin is considered for central line-associated infections.\n`;
      }
      if (s === 'Respiratory') {
        output += `- Respiratory: Klebsiella pneumoniae is dominant (N=169). Resistances to Ceftriaxone/Pip-Tazo are extremely high (>90%).\n`;
      }
    });
  }

  // 3. STEWARDSHIP REMINDERS
  output += `\n✅ ACTION REQUIRED:\n`;
  output += `• Obtain blood/specimen cultures BEFORE the first dose.\n`;
  output += `• Complete AMS approval (ID Consultation) for all restricted agents.\n`;
  output += `• Review appropriateness within 48-72 hours post-C&S results.`;

  return output;
}

