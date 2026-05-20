export const UNITS = [
  'ICU 1', 'ICU 2', 'NICU', 'PICU', 'Ward 1A', 'Ward 1B', 'Ward 1C', 'Ward 2A', 'Ward 2B', 
  'Ward 3A', 'Ward 3B', 'Ward 4', 'Ward 5A', 'Ward 5B', 'Ward 5C', 'Ward 6', 
  'C2', 'C3', 'C4', 'ER', 'OPD 1', 'OPD 2', 'OR', 'DR', 'OB Ward', 
  'Surgical Ward', 'Medical Ward', 'Pedia Ward', 'IPCU', 'HDU 1', 'HDU 2', 'LABORATORY', 'RADIOLOGY',
  'OBER', 'Dental Clinic', 'TB DOTS', 'NBS', '2D Echo', 'Blood Bank', 'Microbiology', 'CSR', 'CSSD', 'Housekeeping', 'Laundry and Linen', 'OPD Lab', 'Oncology', 'RTU', 'Dietary', 'Rehabilitation', 'Acute Stroke Unit'
];

export const STAFF_TYPES = [
  'Doctor', 'Nurse', 'Midwife', 'NA', 'RT', 'Housekeeping', 'Other'
];

export const ANTIBIOTICS = {
  ACCESS: [
    'Amoxicillin-Clavulanate', 'Cefazolin', 'Cloxacillin', 'Gentamicin', 
    'Metronidazole', 'Nitrofurantoin', 'Oxacillin', 'Benzylpenicillin'
  ],
  WATCH: [
    'Amikacin', 'Azithromycin', 'Cefixime', 'Cefotaxime', 'Ceftriaxone', 
    'Cefuroxime', 'Ciprofloxacin', 'Clindamycin', 'Ertapenem', 'Fluconazole', 
    'Levofloxacin', 'Piperacillin-Tazobactam'
  ],
  RESERVE: [
    'Amphotericin B', 'Aztreonam', 'Cefepime', 'Ceftazidime–Avibactam', 
    'Colistin / Polymyxin', 'Imipenem–Cilastatin', 'Linezolid', 'Meropenem', 
    'Micafungin', 'Tigecycline', 'Vancomycin', 'Voriconazole'
  ],
  FULL: [
    'Amikacin', 'Amoxicillin-Clavulanate', 'Amphotericin B', 'Azithromycin', 'Aztreonam',
    'Benzylpenicillin', 'Cefazolin', 'Cefepime', 'Cefixime', 'Cefotaxime', 
    'Ceftazidime', 'Ceftazidime–Avibactam', 'Ceftriaxone', 'Ceftriaxone (Special Use)', 
    'Cefuroxime', 'Ciprofloxacin', 'Clindamycin', 'Cloxacillin', 'Colistin / Polymyxin', 
    'Ertapenem', 'Fluconazole', 'Gentamicin', 'Imipenem–Cilastatin', 'Levofloxacin', 
    'Linezolid', 'Meropenem', 'Metronidazole', 'Micafungin', 'Nitrofurantoin', 'Oxacillin', 
    'Piperacillin-Tazobactam', 'Tigecycline', 'Vancomycin', 'Voriconazole'
  ]
};

export const DEVICES = [
  { id: 'CENTRAL_LINE', label: 'Central Line', hai: 'CLABSI' },
  { id: 'VENTILATOR', label: 'Ventilator', hai: 'VAP' },
  { id: 'FOLEY', label: 'Foley Catheter', hai: 'CAUTI' },
  { id: 'SURGICAL_SITE', label: 'Surgical Site', hai: 'SSI' }
];

export const BUNDLE_ELEMENTS = {
  CENTRAL_LINE: [
    'Review of line necessity',
    'Hand hygiene before access',
    'New clean gloves worn',
    'Hub scrubbed with alcohol/CHG',
    'Dressing clean, dry, intact',
    'Dressing changed per protocol',
    'Tubings changed per protocol',
    'No signs of infection'
  ],
  VENTILATOR: [
    'Hand hygiene before airway care',
    'HOB elevation',
    'Oral care (CHG/NS)',
    'Suctioning done properly',
    'Sedation holiday assessed',
    'Readiness to wean assessed',
    'Turned every 2 hours',
    'DVT prophylaxis (if ordered)'
  ],
  FOLEY: [
    'Daily review of catheter necessity',
    'Hand hygiene before manipulation',
    'Closed drainage system intact',
    'Bag below bladder level',
    'No dependent loops',
    'Perineal care done',
    'Bag emptied with clean container'
  ],
  SURGICAL_SITE: [
    'Hand hygiene in all 5 moments',
    'Dressing clean, dry, intact',
    'Dressing changed per protocol',
    'Wet/soiled dressing replaced aseptically',
    'Contact precautions practiced',
    'No signs of infection'
  ]
};

export const CLABSI_DETAILED_BUNDLES = {
  INSERTION_ADULT: [
    "Proper hand hygiene before insertion",
    "Best insertion site chosen",
    "0.5% chlorhexidine in alcohol for skin prep (30 sec scrub, 2 min dry)",
    "Full sterile barrier precautions",
    "Sterile gauze or sterile transparent dressing applied"
  ],
  INSERTION_PEDIA: [
    "Did inserter and assistant/s perform proper hand hygiene technique PRIOR to insertion?",
    "Was 70% alcohol/betadine/ >0.5% Chlorhexidine at least 30 secs & allowed to dry for 2 minutes used in cleaning the site of insertion?",
    "Did the inserter and assistant/s practise sterile barrier precautions (wearing a sterile gown, sterile gloves, cap and mask)? Was there full body drape for the patient?"
  ],
  MAINTENANCE_ADULT: [
    "Review central line necessity",
    "Hand hygiene before/after maintenance or access",
    "Contact precautions (sterile gloves, mask, face shield, gown)",
    "Replace wet/soiled/dislodged dressing using aseptic technique",
    "Scrub access port/hub with 0.5% chlorhexidine in alcohol",
    "Dressing changes: transparent every 7 days; sterile gauze every 24 hours; alimentation every 24 hours; blood products/lipids every 24 hours; Propofol every 12 hours",
    "Use sterile devices to access catheter",
    "Sterile gauze or sterile transparent dressing over insertion site"
  ],
  MAINTENANCE_PEDIA: [
    "Review done for central line necessity (to confer with resident-in-charge or attending physician)",
    "Hand hygiene practiced before all maintenance/ access procedures",
    "New clean gloves worn",
    "70% Alcohol used to disinfect the hub least 30 sec then allowed to dry 2 mins",
    "Dressing changed in aseptic technique (Transparent dressing every 7 days, Sterile gauze every 24 hours, For Umbicath: use 70% alcohol 3x a day for open dressing (tip of stump) but keep it open.)",
    "Gloves removed",
    "Hand hygiene done",
    "Intravenous tubings replaced : Used for Alimentation change every 24 hours, Blood Products or lipid formulations change every 24 hrs, Signs of Phlebitis change immediately the entire IV system, Periph iv lines+ IV set with no signs of infection changed every 4-7 days"
  ]
};

export const CAUTI_BUNDLES = {
  ADULT: [
    "Daily review of catheter necessity",
    "Daily perineal care with 2% chlorhexidine",
    "Closed drainage system with proper securement",
    "Drainage bag below bladder level",
    "Regular emptying of collecting bag with separate clean container"
  ],
  PEDIA: [
    "Hand hygiene before/after procedure",
    "Daily review of catheter necessity",
    "Standard precautions",
    "Daily perineal care",
    "Closed drainage system with proper securement",
    "Drainage bag below bladder level",
    "Regular emptying per shift with separate clean container"
  ]
};

export const VAP_BUNDLES = {
  ADULT: [
    "Hand hygiene",
    "Assessment for readiness to wean/extubate",
    "Daily sedation break assessment",
    "Turn to sides every 2 hours",
    "Oral care with toothbrushing ± 0.2% chlorhexidine every shift",
    "Head elevation ≥ 30 degrees",
    "DVT prophylaxis"
  ],
  PEDIA: [
    "Hand Hygiene Before & after Patient Care",
    "Head of Bed Elevation (30-45 degrees for infants & above), (15-30 degrees for neonates)",
    "Chlorhexidine Oral Care (>2months old) or Normal Saline (<2months old)",
    "Suctioning done Properly?",
    "Sedation Holiday",
    "Confer with resident-in-charge for assessment of readiness to wean / extubate",
    "Change suction catheters at least every shift(open suction only) / (Closed suction) every 5 days",
    "Change suction connector tubings daily (open suction) / closed suction as needed/contaminated",
    "Change ventilator tubings/circuits every 5 days",
    "Change to sterilized suction drainage bottles every suction",
    "Change humidifiers as needed using sterile or distilled water"
  ]
};

export const SSI_BUNDLES = {
  PREOP: [
    "Antimicrobial prophylaxis given according to guidelines",
    "Proper surgical hand scrub",
    "Surfaces/environment cleaned",
    "Instruments properly sterilized",
    "Sterile barrier precautions",
    "Daily baths with 2% chlorhexidine for at least 2 days before surgery"
  ],
  INTRAOP: [
    "Blood glucose monitored and maintained",
    "Foot traffic kept to minimum",
    "Normothermia maintained"
  ],
  POSTOP: [
    "Hand hygiene",
    "Post‑operative wound care",
    "Replace wet/soiled/dislodged dressing using aseptic technique",
    "Contact precautions"
  ]
};

export const CLINICAL_CRITERIA_DETAILED = {
  CLABSI_ADULT: [
    "Fever ≥ 38°C", "Chills", "Hypotension", "Blood culture positive via catheter", "Blood culture positive via peripheral site"
  ],
  CLABSI_PEDIA: [
    "Child 1–18 years: fever ≥ 38°C, chills, hypotension",
    "Infant ≤ 1 year: fever ≥ 38°C, hypothermia ≤ 36.5°C, apnea, bradycardia",
    "Laboratory: blood culture peripheral",
    "Laboratory: blood culture via catheter"
  ],
  CAUTI_ADULT: [
    "Fever ≥ 38°C", "Suprapubic tenderness", "Costovertebral angle pain/tenderness", "Urinary urgency", "Urinary frequency", "Dysuria", "Urinalysis leukocyte/nitrite positive", "Pyuria", "Urine gram stain", "Urine culture", "Blood culture"
  ],
  CAUTI_PEDIA: [
    "Fever ≥ 38°C", "Dysuria", "Urgency", "Frequency", "Costovertebral pain/tenderness", "Suprapubic tenderness", "Chills", "No symptoms", "Urinalysis leukocyte positive", "Urinalysis nitrite positive", "Pyuria", "Urine gram stain", "Urine culture", "Blood culture"
  ],
  VAP_ADULT: [
    "Temperature", "FiO2", "PEEP", "WBC", "New onset rales/ronchi/stridor", "Repeat chest X‑ray done"
  ],
  VAP_PEDIA: [
    "Temperature", "FiO2", "PEEP", "WBC", "New onset rales/ronchi/stridor", "Repeat chest X‑ray done"
  ],
  SSI: [
    "Localized pain or tenderness", "Localized swelling", "Erythema", "Heat", "Fever ≥ 38°C", "Purulent drainage", "Wound drainage positive culture"
  ]
};

export const WHO_5_MOMENTS_MAP = {
  M1: "Before touching a patient",
  M2: "Before clean/aseptic procedure",
  M3: "After body fluid exposure risk",
  M4: "After touching a patient",
  M5: "After touching patient surroundings"
};

export const NSI_CONSTANTS = {
  EXPOSURE_TYPES: [
    'Needle-stick', 'Sharp injury', 'Splash to mucous membrane', 'Splash to non-intact skin', 'Other'
  ],
  DEVICES: [
    'Hollow-bore needle', 'Suture needle', 'Scalpel', 'Lancet', 'Other'
  ],
  ACTIVITIES: [
    'Recapping', 'Disposal', 'Procedure', 'Cleaning', 'Handling sharps tray', 'Other'
  ],
  RISKS: ['HBV', 'HCV', 'HIV', 'Unknown', 'Other'],
  POSITIONS: ['Nurse', 'Doctor', 'MedTech', 'Utility', 'Intern', 'Other'],
  FIRST_AID: [
    'Washed with soap and water', 'Encouraged bleeding', 'Irrigated mucous membrane', 'Other'
  ],
  REPORTED_TO: ['Supervisor', 'Occupational Health Unit', 'IPCU'],
  ROOT_CAUSES: [
    'Unsafe Practice', 
    'Improper Disposal', 
    'Lack of PPE', 
    'Equipment Failure', 
    'Staff Fatigue', 
    'Sudden Patient Movement', 
    'Needle Recapping', 
    'Overfilled Sharps Container',
    'Inadequate Workspace',
    'Cognitive Distraction/Multitasking',
    'Workplace Environment/Congestion',
    'Lack of Standard Safety Devices',
    'Procedural Non-compliance',
    'Inadequate Clinical Supervision',
    'Inadequate Communication during Transfer',
    'Sharps Container Placement Distance',
    'Emergency Resuscitation Chaos',
    'Other'
  ],
  CONTRIBUTING_FACTORS: [
    'High Workload', 
    'Incomplete Training', 
    'Poor Lighting', 
    'Non-compliance with Sharps Protocol', 
    'Inadequate Supervision', 
    'Distractions/Interruptions', 
    'Lack of Safety Devices',
    'Communication Breakdown',
    'Systemic Flow Deficiencies',
    'Institutional Knowledge Gap',
    'Psychological Stress/Burnout',
    'Manual Sharps Handling Habits',
    'Supply Chain Shortage (Safety Sharps)',
    'Improper Handover of Open Sharps',
    'Surface Instability during Procedure',
    'Other'
  ],
  CORRECTIVE_ACTIONS: [
    'Re-education of staff', 
    'Reinforcement of sharps safety', 
    'Replace sharps container', 
    'Environmental correction',
    'Escalation to Unit Head', 
    'Skills Lab Simulation', 
    'PEP Counseling', 
    'Work Practice Modification', 
    'Procurement Request',
    'Mentorship / Shadowing Program',
    'Unit-specific IPC Workshop',
    'Safety Sharps Trials/Rollout',
    'Procedural Drills/Walkthroughs',
    'Environmental Re-organization',
    'Incident Root Cause Review Meeting',
    'Other'
  ]
};

export const MONITORING_METHODS = [
  'Direct Observation',
  'Fluorescent Gel / Marker',
  'Swab Cultures',
  'ATP System',
  'Agar Slide Cultures',
  'Other'
];

export const CULTURE_SPECIMENS = [
  'Blood',
  'Urine',
  'Sputum',
  'CSF',
  'Wound',
  'Tissue',
  'Pleural Fluid',
  'Peritoneal Fluid',
  'Synovial Fluid',
  'Bone Marrow',
  'Catheter Tip',
  'Stool',
  'Bile',
  'Aspirate',
  'Others'
];

export const IPCU_REASONING_GROUPS = [
  {
    category: 'Procedures / Methods',
    options: [
      { value: 'meet_criteria', label: 'Meets NHSN/CDC Surveillance Criteria' },
      { value: 'no_criteria', label: 'Does Not Meet Clinical Definitions' },
      { value: 'inc_doc', label: 'Clinical Documentation Incomplete' },
      { value: 'ind_correct', label: 'Antibiotic Indication Verified' },
      { value: 'prot_viol', label: 'Violation of Standard Precautions Protocol' },
      { value: 'device_dwell', label: 'Prolonged Device Dwell Time (>72h)' },
      { value: 'atypical_pres', label: 'Atypical Clinical Presentation Review' },
      { value: 'emergent_case', label: 'Emergent/Unplanned Case - Deviation Expected' }
    ]
  },
  {
    category: 'Equipment',
    options: [
      { value: 'sterile_lapse', label: 'Improper Sterilization / Disinfection Process' },
      { value: 'sys_failure', label: 'Systemic Facility Maintenance Failure' },
      { value: 'device_defect', label: 'Medical Device Defect / Malfunction' }
    ]
  },
  {
    category: 'Materials',
    options: [
      { value: 'ppe_shortage', label: 'PPE Supply Chain Shortage' },
      { value: 'supplies_inc', label: 'Inadequate Cleaning/IPC Supplies' },
      { value: 'expired_mats', label: 'Expired IPC Consumables in Use' }
    ]
  },
  {
    category: 'People',
    options: [
      { value: 'low_staffing', label: 'Staffing Levels Below Safe Threshold' },
      { value: 'handover_fail', label: 'Handover Communication Failure Identified' },
      { value: 'staff_fatigue', label: 'Staff Fatigue / High Cognitive Load' },
      { value: 'training_gap', label: 'Institutional Knowledge/Training Gap' },
      { value: 'non_adherence', label: 'Behavioral Non-adherence' }
    ]
  },
  {
    category: 'Environment',
    options: [
      { value: 'env_contam', label: 'Environmental Contamination Identified' },
      { value: 'epi_link', label: 'Epidemiological Link Established' },
      { value: 'above_base', label: 'Above Institutional Baseline / Threshold' },
      { value: 'congestion', label: 'Unit Congestion / Poor Layout' }
    ]
  },
  {
    category: 'Miscellaneous',
    options: [
      { value: 'lab_negative', label: 'Microbiological Evidence Negative' },
      { value: 'audit_ver', label: 'Observational Findings Confirmed' },
      { value: 'ind_repro', label: 'Inconsistent Results across Multiple Audits' }
    ]
  }
];

export const IPCU_ACTION_GROUPS = [
  {
    category: 'Correction (Immediate Action)',
    options: [
      'Immediate isolation recommended',
      'Environmental terminal cleaning mandated',
      'Device removal recommended',
      'Equipment maintenance/replacement order',
      'PPE supply chain audit',
      'Reinforced proper technique',
      'Educated staff / Informal training'
    ]
  },
  {
    category: 'Corrective Action (Root Cause Fix)',
    options: [
      'Root Cause Analysis (RCA) triggered',
      'Educational reinforcement provided to unit',
      'One-on-one skills competency validation',
      'Revision of specific unit IPC guidelines',
      'Antimicrobial Stewardship recommendation issued to physician',
      'Requested environment/facility modification',
      'Procurement of specialized IPC supplies',
      'Peer-to-peer mentoring / Shadowing'
    ]
  },
  {
    category: 'Preventive Action (Proactive Measures)',
    options: [
      'Unit-wide re-audit scheduled',
      'Escalated to Hospital Infection Committee',
      'Administrative review requested',
      'Adjustment of staff-to-patient ratio for safety',
      'Institutional policy update',
      'Scheduled multidisciplinary clinical audit',
      'Issued written directive for practice correction'
    ]
  }
];

export const IPCU_CORRECTIVE_ACTIONS = IPCU_ACTION_GROUPS.flatMap(g => g.options);
