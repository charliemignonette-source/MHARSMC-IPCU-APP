export const UNITS = [
  'ICU', 'NICU', 'PICU', 'Ward 1A', 'Ward 1B', 'Ward 1C', 'Ward 2A', 'Ward 2B', 
  'Ward 3A', 'Ward 3B', 'Ward 4A', 'Ward 4B', 'Ward 5A', 'Ward 5B', 'Ward 6', 
  'C2', 'C3', 'C4', 'ER', 'OPD 1', 'OPD 2', 'OR', 'DR', 'OB Ward', 
  'Surgical Ward', 'Medical Ward', 'Pedia Ward', 'IPCU', 'HDU', 'LABORATORY', 'RADIOLOGY'
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
    'Amphotericin B', 'Aztreonam', 'Cefepime + Tazobactam', 'Ceftazidime–Avibactam', 
    'Colistin / Polymyxin', 'Imipenem–Cilastatin', 'Linezolid', 'Meropenem', 
    'Micafungin', 'Tigecycline', 'Vancomycin', 'Voriconazole'
  ],
  FULL: [
    'Amikacin', 'Amoxicillin-Clavulanate', 'Amphotericin B', 'Azithromycin', 'Aztreonam',
    'Cefazolin', 'Cefepime', 'Cefepime + Tazobactam', 'Cefixime', 'Cefotaxime', 
    'Ceftazidime', 'Ceftazidime–Avibactam', 'Ceftriaxone', 'Ceftriaxone (Special Use)', 
    'Cefuroxime', 'Ciprofloxacin', 'Clindamycin', 'Cloxacillin', 'Colistin / Polymyxin', 
    'Ertapenem', 'Fluconazole', 'Gentamicin', 'Imipenem–Cilastatin', 'Levofloxacin', 
    'Linezolid', 'Meropenem', 'Metronidazole', 'Micafungin', 'Oxacillin', 
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
    "Proper hand hygiene practiced in all 5 WHO moments",
    "Best insertion site chosen to minimize infection",
    "0.5% chlorhexidine in alcohol used for skin prep (30 sec scrub, 2 min dry)",
    "Full sterile barrier precautions used (gown, gloves, cap, mask, full drape)",
    "Sterile gauze or sterile transparent dressing applied over insertion site"
  ],
  MAINTENANCE_ADULT: [
    "Review done for central line necessity",
    "Hand hygiene practiced before/after all maintenance or access procedures",
    "Contact precaution practiced (sterile gloves, mask, face shield, gown)",
    "Wet, soiled, or dislodged dressing replaced using aseptic technique",
    "Scrub access port/hub with friction before each use (0.5% chlorhexidine in alcohol)",
    "Dressing changed according to type/indication (7d transparent, 24h gauze, etc.)",
    "Sterile devices used to access catheters",
    "Sterile gauze or sterile transparent semi-permeable dressing over insertion site"
  ],
  MAINTENANCE_PEDIA: [
    "Review done for central line necessity",
    "Hand hygiene practiced before all maintenance/access procedures",
    "New clean gloves worn",
    "70% alcohol used to disinfect hub for at least 30 sec, allowed to dry 2 mins",
    "Dressing changed using aseptic technique",
    "Gloves removed after procedure",
    "Hand hygiene done after glove removal",
    "IV tubings replaced appropriately"
  ]
};

export const CAUTI_BUNDLES = {
  ADULT: [
    "Daily review of catheter necessity",
    "Daily perineal care with 2% chlorhexidine wash",
    "Closed drainage system maintained with proper securement",
    "Drainage bag kept below bladder level at all times",
    "Regular emptying of collecting bag using separate clean container"
  ],
  PEDIA: [
    "Hand hygiene before and after procedure",
    "Daily review of catheter necessity",
    "Use of standard precautions",
    "Daily perineal care",
    "Closed drainage system maintained with proper securement",
    "Drainage bag kept below bladder level",
    "Regular emptying of collecting bag per shift"
  ]
};

export const VAP_BUNDLES = {
  ADULT: [
    "Hand hygiene practiced in all 5 WHO moments",
    "Assessment for readiness to wean/extubate",
    "Daily assessment for sedation break",
    "Turn to sides every 2 hours",
    "Oral care with toothbrushing every shift",
    "Head elevation at least 30 degrees",
    "DVT prophylaxis"
  ],
  PEDIA: [
    "Hand hygiene before and after patient care",
    "Head of bed elevation (30-45inf/15-30neo)",
    "Chlorhexidine or saline oral care",
    "Suctioning done properly",
    "Sedation holiday",
    "Assessment for readiness to wean/extubate"
  ]
};

export const SSI_BUNDLES = {
  PREOP: [
    "Antimicrobial prophylaxis given according to guidelines",
    "Proper surgical hand scrub performed",
    "Surfaces and environment cleaned prior to surgery",
    "Surgical instruments properly sterilized",
    "Sterile barrier precautions practiced",
    "Daily baths with 2% chlorhexidine for at least 2 days prior"
  ],
  INTRAOP: [
    "Blood glucose monitored and maintained",
    "Foot traffic kept to minimum",
    "Normothermia maintained"
  ],
  POSTOP: [
    "Hand hygiene practiced in all 5 WHO moments",
    "Post-operative wound care performed",
    "Wet, soiled, or dislodged dressing replaced using aseptic technique",
    "Contact precautions practiced"
  ]
};

export const CLINICAL_CRITERIA_DETAILED = {
  CLABSI_ADULT: [
    "Fever ≥ 38°C", "Chills", "Hypotension", "Blood culture pos via catheter", "Blood culture pos via peripheral"
  ],
  CLABSI_PEDIA: [
    "Fever ≥ 38°C", "Hypothermia ≤ 36.5°C", "Apnea", "Bradycardia", "Peripheral culture pos", "Catheter culture pos"
  ],
  CAUTI_ADULT: [
    "Fever ≥ 38°C", "Suprapubic tenderness", "CVA pain/tenderness", "Urgency", "Frequency", "Dysuria", "Pyuria", "Urine culture pos"
  ],
  CAUTI_PEDIA: [
    "Fever ≥ 38°C", "Dysuria", "Urgency", "Frequency", "Suprapubic tenderness", "Chills", "Nitrite positive", "Urine culture pos"
  ],
  SSI: [
    "Localized pain/tenderness", "Localized swelling", "Erythema", "Heat", "Fever ≥ 38°C", "Purulent drainage", "Pos culture"
  ],
  VAP: [
    "Temperature outlier", "FiO2 requirement", "PEEP requirement", "WBC outlier", "New rales/ronchi", "X-ray changes"
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
