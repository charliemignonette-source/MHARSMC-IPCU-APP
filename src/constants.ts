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
    'Unsafe practice', 'Improper disposal', 'Lack of PPE', 'Equipment failure', 'Staff fatigue', 'Other'
  ],
  CONTRIBUTING_FACTORS: [
    'High workload', 'Incomplete training', 'Poor lighting', 'Non-compliance with sharps protocol', 'Other'
  ],
  CORRECTIVE_ACTIONS: [
    'Re-education of staff', 'Reinforcement of sharps safety', 'Replace sharps container', 'Environmental correction', 'Escalation to Unit Head', 'Other'
  ]
};
