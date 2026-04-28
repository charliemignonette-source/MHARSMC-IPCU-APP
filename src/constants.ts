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
  INSERTION: [
    'Proper hand hygiene (5 moments practiced)',
    'Best insertion site chosen (minimize infection/non-infectious complications)',
    '0.5% Chlorhexidine in alcohol prep scrubbed for 30s, allowed to dry for 2m',
    'Inserter and assistant practiced full sterile barrier (gown, gloves, cap, mask)',
    'Full body drape used for the patient',
    'Sterile gauze or transparent semi-permeable dressing used'
  ],
  MAINTENANCE: [
    'Review of central line necessity',
    'Hand hygiene practiced before/after maintenance/access',
    'Contact precautions practiced (gloves, mask, shield, gown)',
    'Wet, soiled, dislodged dressing replaced using aseptic technique',
    'Scrub access port/hub with friction before use (0.5% chlorhexidine/alcohol)',
    'Sterile devices used to access catheter'
  ],
  DRESSING_ADULT: [
    'Transparent dressing changed every 7 days',
    'Sterile gauze changed every 24 hours',
    'Feeding line feeding change every 24 hours',
    'Lipids/Blood change every 24 hours',
    'Propofol administration change every 12 hours'
  ],
  CLINICAL_ADULT: [
    'Fever (> 38 C)',
    'Chills',
    'Hypotension'
  ],
  CLINICAL_PEDIA: [
    'Fever / Hypothermia',
    'Apnea',
    'Bradycardia',
    'Hypotension'
  ]
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
