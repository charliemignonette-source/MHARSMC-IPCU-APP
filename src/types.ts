export type Role = 'ADMIN' | 'IPCN' | 'PHYSICIAN' | 'PHARMACY' | 'APPROVER' | 'USER';

export interface UserProfile {
  uid: string;
  email?: string;
  name: string;
  role: Role;
  unit?: string;
  staffCode?: string;
  pin?: string;
  isVerified: boolean;
  createdAt: string;
}

export type AuditType = 
  | 'HH_AVAILABILITY' 
  | 'HH_COMPLIANCE' 
  | 'PPE_AVAILABILITY' 
  | 'PPE_COMPLIANCE' 
  | 'SAFE_INJECTION' 
  | 'ENV_CLEANING';

export interface Audit {
  id: string;
  type: AuditType;
  unit: string;
  auditorId: string;
  auditorEmail?: string;
  timestamp: string;
  data?: any;
  score: number;
  total: number;
  isValidated?: boolean;
  validatedBy?: string;
  validatedAt?: any;
  profession?: string;
  remarks?: string;
  details?: any;
}

export type NSIStatus = 'PENDING' | 'VALIDATED' | 'NOT_NSI' | 'NEEDS_MORE_DATA';
export type NSIExposureType = 'Needle-stick' | 'Sharp injury' | 'Splash to mucous membrane' | 'Splash to non-intact skin';
export type NSIDevice = 'Hollow-bore needle' | 'Suture needle' | 'Scalpel' | 'Lancet' | 'Other';
export type NSIActivity = 'Recapping' | 'Disposal' | 'Procedure' | 'Cleaning' | 'Handling sharps tray' | 'Other';

export interface NSIReport {
  id?: string;
  reporterId: string;
  reporterEmail?: string;
  createdAt: any;
  status: NSIStatus;

  // Section 1: Reporting
  incident: {
    date: string;
    time: string;
    unit: string;
    exposureType: NSIExposureType;
    deviceInvolved: NSIDevice;
    deviceOther?: string;
    activity: NSIActivity;
    activityOther?: string;
    exposureOther?: string;
  };
  staff: {
    name: string;
    position: string;
    employmentStatus: 'Regular' | 'Contractual' | 'Trainee';
    hepBStatus: 'Complete' | 'Incomplete' | 'Unknown';
  };
  source?: {
    name: string;
    hospNo: string;
    diagnosis: string;
    risks: string[]; // HBV, HCV, HIV, Unknown
    riskOther?: string;
  };
  description: {
    narrative: string;
    ppeWorn: boolean;
    properDisposal: boolean;
    safetyDeviceActivated: 'Yes' | 'No' | 'N/A';
  };
  actions: {
    firstAid: string[];
    reportedTo: string[];
    pep: 'Initiated' | 'Not indicated' | 'Declined' | 'Unknown';
  };

  // Section 2: Validation (Validator Only)
  validation?: {
    classification: 'Significant Exposure' | 'Non-significant Exposure';
    rootCauses: string[];
    contributingFactors: string[];
    decision: NSIStatus;
    correctiveActions: string[];
    actionOther?: string;
    validatorName: string;
    validatorId: string;
    validatedAt: any;
  };
}

export type AMSRequestType = 'RESTRICTED_USE' | 'EXTENSION_7D';
export type AMSStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'OVERRIDDEN' | 'DISPENSED';

export interface PreviousAntibiotic {
  name: string;
  dose: string;
  startDate: string;
  stopDate: string;
  indication: string;
}

export interface AMSRequest {
  id?: string;
  type: AMSRequestType;
  // Patient Info
  hospNo: string;
  location: string;
  firstName: string;
  middleName: string;
  lastName: string;
  patientName: string; // Display name
  date: string;
  dateTimeRequested?: string;
  drugAllergy: {
    hasAllergy: boolean;
    specify?: string;
  };
  sex: 'Male' | 'Female';
  dob: string;
  age: string;
  ageUnit: 'Days' | 'Months' | 'Years';
  weight: string;
  height: string;
  serumCreatinine: string;
  creatinineClearance: string;
  sgpt: string;
  sgot: string;
  previousAntibiotics?: PreviousAntibiotic[];

  // Order Details
  antimicrobialsRequested: string[];
  drugDoses?: Record<string, string>;
  dosingRegimen: string;
  indicationForUse: 'Prophylactic' | 'Empiric' | 'Definitive';
  focusOfInfection: string[];
  focusOther?: string;
  infectiousDiagnosis?: string;
  cultureSent: string[];
  cultureDateSent?: string;
  cultureOthers?: string;
  immunocompromisingCondition: string[];
  immunocompromisingOthers?: string;

  // Microbiological Results (for Definitive Use)
  microbiology?: {
    date: string;
    specimen: string;
    organism: string;
    resistancePattern: string;
    otherOrganism?: string;
    otherResistance?: string;
  };

  // Critical Illness Criteria
  criticallyIll?: {
    sepsisCriteria: string[];
    sepsisOther?: string;
    organDysfunctionCriteria: string[];
    organOther?: string;
  };

  // Legacy/Required fields
  unit: string;
  antibiotic: string;
  dose: string;
  diagnosis: string;
  justification: string;
  
  prescriberId: string;
  prescriberEmail?: string;
  prescriberContact?: string;
  requestingPhysician?: string;
  durationRequested?: string;
  status: AMSStatus;
  reviewerId?: string;
  reviewerEmail?: string;
  reviewedAt?: string;
  dateTimeApproved?: string;
  remarks?: string;
  manualApproval?: boolean;
  overrideReason?: string;
  isValidated?: boolean;
  validatedBy?: string;
  validatedAt?: any;
  dispensedBy?: string;
  dispensedAt?: any;
}

export type HAIType = 'CLABSI' | 'VAP' | 'CAUTI' | 'SSI' | 'VAP/VAE';
export type HAIStatus = 'PENDING' | 'CONFIRMED' | 'NOT_HAI' | 'NEEDS_MORE_DATA';

export interface HAICase {
  id?: string;
  type: HAIType;
  patientName: string;
  hospNo: string;
  unit: string;
  deviceType?: string;
  deviceTypeOther?: string;
  procedureType?: string;
  triggeredCriteria: string[];
  criteriaOther?: string;
  triggeredLabs: string[];
  labOther?: string;
  triggerDate: string;
  status: HAIStatus;
  riskLevel: 'RED' | 'YELLOW' | 'BLUE' | 'BLACK';
  deviceDays: number;
  repeatedDays?: number;
  
  // Validation
  validatedBy?: string;
  validatorName?: string;
  validatedAt?: string;
  decisionNote?: string;
  
  // Root cause flags
  bundleIssues?: string;
  clinicalIssues?: string;
  labIssues?: string;
}

export interface IPCUAction {
  id?: string;
  patientName: string;
  hospNo: string;
  haiType: HAIType | 'Bundle' | 'AMS' | 'Audit' | string;
  action: string;
  date: string;
  staffName: string;
  staffId: string;
  unit?: string;
  discrepancyFound?: string;
  createdAt?: any;
}

export interface BundleAssessment {
  deviceType: string;
  elements: Record<string, boolean>;
  isCompliant: boolean;
  remarks?: string;
}

export interface FormCompletionDetail {
  section: 'Physician-in-Charge (PIC)' | 'Nurse-in-Charge (NIC)' | 'Clinical Criteria Section';
  status: 'Complete' | 'Incomplete' | 'N/A';
  isSigned: boolean;
  remarks?: string;
  physicianName?: string;
}

export type Population = 'Adult' | 'Pediatric';

export interface DailyObservation {
  section: string;
  elements: Record<string, boolean>;
  remarks?: string;
}

export interface ClinicalCriteriaObservation {
  fever: boolean;
  chills: boolean;
  hypotension: boolean;
  bloodCultureCatheter?: boolean;
  bloodCulturePeripheral?: boolean;
  isSigned: boolean;
}

export interface DailyShiftCheck {
  done: boolean;
  staffId?: string;
  staffName?: string;
  elements: Record<string, boolean>;
  clinicalCriteria?: ClinicalCriteriaObservation;
  updatedAt?: any;
}

export interface BundleDailyCheck {
  date: string;
  shifts: {
    AM: DailyShiftCheck;
    PM: DailyShiftCheck;
    Night: DailyShiftCheck;
  };
  missed?: boolean;
  missedReason?: string;
}

export interface InsertionBundle {
  date: string;
  time: string;
  inserterName: string;
  inserterType: 'Physician' | 'Nurse';
  nurseAssisting?: string;
  elements: Record<string, boolean>;
  isCompliant: boolean;
}

export interface BundleMonitoring {
  id?: string;
  population: Population;
  patientName: string;
  hospNo: string;
  age: string;
  gender: 'Male' | 'Female';
  unit: string;
  deviceType: 'CLABSI' | 'VAP' | 'CAUTI' | 'SSI';
  deviceDetail?: string; // e.g. IJ, PICC line for CLABSI
  insertionDate: string;
  insertionTime?: string;
  removalDate?: string;
  status: 'ACTIVE' | 'DISCONTINUED';
  
  insertionBundle?: InsertionBundle;
  dailyChecks: Record<string, BundleDailyCheck>; // Key is YYYY-MM-DD
  
  staffId: string;
  staffName: string;
  createdAt: any;
  updatedAt?: any;
}

export interface BOCLog {
  id?: string;
  date: string;
  time: string;
  unit: string;
  patientName: string;
  hospNo: string;
  age: string;
  sex: 'Male' | 'Female';
  devicesPresent: string[];
  bundles: Record<string, BundleAssessment>;
  totalApplicable: number;
  totalCompliant: number;
  compliancePercentage: number;
  staffName: string;
  staffDesignation: string;
  staffId: string;
  staffEmail?: string;
  createdAt?: any;
  
  formMonitoring?: FormCompletionDetail[];
  
  isValidated?: boolean;
  verification?: {
    date: string;
    time: string;
    completeness: { status: 'Complete' | 'Incomplete'; details: string };
    accuracy: { status: 'Accurate' | 'Inaccurate'; details: string };
    independentAssessment: Record<string, { isCompliant: boolean; notes: string }>;
    finalDecision: 'Compliant' | 'Non-compliant';
    reason: string;
    correctiveAction: string[];
    validatorName: string;
    validatorDesignation: string;
    validatorId: string;
  };
}

export type OutbreakStatus = 'Suspected' | 'Under Investigation' | 'Confirmed' | 'Controlled' | 'Closed';

export interface OutbreakCase {
  patientName: string;
  hospNo: string;
  unit: string;
  onSetDate: string;
  symptoms: string;
  labResults: string;
  deviceProcedure: string;
  outcome: string;
}

export interface OutbreakReport {
  id?: string;
  detectedAt: string;
  detectedTime: string;
  reportedBy: string;
  reportingSrc: string[]; 
  reportingSrcOther?: string;
  type: string[]; 
  typeOther?: string;
  triggerCriteria: string[]; 
  triggerCriteriaOther?: string;
  lineList: OutbreakCase[];
  
  epidemiology: {
    indexCase: string;
    totalCases: number;
    attackRate: string;
    unitsAffected: string;
    possibleSource: string;
    transmissionMode: string[]; 
    transmissionModeOther?: string;
  };
  
  findings: {
    envSwabbing: { done: boolean; results: string };
    waterTesting: { done: boolean; results: string };
    labAlerts: { organism: string; resistancePattern: string };
  };
  
  controlMeasures: {
    actions: string[]; 
    actionsOther?: string;
    dateImplemented: string;
    responsibleUnit: string;
  };
  
  status: OutbreakStatus;
  dateClosed?: string;
  closureReason?: string;
  
  reporterId: string;
  reporterEmail?: string;
  createdAt: any;
  
  validation?: {
    decision: 'Confirmed Outbreak' | 'Not an Outbreak' | 'Needs More Data';
    basis: string[];
    notes: string;
    validatorName: string;
    validatorId: string;
    validatedAt: any;
  };
}
