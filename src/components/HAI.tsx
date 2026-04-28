import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  ClipboardList,
  Search,
  Plus,
  ShieldCheck,
  ChevronRight,
  Microscope,
  Calendar,
  XCircle,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, HAICase, BOCLog, HAIType, IPCUAction, BundleMonitoring, Population, MonitoringDay } from '../types';
import { UNITS, DEVICES, BUNDLE_ELEMENTS, IPCU_CORRECTIVE_ACTIONS, CLABSI_DETAILED_BUNDLES, CAUTI_BUNDLES, VAP_BUNDLES, SSI_BUNDLES as SSI_BUNDLES_CONST, CLINICAL_CRITERIA_DETAILED } from '../constants';
import { cn, formatDate } from '../lib/utils';

const SS_BUNDLES = [
  'Hand Hygiene',
  'Pre-op Hair Removal (Clipped)',
  'Antibiotic Prophylaxis (Given <1h)',
  'Skin Prep (Chlorhexidine/Alcohol)',
  'Normothermia Maintained'
];

const END_MONITORING_REASONS = [
  'Discharged',
  'Transferred out of unit',
  'Device removed',
  'Death',
  'Other'
];

// Global utilities
const removeUndefined = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    // Check if it's a Firestore FieldValue
    if (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'Timestamp')) return obj;
    
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj || {})) {
      if (value !== undefined) {
        newObj[key] = removeUndefined(value);
      }
    }
    return newObj;
  }
  return obj;
};

export default function HAI({ user }: { user: UserProfile | null }) {
  const isIPCU = user?.role === 'ADMIN' || user?.role === 'IPCN';
  const isAdmin = user?.role === 'ADMIN';
  const [activeView, setActiveView] = useState<'surveillance' | 'monitoring'>(isIPCU ? 'surveillance' : 'monitoring');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BundleMonitoring[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<BundleMonitoring | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [isEndingMonitoring, setIsEndingMonitoring] = useState(false);

  const calculateCompliance = (day: MonitoringDay) => {
    if (day.missedDay) return { bundle: 0, clinical: 0, overall: 0 };

    const doneItems = Object.values(day.bundleChecklist || {}).filter(v => v === 'Done');
    const notDoneItems = Object.values(day.bundleChecklist || {}).filter(v => v === 'Not Done');
    const totalRequired = doneItems.length + notDoneItems.length;
    const bundleScore = totalRequired > 0 ? (doneItems.length / totalRequired) * 100 : 100;

    return {
      bundle: parseFloat(bundleScore.toFixed(2)),
      clinical: 100, // Not part of compliance
      overall: parseFloat(bundleScore.toFixed(2))
    };
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const qH = query(collection(db, 'bundle_monitorings'), where('hospitalNo', '==', searchTerm));
      const qN = query(collection(db, 'bundle_monitorings'), where('patientName', '>=', searchTerm), where('patientName', '<=', searchTerm + '\uf8ff'));
      const [snapH, snapN] = await Promise.all([getDocs(qH), getDocs(qN)]);
      const results = [...snapH.docs, ...snapN.docs].map(d => ({ id: d.id, ...d.data() } as BundleMonitoring));
      setSearchResults(results);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'bundle_monitorings');
    } finally {
      setIsSearching(false);
    }
  };

  const [isAddingCase, setIsAddingCase] = useState(false);
  const [isAddingBundle, setIsAddingBundle] = useState(false);
  
  const [cases, setCases] = useState<HAICase[]>([]);
  const [bundleLogs, setBundleLogs] = useState<BOCLog[]>([]);
  const [monitorings, setMonitorings] = useState<BundleMonitoring[]>([]);
  const [caseFilter, setCaseFilter] = useState<'PENDING' | 'VALIDATED'>('PENDING');
  const [denominators, setDenominators] = useState<any[]>([]);
  const [isManagingDenominators, setIsManagingDenominators] = useState(false);
  const [isEnrollingDevice, setIsEnrollingDevice] = useState(false);
  const [selectedMonitoring, setSelectedMonitoring] = useState<BundleMonitoring | null>(null);
  const [isViewingDailyChecks, setIsViewingDailyChecks] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | null } | null>(null);
  const [selectedDayToVerify, setSelectedDayToVerify] = useState<{ patient: BundleMonitoring, day: any, index: number } | null>(null);
  const [isVerifyingDay, setIsVerifyingDay] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [caseForm, setCaseForm] = useState<Partial<HAICase>>({
    type: 'CLABSI',
    patientName: '',
    hospNo: '',
    unit: UNITS[0],
    deviceType: 'Central Line',
    triggerDate: new Date().toISOString().split('T')[0],
    status: 'PENDING',
    riskLevel: 'YELLOW',
    triggeredCriteria: [],
    criteriaOther: '',
    triggeredLabs: [],
    labOther: '',
    deviceDays: 0,
    deviceTypeOther: ''
  });

  const [bundleForm, setBundleForm] = useState<Partial<BOCLog>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    unit: UNITS[0],
    patientName: '',
    hospNo: '',
    age: '',
    sex: 'Male',
    devicesPresent: [],
    bundles: {},
    formMonitoring: [
      { section: 'Physician-in-Charge (PIC)', status: 'Complete', isSigned: false, physicianName: '' },
      { section: 'Nurse-in-Charge (NIC)', status: 'Complete', isSigned: false },
      { section: 'Clinical Criteria Section', status: 'Complete', isSigned: false }
    ],
    totalApplicable: 0,
    totalCompliant: 0,
    compliancePercentage: 0,
    staffName: '',
    staffDesignation: ''
  });

  const [selectedCase, setSelectedCase] = useState<HAICase | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidationLoading, setIsValidationLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<BOCLog | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationForm, setVerificationForm] = useState<BOCLog['verification']>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    completeness: { status: 'Complete', details: '' },
    accuracy: { status: 'Accurate', details: '' },
    independentAssessment: {},
    finalDecision: 'Compliant',
    reason: '',
    correctiveAction: [],
    validatorName: '',
    validatorDesignation: '',
    validatorId: ''
  });

  useEffect(() => {
    if (!user) return;

    // 1. HAI Cases
    let q1;
    if (isIPCU) {
      q1 = query(collection(db, 'hai_cases'), orderBy('createdAt', 'desc'));
    } else {
      q1 = query(collection(db, 'hai_cases'), where('auditorId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    const unsub1 = onSnapshot(q1, (snap) => {
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() } as HAICase)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'hai_cases'));

    // 2. BOC Logs
    let q2;
    if (isIPCU) {
      q2 = query(collection(db, 'boc_logs'), orderBy('createdAt', 'desc'));
    } else {
      q2 = query(collection(db, 'boc_logs'), where('staffId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    const unsub2 = onSnapshot(q2, (snap) => {
      setBundleLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as BOCLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'boc_logs'));

    // 3. Bundle Monitorings
    let qM;
    if (isIPCU) {
      qM = query(collection(db, 'bundle_monitorings'), orderBy('createdAt', 'desc'));
    } else {
      qM = query(collection(db, 'bundle_monitorings'), where('staffId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    const unsubM = onSnapshot(qM, (snap) => {
      setMonitorings(snap.docs.map(d => ({ id: d.id, ...d.data() } as BundleMonitoring)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bundle_monitorings'));

    const q3 = query(collection(db, 'hai_denominators'), orderBy('month', 'desc'), limit(12));
    const unsub3 = onSnapshot(q3, (snap) => {
      setDenominators(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'hai_denominators'));

    return () => { unsub1(); unsub2(); unsubM(); unsub3(); };
  }, [user, isIPCU]);

  const rates = React.useMemo(() => {
    const confirmed = cases.filter(c => c.status === 'CONFIRMED');
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
    
    const currentDenom = denominators.find(d => d.month === currentMonthStr) || {
      ventDays: 1000,
      lineDays: 1200,
      cathDays: 1500,
      procedureDays: 1000,
      patientsAtRisk: 5000
    };
    
    const vapCount = confirmed.filter(c => c.type === 'VAP').length;
    const clabsiCount = confirmed.filter(c => c.type === 'CLABSI').length;
    const cautiCount = confirmed.filter(c => c.type === 'CAUTI').length;
    const ssiCount = confirmed.filter(c => c.type === 'SSI').length;
    const totalHais = confirmed.length;
    
    return {
      vapCount,
      ventDays: currentDenom.ventDays,
      vapRate: parseFloat(((vapCount / (currentDenom.ventDays || 1)) * 1000).toFixed(2)),
      
      clabsiCount,
      lineDays: currentDenom.lineDays,
      clabsiRate: parseFloat(((clabsiCount / (currentDenom.lineDays || 1)) * 1000).toFixed(2)),
      
      cautiCount,
      cathDays: currentDenom.cathDays,
      cautiRate: parseFloat(((cautiCount / (currentDenom.cathDays || 1)) * 1000).toFixed(2)),
      
      ssiCount,
      procedureDays: currentDenom.procedureDays,
      ssiRate: parseFloat(((ssiCount / (currentDenom.procedureDays || 1)) * 100).toFixed(2)),

      totalHais,
      patientsAtRisk: currentDenom.patientsAtRisk,
      overallRate: parseFloat(((totalHais / (currentDenom.patientsAtRisk || 1)) * 1000).toFixed(2))
    };
  }, [cases, denominators]);

  const handleCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'hai_cases'), removeUndefined({
        ...caseForm,
        auditorId: user.uid,
        auditorEmail: user.email,
        auditorName: user.name, // adding name
        isValidated: false,
        createdAt: serverTimestamp()
      }));
      setIsAddingCase(false);
      showToast('HAI Case report submitted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'hai_cases');
    }
  };

  const handleBundleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    let totalElements = 0;
    let compliantElements = 0;
    
    const elementsMap = { ...bundleForm.bundles };
    
    bundleForm.devicesPresent?.forEach(dev => {
      const bundle = elementsMap[dev];
      if (bundle) {
        const requiredElements = BUNDLE_ELEMENTS[dev as keyof typeof BUNDLE_ELEMENTS];
        totalElements += requiredElements.length;
        compliantElements += Object.values(bundle.elements || {}).filter(Boolean).length;
        bundle.isCompliant = Object.values(bundle.elements || {}).filter(Boolean).length === (requiredElements?.length || 0);
      }
    });

    const finalPct = totalElements > 0 ? (compliantElements / totalElements) * 100 : 0;

    try {
      await addDoc(collection(db, 'boc_logs'), removeUndefined({
        ...bundleForm,
        bundles: elementsMap,
        totalApplicable: totalElements,
        totalCompliant: compliantElements,
        compliancePercentage: finalPct,
        staffId: user.uid,
        staffEmail: user.email,
        staffName: user.name, // adding name
        isValidated: false,
        createdAt: serverTimestamp()
      }));
      setIsAddingBundle(false);
      showToast('Bundle Compliance Log saved successfully');
      setBundleForm({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        unit: UNITS[0],
        patientName: '',
        hospNo: '',
        age: '',
        sex: 'Male',
        devicesPresent: [],
        bundles: {},
        formMonitoring: [
          { section: 'Physician-in-Charge (PIC)', status: 'Complete', isSigned: false },
          { section: 'Nurse-in-Charge (NIC)', status: 'Complete', isSigned: false },
          { section: 'Clinical Criteria Section', status: 'Complete', isSigned: false }
        ],
        totalApplicable: 0,
        totalCompliant: 0,
        compliancePercentage: 0,
        staffName: '',
        staffDesignation: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'boc_logs');
    }
  };

  const removeUndefinedLocal = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(removeUndefinedLocal);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
      if (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'Timestamp')) return obj;
      
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj || {})) {
        if (value !== undefined) {
          newObj[key] = removeUndefinedLocal(value);
        }
      }
      return newObj;
    }
    return obj;
  };

  const handleValidationSubmit = async (validationData: any) => {
    if (!selectedCase?.id) {
      showToast('Error: No case selected', 'error');
      return;
    }
    if (!user) {
      showToast('Error: User not authenticated', 'error');
      return;
    }
    if (validationData.status === 'PENDING') {
      showToast('Please select a status (Confirmed/Not HAI etc.)', 'error');
      return;
    }

    setIsValidationLoading(true);
    try {
      await updateDoc(doc(db, 'hai_cases', selectedCase.id), removeUndefined({
        ...validationData,
        // Sync corrected fields back to case root
        deviceDays: validationData.correctedDeviceDays || 0,
        riskLevel: validationData.correctedRiskLevel,
        isValidated: true,
        validatedBy: user.uid,
        validatorName: validationData.validatorName || user.name || 'IPCU Validator',
        validatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      setIsValidating(false);
      setSelectedCase(null);
      showToast('Validation decision published');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hai_cases');
    } finally {
      setIsValidationLoading(false);
    }
  };

  const handleVerifyMonitoringDay = async (patientId: string, dayIndex: number, verificationData: any) => {
    if (!user || (!isIPCU && user.role !== 'ADMIN')) return;
    try {
      const patient = monitorings.find(m => m.id === patientId);
      if (!patient) return;
      
      const updatedDays = [...(patient.monitoringDays || [])];
      if (updatedDays[dayIndex]) {
        updatedDays[dayIndex] = {
          ...updatedDays[dayIndex],
          ...verificationData,
          isVerifiedByIPCU: true,
          verifiedAtIPCU: new Date().toISOString(),
          verifiedByIPCUId: user.uid,
          verifiedByIPCUName: user.name
        } as any;
      }
      
      const stillUnverified = updatedDays.some(d => !(d as any).isVerifiedByIPCU);
      
      await updateDoc(doc(db, 'bundle_monitorings', patientId), removeUndefined({
        monitoringDays: updatedDays,
        hasUnverifiedDays: stillUnverified,
        updatedAt: serverTimestamp()
      }));
      setIsVerifyingDay(false);
      setSelectedDayToVerify(null);
      showToast('Daily Bundle entry verified by IPCU');
      
      // IPCU Action log
      await addDoc(collection(db, 'ipcu_actions'), {
        patientName: patient.patientName,
        hospNo: patient.hospitalNo,
        unit: patient.unit,
        haiType: 'Bundle',
        action: `Verified Day ${updatedDays[dayIndex].dayNumber} with decision: ${verificationData.clinicalAccuracy} Accuracy`,
        staffId: user.uid,
        staffName: user.name,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'bundle_monitorings');
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLog?.id) return;
    try {
      await updateDoc(doc(db, 'boc_logs', selectedLog.id), removeUndefined({
        isValidated: true,
        verification: {
          ...verificationForm,
          validatorId: user.uid,
          validatorName: verificationForm?.validatorName || user.name
        }
      }));
      setIsVerifying(false);
      setSelectedLog(null);
      showToast('Verification record saved');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'boc_logs');
    }
  };

  const handleDelete = async (e: React.MouseEvent, collectionName: string, id: string | undefined) => {
    e.stopPropagation();
    
    if (!id) return;
    if (!user || !isIPCU) return;
    
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;
    
    try {
      await deleteDoc(doc(db, collectionName, id));
      showToast('Record deleted permanentely');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row shadow-sm sm:shadow-none items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">IPCU Clinical Monitor</h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">Standardized HAI surveillance and device monitoring workflow</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
            {activeView === 'monitoring' && (
              <button 
                onClick={() => setIsEnrollingDevice(true)}
                className="flex-1 sm:flex-none btn-primary px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Enroll Patient</span>
              </button>
            )}
            {isIPCU && activeView === 'surveillance' && (
              <button 
                onClick={() => setIsAddingCase(true)}
                className="flex-1 sm:flex-none btn-primary px-6 py-2.5 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Report Case</span>
              </button>
            )}
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 w-full sm:w-fit rounded-xl overflow-x-auto no-scrollbar">
        {(['surveillance', 'monitoring'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex-1 sm:flex-none px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
              activeView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-500"
            )}
          >
            {view === 'surveillance' ? 'Active Surveillance' : 'Patient Monitoring'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'surveillance' && (
          <motion.div 
            key="surveillance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* HAI Rates (Top Summary) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
               <RateTile 
                 label="VAP Rate" 
                 rate={rates.vapRate} 
                 unit={`per 1,000 vent-days (${rates.vapCount}/${rates.ventDays})`} 
                 baseline={2.0} 
               />
               <RateTile 
                 label="CLABSI Rate" 
                 rate={rates.clabsiRate} 
                 unit={`per 1,000 line-days (${rates.clabsiCount}/${rates.lineDays})`} 
                 baseline={1.5} 
               />
               <RateTile 
                 label="CAUTI Rate" 
                 rate={rates.cautiRate} 
                 unit={`per 1,000 cath-days (${rates.cautiCount}/${rates.cathDays})`} 
                 baseline={1.0} 
               />
               <RateTile 
                 label="SSI Rate" 
                 rate={rates.ssiRate} 
                 unit={`per 100 procedures (${rates.ssiCount}/${rates.procedureDays})`} 
                 baseline={1.0} 
               />
               <div className={cn(
                 "bento-card p-6 flex flex-col justify-between",
                 rates.overallRate >= 1.0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
               )}>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Overall HAI Rate</h4>
                    <div className={cn(
                      "text-3xl font-black",
                      rates.overallRate >= 1.0 ? "text-rose-600" : "text-emerald-600"
                    )}>{rates.overallRate}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">per 1,000 patients at risk</div>
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-tight text-slate-400 mt-2">Target: <span className="text-emerald-600">{" < 1.0 "}</span></div>
               </div>
            </div>

            {/* HAI Case Register Wrapper */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">HAI Case Surveillance Register</h3>
                  <div className="h-px w-12 bg-slate-200 hidden sm:block" />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {(['PENDING', 'VALIDATED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCaseFilter(tab)}
                      className={cn(
                        "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                        caseFilter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-500"
                      )}
                    >
                      {tab === 'PENDING' ? `Triggered (${cases.filter(c => c.status === 'PENDING').length})` : `Validated (${cases.filter(c => c.status !== 'PENDING').length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bento-card bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0 min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient / Unit</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Device / Proc</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {caseFilter === 'PENDING' ? 'Triggered Criteria' : 'Clinical Decision'}
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">HAI Type</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cases
                        .filter(c => caseFilter === 'PENDING' ? c.status === 'PENDING' : c.status !== 'PENDING')
                        .map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{c.patientName}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{c.unit}</span>
                                <span className="text-[8px] font-mono text-slate-300">#{c.hospNo}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-xs font-medium text-slate-600">{c.deviceType || c.procedureType}</span>
                          </td>
                          <td className="px-6 py-4">
                             {caseFilter === 'PENDING' ? (
                               <div className="flex flex-wrap gap-1">
                                  {c.triggeredCriteria?.map(cr => <span key={cr} className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold uppercase rounded">{cr}</span>)}
                                  {c.triggeredLabs?.map(l => <span key={l} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 [font-size:8px] font-black uppercase rounded">{l}</span>)}
                                  {c.manualFlag && (
                                    <span className="px-1.5 py-0.5 bg-rose-500 text-white [font-size:8px] font-black uppercase rounded shadow-sm">Flagged</span>
                                  )}
                               </div>
                             ) : (
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                   <span className={cn(
                                     "px-1.5 py-0.5 text-[8px] font-black uppercase rounded",
                                     c.status === 'CONFIRMED' ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
                                   )}>
                                     {c.status}
                                   </span>
                                   {c.decisionNote && <span className="text-[9px] text-slate-500 line-clamp-1 italic">"{c.decisionNote}"</span>}
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-400 uppercase">Validated on: {c.validatedAt ? new Date(c.validatedAt).toLocaleDateString() : 'N/A'}</span>
                               </div>
                             )}
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-xs font-black text-rose-500 uppercase italic">{c.type}</span>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                               <span className={cn(
                                 "w-3 h-3 rounded-full block shadow-sm",
                                 c.riskLevel === 'RED' ? "bg-rose-500" : c.riskLevel === 'YELLOW' ? "bg-amber-400" : c.riskLevel === 'BLUE' ? "bg-blue-500" : "bg-slate-900"
                               )} />
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{c.riskLevel}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               {isIPCU && (
                                 <button 
                                   onClick={(e) => handleDelete(e, 'hai_cases', c.id)}
                                   className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100/50"
                                   title="Delete Entry"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                               {isIPCU && c.status === 'PENDING' ? (
                                 <button 
                                   onClick={() => { setSelectedCase(c); setIsValidating(true); }}
                                   className="text-[9px] font-black uppercase tracking-widest text-brand-primary p-2 hover:bg-teal-50 rounded-lg transition-colors border border-transparent hover:border-teal-100"
                                 >
                                   Validate
                                 </button>
                               ) : (
                                 <button 
                                   onClick={() => { setSelectedCase(c); setIsValidating(true); }}
                                   className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-2 hover:bg-slate-100 rounded-lg"
                                 >
                                   View
                                 </button>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))}
                      {cases.filter(c => caseFilter === 'PENDING' ? c.status === 'PENDING' : c.status !== 'PENDING').length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-30">
                              <ClipboardList className="w-8 h-8" />
                              <span className="text-[10px] font-black uppercase tracking-widest">No cases found in this category</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>


            {/* Daily Bundle Compliance Audit Queue */}
            <div className="space-y-4 pb-12">
              <div className="flex items-center gap-3">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Daily Bundle Compliance Logs (From Units)</h3>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="px-3 py-1 bg-teal-50 text-teal-600 text-[10px] font-black uppercase rounded-full">Recent Activity</span>
              </div>
              <div className="bento-card bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0 min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date / Patient</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit / Bundle</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Score</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Monitor</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Signs</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monitorings.flatMap(m => (m.monitoringDays || []).map((day, dIdx) => ({ ...day, patient: m, dayIndex: dIdx }))).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15).map((day, idx) => (
                        <tr key={`${day.patient.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-brand-primary uppercase tracking-tight mb-0.5">{day.date}</span>
                              <span className="text-xs font-bold text-slate-900">{day.patient.patientName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{day.patient.unit}</span>
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{day.bundleType}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                               <div className={cn(
                                 "w-10 h-6 rounded px-2 flex items-center justify-center text-[10px] font-black text-white",
                                 day.complianceScores.overall >= 90 ? "bg-emerald-500" : day.complianceScores.overall >= 75 ? "bg-amber-400" : "bg-rose-500"
                               )}>
                                 {day.complianceScores.overall}%
                               </div>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-bold text-slate-600 uppercase">{day.monitor?.name || day.staffName}</span>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1">
                                {day.possibleHAI && (
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 [font-size:8px] font-black uppercase rounded border border-rose-100">{day.triggerReason || 'Manual Flag'}</span>
                                )}
                                {Object.entries(day.clinicalCriteria || {}).filter(([_, v]) => v === true).map(([k]) => (
                                  <span key={k} className="px-1.5 py-0.5 bg-amber-50 text-amber-600 [font-size:8px] font-black uppercase rounded border border-amber-100">{k}</span>
                                ))}
                                {!day.possibleHAI && Object.values(day.clinicalCriteria || {}).every(v => v !== true) && <span className="text-[8px] font-bold text-slate-300 uppercase">Negative</span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               {day.possibleHAI ? (
                                  <div className="flex items-center gap-2 text-rose-500">
                                    <AlertTriangle className="w-4 h-4 shadow-sm" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Triggered – Possible HAI</span>
                                  </div>
                               ) : (day as any).isVerifiedByIPCU ? (
                                  <div className="flex items-center gap-2 text-emerald-500">
                                    <ShieldCheck className="w-4 h-4 shadow-sm" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Verified</span>
                                  </div>
                               ) : isIPCU ? (
                                  <button 
                                    onClick={() => { setSelectedDayToVerify({ patient: day.patient, day: day, index: day.dayIndex }); setIsVerifyingDay(true); }}
                                    className="p-2 hover:bg-teal-50 rounded-lg text-teal-600 transition-all border border-teal-100 group-hover:scale-105 active:scale-95"
                                    title="IPCU Validation"
                                  >
                                    <ShieldCheck className="w-4 h-4" />
                                  </button>
                               ) : (
                                  <div className="flex items-center gap-2 text-slate-300">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Logged</span>
                                  </div>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))}
                      {monitorings.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">No bundle compliance logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Pending Unit Audits (BOC Logs) */}
            <div className="space-y-4 pb-20">
              <div className="flex items-center gap-3">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Pending Unit Audits (BOC Forms)</h3>
                <div className="h-px flex-1 bg-slate-200" />
                <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                   <AlertTriangle className="w-3 h-3" />
                   {bundleLogs.filter(l => !l.isValidated).length} Awaiting Verification
                </div>
              </div>
              <div className="bento-card bg-white overflow-hidden shadow-xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0 min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Auditor / Date</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient / Unit</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Devices</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Score</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bundleLogs.filter(l => !l.isValidated || isIPCU).map(log => (
                        <tr key={log.id} className={cn("hover:bg-slate-50/50 transition-colors group", log.isValidated ? "opacity-50" : "")}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{log.staffName || 'Unit Staff'}</span>
                              <span className="text-[10px] font-bold text-slate-400">{log.date} {log.time}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <span className="text-xs font-bold text-slate-900">{log.patientName}</span>
                               <span className="text-[10px] font-black text-brand-primary uppercase tracking-tight">{log.unit}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex gap-1 flex-wrap max-w-[200px]">
                                {log.devicesPresent.map(d => (
                                  <span key={d} className="px-2 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-600 rounded-lg">{d}</span>
                                ))}
                             </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={cn(
                              "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black",
                              log.compliancePercentage >= 90 ? "bg-emerald-100 text-emerald-700" : log.compliancePercentage >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                            )}>
                              {log.compliancePercentage}%
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             {isIPCU && !log.isValidated ? (
                               <button 
                                 onClick={() => { setSelectedLog(log); setIsVerifying(true); }}
                                 className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                               >
                                 Verify Audit
                               </button>
                             ) : log.isValidated ? (
                               <div className="flex items-center justify-end gap-2 text-emerald-500">
                                 <CheckCircle2 className="w-4 h-4" />
                                 <span className="text-[10px] font-black uppercase">Verified</span>
                               </div>
                             ) : (
                               <span className="text-[10px] font-bold text-slate-400 uppercase">Awaiting IPCU</span>
                             )}
                          </td>
                        </tr>
                      ))}
                      {bundleLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">No audit logs awaiting verification</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'monitoring' && (
          <motion.div
            key="monitoring"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-8"
          >
            {/* Unit Sidebar / Patient List */}
            <div className="lg:col-span-1 space-y-6">
               <div className="bento-card p-4 bg-white">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Active Patient Units</h4>
                  </div>
                  <div className="space-y-1">
                    {['NICU', 'PICU', 'ICU', 'Ward', 'ER', 'OR', 'ARCHIVED'].map(unit => {
                      const isArchivedTab = unit === 'ARCHIVED';
                      const count = isArchivedTab 
                        ? monitorings.filter(m => m.status === 'ARCHIVED').length
                        : monitorings.filter(m => m.unit === unit && m.status === 'ACTIVE').length;
                      const isActive = selectedUnit === unit;
                      return (
                        <button 
                          key={unit}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left group",
                            isActive 
                              ? (isArchivedTab ? "bg-slate-700 text-white shadow-lg" : "bg-teal-600 text-white shadow-lg shadow-teal-600/20") 
                              : "hover:bg-slate-50 text-slate-600"
                          )}
                          onClick={() => setSelectedUnit(isActive ? null : unit)}
                        >
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-tight transition-colors", 
                            isActive ? "text-white" : (isArchivedTab ? "text-slate-400" : "group-hover:text-teal-600")
                          )}>
                            {isArchivedTab ? 'Archived Records' : unit}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[8px] font-black transition-all", 
                            isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600"
                          )}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
               </div>

               <div className="bento-card p-4 bg-white">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Find patient..." 
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 border-none rounded-lg text-[10px] font-medium"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
                    {monitorings
                      .filter(m => {
                        const isInSelectedUnit = !selectedUnit || selectedUnit === 'ARCHIVED' || m.unit === selectedUnit;
                        const hasCorrectStatus = selectedUnit === 'ARCHIVED' ? m.status === 'ARCHIVED' : m.status === 'ACTIVE';
                        const matchesSearch = m.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || m.hospitalNo.includes(searchTerm);
                        return isInSelectedUnit && hasCorrectStatus && matchesSearch;
                      })
                      .map(p => (
                        <div 
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer group",
                            selectedPatient?.id === p.id 
                              ? "bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/10" 
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                           <div className="flex justify-between items-start mb-1">
                              <span className={cn("text-[8px] font-black uppercase tracking-widest", selectedPatient?.id === p.id ? "text-slate-400" : "text-slate-500")}>#{p.hospitalNo}</span>
                              <span className={cn("text-[8px] font-black uppercase", selectedPatient?.id === p.id ? "text-teal-400" : "text-slate-400")}>{p.unit}</span>
                           </div>
                           <h5 className={cn("text-[10px] font-black uppercase leading-tight truncate", selectedPatient?.id === p.id ? "text-white" : "text-slate-900")}>{p.patientName}</h5>
                           <div className="flex items-center gap-2 mt-2">
                             {p.devices.clabsi && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" title="CLABSI" />}
                             {p.devices.cauti && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" title="CAUTI" />}
                             {p.devices.vap && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" title="VAP" />}
                             {p.surgery && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" title="SSI" />}
                             <span className={cn("text-[8px] font-bold uppercase tracking-tight ml-auto", selectedPatient?.id === p.id ? "text-slate-400" : "text-slate-400")}>Day {p.monitoringDays?.length || 0}</span>
                           </div>
                        </div>
                      ))}
                  </div>
               </div>
            </div>

            {/* Patient File View */}
            <div className="lg:col-span-3">
              {selectedPatient ? (
                <div className="bento-card bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[600px] flex flex-col">
                  <div className="bg-slate-900 p-8 text-white">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-black uppercase tracking-tight">{selectedPatient.patientName}</h3>
                          <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">{selectedPatient.hospitalNo}</span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                          <span>{selectedPatient.sex}</span>
                          <span>{selectedPatient.age} Yrs</span>
                          <span className="text-teal-400">{selectedPatient.unit}</span>
                          <span className="text-slate-500">•</span>
                          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black", selectedPatient.status === 'ACTIVE' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
                            {selectedPatient.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Attending MD</p>
                           <p className="text-xs font-black uppercase truncate max-w-[120px]">{selectedPatient.attendingPhysician || 'N/A'}</p>
                         </div>
                         <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-center min-w-[120px]">
                           <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Compliance</p>
                           <p className="text-xl font-black text-emerald-400">
                             {selectedPatient.monitoringDays?.length > 0 
                               ? (selectedPatient.monitoringDays.reduce((acc, d) => acc + d.complianceScores.overall, 0) / selectedPatient.monitoringDays.length).toFixed(1)
                               : '0.0'}%
                           </p>
                           <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Avg Daily</p>
                         </div>
                         {selectedPatient.status === 'ACTIVE' ? (
                           isAdmin && (
                             <button 
                               onClick={() => setIsEndingMonitoring(true)}
                               className="p-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-2xl transition-all group"
                               title="End Monitoring / Archive"
                             >
                               <XCircle className="w-5 h-5" />
                             </button>
                           )
                         ) : (
                            isIPCU && (
                              <button 
                                onClick={async (e) => {
                                  if (window.confirm('Permanently delete this patient record and all monitoring history? THIS CANNOT BE UNDONE.')) {
                                    try {
                                      await deleteDoc(doc(db, 'bundle_monitorings', selectedPatient.id!));
                                      setSelectedPatient(null);
                                      showToast('Patient record permanently deleted');
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.DELETE, 'bundle_monitorings');
                                    }
                                  }
                                }}
                                className="p-4 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-2xl transition-all group"
                                title="Delete Permanently (IPCU Only)"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )
                          )}
                      </div>
                    </div>
                  </div>

                    {selectedPatient.status === 'ARCHIVED' && (
                      <div className="mx-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-8 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-slate-900 text-white rounded-lg">
                            <Layers className="w-4 h-4" />
                          </div>
                          <h4 className="text-[10px] font-black uppercase tracking-tight text-slate-900">Archival Details</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Archived Date</p>
                            <p className="text-[10px] font-bold text-slate-900">{selectedPatient.endMonitoringDateTime ? formatDate(selectedPatient.endMonitoringDateTime) : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                            <p className="text-[10px] font-bold text-slate-900">{selectedPatient.endMonitoringReason || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ended By</p>
                            <p className="text-[10px] font-bold text-slate-900">{selectedPatient.endedByAdmin || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Days</p>
                            <p className="text-[10px] font-bold text-slate-900">{selectedPatient.monitoringDays?.length || 0} monitored days</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-8 flex-1 flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Clinical Monitoring History</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight italic">Every calendar day must have an entry</p>
                      </div>
                      {selectedPatient.status === 'ACTIVE' && (
                        <button 
                          onClick={() => setIsAddingDay(true)}
                          className="px-6 py-2.5 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/20 active:scale-95 transition-all"
                        >
                          Add Monitoring Day
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                      {selectedPatient.monitoringDays?.slice().reverse().map((day, idx) => (
                        <div key={idx} className={cn("bento-card p-5 border relative group transition-all", day.missedDay ? "bg-rose-50/50 border-rose-100" : "bg-slate-50 border-slate-100")}>
                          <div className="flex justify-between items-start mb-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                              day.missedDay ? "bg-rose-500" : 
                              day.complianceScores.overall >= 90 ? "bg-emerald-500" : 
                              day.complianceScores.overall >= 70 ? "bg-amber-500" : "bg-slate-400"
                            )}>
                              <span className="text-[10px] font-black">{day.complianceScores.overall}%</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Day {day.dayNumber}</p>
                              <p className="text-[8px] font-bold text-slate-500">{day.date}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {day.missedDay ? (
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-rose-600 uppercase tracking-tight">Missed Entry</p>
                                <p className="text-[8px] font-bold text-rose-400 line-clamp-2 italic">"{day.missedReason}"</p>
                              </div>
                            ) : (
                              <div>
                                <div className="flex justify-between text-[7px] font-black uppercase text-slate-400 mb-1">
                                  <span>{day.bundleType} Bundle Compliance</span>
                                  <span>{day.complianceScores.bundle}%</span>
                                </div>
                                <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-teal-500 transition-all shadow-sm shadow-teal-500/50" style={{ width: `${day.complianceScores.bundle}%` }} />
                                </div>
                              </div>
                            )}
                            <div className="pt-3 border-t border-slate-200/50 flex items-center justify-between">
                              <p className="text-[8px] font-bold text-slate-500 uppercase truncate pr-2">Monitor: {day.monitor?.name || day.staffName || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!selectedPatient.monitoringDays || selectedPatient.monitoringDays.length === 0) && (
                        <div className="col-span-full py-12 text-center text-slate-400 bento-card border-dashed bg-slate-50/50 border-slate-200">
                          <Plus className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No Monitoring Records</p>
                          <p className="text-[8px] font-bold uppercase text-slate-300">Daily checks will appear here once started</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bento-card bg-white h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center rotate-12">
                    <Activity className="w-10 h-10 text-slate-200" />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">Select Patient to Monitor</h5>
                    <p className="text-[10px] text-slate-400 font-medium max-w-xs mx-auto">Tap a patient from the unit list on the left to start daily clinical monitoring and bundle checks.</p>
                  </div>
                  <button 
                    onClick={() => setIsEnrollingDevice(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Enroll New Patient
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Portals / Modals updated with bento theme */}
      <AnimatePresence>
        {isAddingCase && (
          <SurveillanceModal 
            onClose={() => setIsAddingCase(false)}
            formData={caseForm}
            setFormData={setCaseForm}
            onSubmit={handleCaseSubmit}
          />
        )}
        
        {isValidating && selectedCase && (
          <HAIValidationModal 
            onClose={() => { setIsValidating(false); setSelectedCase(null); }}
            haiCase={selectedCase}
            onSubmit={handleValidationSubmit}
            user={user}
            loading={isValidationLoading}
          />
        )}

        {isAddingBundle && (
          <BundleModal 
            onClose={() => setIsAddingBundle(false)}
            formData={bundleForm}
            setFormData={setBundleForm}
            onSubmit={handleBundleSubmit}
            user={user}
          />
        )}
        {isVerifying && selectedLog && (
          <VerificationModal
            onClose={() => { setIsVerifying(false); setSelectedLog(null); }}
            log={selectedLog}
            formData={verificationForm}
            setFormData={setVerificationForm}
            onSubmit={handleVerifySubmit}
            user={user}
          />
        )}
        {isManagingDenominators && (
          <DenominatorsModal 
            onClose={() => setIsManagingDenominators(false)}
            denominators={denominators}
            user={user}
            showToast={showToast}
          />
        )}

        {isEnrollingDevice && (
          <DeviceEnrollmentModal
            onClose={() => setIsEnrollingDevice(false)}
            user={user}
            showToast={showToast}
          />
        )}

      {isVerifyingDay && selectedDayToVerify && (
        <MonitoringDayValidationModal
          onClose={() => { setIsVerifyingDay(false); setSelectedDayToVerify(null); }}
          patient={selectedDayToVerify.patient}
          day={selectedDayToVerify.day}
          dayIndex={selectedDayToVerify.index}
          onSubmit={handleVerifyMonitoringDay}
          user={user}
        />
      )}

      {isAddingDay && selectedPatient && (
        <MonitoringDayModal
          patient={selectedPatient}
          onClose={() => setIsAddingDay(false)}
          user={user}
          onSave={async (day) => {
            try {
              const updatedDays = [...(selectedPatient.monitoringDays || []), day];
              
              // Update specific monitoring patient document
              await updateDoc(doc(db, 'bundle_monitorings', selectedPatient.id!), removeUndefined({
                monitoringDays: updatedDays,
                hasUnverifiedDays: true,
                updatedAt: serverTimestamp(),
                isFlaggedPossibleHAI: day.possibleHAI || selectedPatient.isFlaggedPossibleHAI || false,
                latestTriggerReason: day.possibleHAI ? day.triggerReason : selectedPatient.latestTriggerReason,
                latestTriggerDateTime: day.possibleHAI ? serverTimestamp() : selectedPatient.latestTriggerDateTime,
                latestTriggeredBy: day.possibleHAI ? day.triggeredBy : selectedPatient.latestTriggeredBy
              }));

              // Trigger HAI case if clinical criteria are present OR manually flagged
              const hasSigns = Object.values(day.clinicalCriteria || {}).some(v => v === true);
              if (hasSigns || day.possibleHAI) {
                const patientHistory = updatedDays.filter(d => !d.missedDay);
                const totalDays = patientHistory.length;
                
                const manualCriteria = day.possibleHAI ? [day.triggerReason || 'Manual Flag'] : [];
                const clinicalCriteriaList = Object.entries(day.clinicalCriteria || {}).filter(([_, v]) => v === true).map(([k]) => k);
                const allCriteria = Array.from(new Set([...manualCriteria, ...clinicalCriteriaList]));

                await addDoc(collection(db, 'hai_cases'), removeUndefined({
                  patientName: selectedPatient.patientName,
                  hospNo: selectedPatient.hospitalNo,
                  unit: selectedPatient.unit,
                  type: day.bundleType,
                  status: 'PENDING',
                  riskLevel: 'RED',
                  deviceDays: totalDays,
                  triggerDate: day.date,
                  triggeredCriteria: allCriteria,
                  triggeredLabs: [],
                  auditorId: user?.uid,
                  auditorEmail: user?.email,
                  auditorName: user?.name,
                  isValidated: false,
                  isFromBundle: true,
                  manualFlag: day.possibleHAI || false,
                  bundleRef: { patientId: selectedPatient.id, dayIndex: updatedDays.length - 1 },
                  createdAt: serverTimestamp()
                }));
                showToast(day.possibleHAI ? 'Possible HAI manually flagged' : 'Suspected HAI case auto-triggered');
              }

              setSelectedPatient({ ...selectedPatient, monitoringDays: updatedDays, hasUnverifiedDays: true });
              setIsAddingDay(false);
              showToast('Daily monitoring entry saved');
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, 'bundle_monitorings');
            }
          }}
        />
      )}

      {isEndingMonitoring && selectedPatient && (
        <EndMonitoringModal
          onClose={() => setIsEndingMonitoring(false)}
          onConfirm={async (reason: string) => {
            try {
              await updateDoc(doc(db, 'bundle_monitorings', selectedPatient.id!), removeUndefined({
                status: 'ARCHIVED',
                endMonitoring: true,
                endMonitoringDateTime: serverTimestamp(),
                endMonitoringReason: reason,
                endedByAdmin: user?.name,
                updatedAt: serverTimestamp()
              }));
              setSelectedPatient({ 
                ...selectedPatient, 
                status: 'ARCHIVED',
                endMonitoring: true,
                endMonitoringDateTime: new Date().toISOString(),
                endMonitoringReason: reason,
                endedByAdmin: user?.name || ''
              });
              setIsEndingMonitoring(false);
              showToast('Patient record archived successfully');
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, 'bundle_monitorings');
            }
          }}
        />
      )}

      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={cn(
              "px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md",
              toast.type === 'success' ? "bg-emerald-500/90 text-white border-emerald-400" : "bg-rose-500/90 text-white border-rose-400"
            )}>
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EndMonitoringModal({ onClose, onConfirm }: any) {
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    const finalReason = reason === 'Other' ? otherReason : reason;
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-900 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white uppercase tracking-tight">End Patient Monitoring</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Reason for Ending Monitoring</label>
              {END_MONITORING_REASONS.map(r => (
                <label key={r} className={cn("flex items-center p-4 rounded-2xl border transition-all cursor-pointer", reason === r ? "bg-slate-900 border-slate-900 text-white" : "bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200")}>
                  <input type="radio" name="endReason" className="hidden" checked={reason === r} onChange={() => setReason(r)} />
                  <span className="text-xs font-black uppercase tracking-tight">{r}</span>
                </label>
              ))}
              
              <AnimatePresence>
                {reason === 'Other' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase tracking-tight focus:ring-2 focus:ring-slate-900/10 outline-none transition-all mt-2"
                      placeholder="Please specify other reason..."
                      rows={3}
                      value={otherReason}
                      onChange={e => setOtherReason(e.target.value)}
                      required
                    />
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
           
           <button 
             type="submit" 
             disabled={!reason || (reason === 'Other' && !otherReason)}
             className="w-full py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-900/20 active:scale-95 transition-all disabled:opacity-50"
           >
             End Monitoring & Archive
           </button>
        </form>
      </motion.div>
    </div>
  );
}

function DenominatorsModal({ onClose, denominators, user, showToast }: any) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const existing = denominators.find((d: any) => d.month === currentMonthStr) || {};
  
  const [form, setForm] = useState({
    patientsAtRisk: existing.patientsAtRisk || 5000,
    ventDays: existing.ventDays || 1000,
    lineDays: existing.lineDays || 1200,
    cathDays: existing.cathDays || 1500,
    procedureDays: existing.procedureDays || 1000
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const q = query(collection(db, 'hai_denominators'), where('month', '==', currentMonthStr));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        await addDoc(collection(db, 'hai_denominators'), removeUndefined({
          ...form,
          month: currentMonthStr,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        }));
      } else {
        await updateDoc(doc(db, 'hai_denominators', snap.docs[0].id), removeUndefined({
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        }));
      }
      onClose();
      showToast('Monthly statistics updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'hai_denominators');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-900 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white uppercase tracking-tight">Monthly Denominators</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
           <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-4">Current Month: {currentMonthStr}</p>
           <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Patients At Risk', key: 'patientsAtRisk' },
                { label: 'Vent Days (VAP)', key: 'ventDays' },
                { label: 'Line Days (CLABSI)', key: 'lineDays' },
                { label: 'Cath Days (CAUTI)', key: 'cathDays' },
                { label: 'Total Procedures (SSI)', key: 'procedureDays' }
              ].map(f => (
                <div key={f.key}>
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">{f.label}</label>
                   <input 
                     type="number" 
                     className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                     value={form[f.key as keyof typeof form]}
                     onChange={e => setForm({...form, [f.key]: parseInt(e.target.value) || 0})}
                   />
                </div>
              ))}
           </div>
           <button type="submit" className="w-full btn-primary py-3 font-black uppercase tracking-widest">Update Statistics</button>
        </form>
      </motion.div>
    </div>
  );
}

function VerificationModal({ onClose, log, formData, setFormData, onSubmit }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-brand-primary p-2 rounded-xl text-white">
               <ShieldCheck className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-white uppercase tracking-tight">IPCU Daily Verification Form</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.patientName} • {log.unit}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-hidden flex flex-col bg-slate-50">
          <div className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto">
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Verification of Unit Entries */}
              <div className="space-y-6">
                 <div className="border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Verification of Unit Entries</h4>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Completeness</label>
                       <div className="flex gap-4">
                          {['Complete', 'Incomplete'].map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="completeness" 
                                 className="w-4 h-4 text-brand-primary" 
                                 checked={formData.completeness.status === s} 
                                 onChange={() => setFormData({...formData, completeness: { ...formData.completeness, status: s }})} 
                               />
                               <span className="text-xs font-bold text-slate-700">{s}</span>
                            </label>
                          ))}
                       </div>
                       {formData.completeness.status === 'Incomplete' && (
                         <input placeholder="Specify missing items..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs" value={formData.completeness.details} onChange={e => setFormData({...formData, completeness: { ...formData.completeness, details: e.target.value }})} />
                       )}
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Accuracy</label>
                       <div className="flex gap-4">
                          {['Accurate', 'Inaccurate'].map(s => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                               <input 
                                 type="radio" 
                                 name="accuracy" 
                                 className="w-4 h-4 text-brand-primary" 
                                 checked={formData.accuracy.status === s} 
                                 onChange={() => setFormData({...formData, accuracy: { ...formData.accuracy, status: s }})} 
                               />
                               <span className="text-xs font-bold text-slate-700">{s}</span>
                            </label>
                          ))}
                       </div>
                       {formData.accuracy.status === 'Inaccurate' && (
                         <input placeholder="Specify discrepancy..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs" value={formData.accuracy.details} onChange={e => setFormData({...formData, accuracy: { ...formData.accuracy, details: e.target.value }})} />
                       )}
                    </div>

                    {/* Section E: Verification of Form Monitoring */}
                    <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-4">
                       <div className="flex items-center justify-between">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-800">Form Documentation Audit</h4>
                         <ShieldCheck className="w-4 h-4 text-teal-400" />
                       </div>
                       <div className="space-y-3">
                          {log.formMonitoring?.map((item: any) => (
                            <div key={item.section} className="flex flex-col gap-1 p-2 bg-white rounded-xl border border-teal-50">
                               <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-800">{item.section}</span>
                                  <div className="flex items-center gap-2">
                                     {item.section !== 'Clinical Criteria Section' && item.isSigned && (
                                       <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary">Signed</span>
                                     )}
                                     <span className={cn(
                                       "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                                       item.status === 'Complete' ? "bg-emerald-100 text-emerald-700" : item.status === 'Incomplete' ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                                     )}>{item.status}</span>
                                  </div>
                               </div>
                               {item.remarks && (
                                 <p className="text-[9px] text-rose-600 font-medium italic">Missing: {item.remarks}</p>
                               )}
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Right Column: Independent Assessment */}
              <div className="space-y-6">
                 <div className="border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Independent Assessment</h4>
                 </div>
                 <div className="space-y-4">
                    {log.devicesPresent.map((devId: string) => {
                      const dev = DEVICES.find(d => d.id === devId);
                      return (
                        <div key={devId} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-slate-500">{dev?.label}</span>
                              <div className="flex gap-3">
                                 {[true, false].map(v => (
                                   <label key={v.toString()} className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="radio" 
                                        name={`assessment-${devId}`} 
                                        checked={formData.independentAssessment?.[devId]?.isCompliant === v}
                                        onChange={() => setFormData({
                                          ...formData, 
                                          independentAssessment: { 
                                            ...formData.independentAssessment, 
                                            [devId]: { ...(formData.independentAssessment?.[devId] || {}), isCompliant: v } 
                                          }
                                        })}
                                      />
                                      <span className="text-[9px] font-black uppercase">{v ? 'Pass' : 'Fail'}</span>
                                   </label>
                                 ))}
                              </div>
                           </div>
                           <input 
                             placeholder="Independent observer notes..." 
                             className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px]" 
                             value={formData.independentAssessment?.[devId]?.notes || ''}
                             onChange={e => setFormData({
                               ...formData, 
                               independentAssessment: { 
                                 ...formData.independentAssessment, 
                                 [devId]: { ...(formData.independentAssessment?.[devId] || {}), notes: e.target.value } 
                               }
                             })}
                           />
                        </div>
                      );
                    })}
                 </div>
              </div>
           </div>

           {/* Final Decision */}
           <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6">
              <div className="flex items-center justify-between mb-2">
                 <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Final IPCU Compliance Decision</h4>
                 <div className="flex gap-6">
                    {['Compliant', 'Non-compliant'].map(d => (
                      <label key={d} className="flex items-center gap-3 cursor-pointer">
                         <input 
                           type="radio" 
                           name="finalDecision" 
                           checked={formData.finalDecision === d} 
                           onChange={() => setFormData({...formData, finalDecision: d})}
                         />
                         <span className={cn(
                           "text-xs font-black uppercase tracking-widest",
                           formData.finalDecision === d ? (d === 'Compliant' ? "text-emerald-400" : "text-rose-400") : "text-slate-500"
                         )}>{d}</span>
                      </label>
                    ))}
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Reason / Validation Details</label>
                    <textarea className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs h-24 resize-none outline-none focus:ring-1 focus:ring-brand-primary" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
                 </div>
                 <div className="space-y-4">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Corrective Action (If Non-Compliant)</label>
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                       {IPCU_CORRECTIVE_ACTIONS.map(action => (
                         <label key={action} className="flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={formData.correctiveAction.includes(action)}
                              onChange={(e) => {
                                const updated = e.target.checked 
                                  ? [...formData.correctiveAction, action]
                                  : formData.correctiveAction.filter((a: string) => a !== action);
                                setFormData({...formData, correctiveAction: updated});
                              }}
                            />
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{action}</span>
                         </label>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validator Name</label>
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" value={formData.validatorName} onChange={e => setFormData({...formData, validatorName: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Designation / Role</label>
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" value={formData.validatorDesignation} onChange={e => setFormData({...formData, validatorDesignation: e.target.value})} />
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Date</label>
                 <input type="date" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Time</label>
                 <input type="time" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
           </div>

            </div>

          <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 shrink-0">
            <button type="submit" className="w-full py-4 sm:py-5 bg-brand-primary text-white font-black uppercase tracking-[0.2em] rounded-2xl sm:rounded-3xl shadow-2xl shadow-teal-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs">Publish Official Verification</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StatRow({ label, count, target, color }: any) {
  const isDanger = color === 'rose';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className={cn("text-lg font-black tracking-tight", isDanger ? "text-rose-400" : "text-teal-400")}>{count}</span>
          <span className="text-[10px] text-slate-500 font-mono italic">Target: {target}</span>
        </div>
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", isDanger ? "bg-rose-500" : "bg-teal-500")} style={{ width: `${Math.min((count/3)*100, 100)}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-20 flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
      <div className="bg-white p-4 rounded-3xl shadow-sm mb-4">
        <Layers className="w-8 h-8 text-slate-200" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{message}</p>
    </div>
  );
}

function SurveillanceModal({ onClose, formData, setFormData, onSubmit }: any) {
  const toggleCriteria = (criterion: string) => {
    const current = formData.triggeredCriteria || [];
    const updated = current.includes(criterion) 
      ? current.filter((c: string) => c !== criterion) 
      : [...current, criterion];
    setFormData({...formData, triggeredCriteria: updated});
  };

  const toggleLab = (lab: string) => {
    const current = formData.triggeredLabs || [];
    const updated = current.includes(lab) 
      ? current.filter((l: string) => l !== lab) 
      : [...current, lab];
    setFormData({...formData, triggeredLabs: updated});
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-rose-500 p-2 rounded-xl text-white shadow-lg shadow-rose-900/10">
               <AlertTriangle className="w-5 h-5" />
             </div>
             <h3 className="text-sm sm:text-lg font-bold text-slate-900 uppercase tracking-tight">Clinical HAI Detection Entry</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-hidden flex flex-col bg-white">
          <div className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left: Basic Info */}
            <div className="space-y-6">
               <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient & Case Details</h4>
                  <div className="flex gap-2">
                     {['RED', 'YELLOW', 'BLUE'].map(risk => (
                       <button
                         key={risk}
                         type="button"
                         onClick={() => setFormData({...formData, riskLevel: risk})}
                         className={cn(
                           "w-4 h-4 rounded-full border-2 border-white shadow-sm transition-transform",
                           formData.riskLevel === risk ? "scale-125 ring-2 ring-slate-100 ring-offset-2" : "opacity-40",
                           risk === 'RED' ? "bg-rose-500" : risk === 'YELLOW' ? "bg-amber-400" : "bg-blue-500"
                         )}
                       />
                     ))}
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Infection Vector</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                      <option value="CLABSI">CLABSI</option>
                      <option value="VAP">VAP</option>
                      <option value="CAUTI">CAUTI</option>
                      <option value="SSI">SSI</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Patient Name</label>
                    <input placeholder="Full Name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Hosp #</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.hospNo} onChange={e => setFormData({...formData, hospNo: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Unit</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Device Type</label>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})}>
                        <option value="Central Line">Central Line</option>
                        <option value="Foley Catheter">Foley Catheter</option>
                        <option value="Mechanical Ventilator">Mechanical Ventilator</option>
                        <option value="Surgical Procedure">Surgical Procedure</option>
                        <option value="Other">Other</option>
                      </select>
                      {formData.deviceType === 'Other' && (
                        <motion.input 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          placeholder="Specify other device..." 
                          className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500" 
                          value={formData.deviceTypeOther || ''}
                          onChange={e => setFormData({...formData, deviceTypeOther: e.target.value})}
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Device Days</label>
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.deviceDays} onChange={e => setFormData({...formData, deviceDays: parseInt(e.target.value)})} />
                    </div>
                  </div>
               </div>
            </div>

            {/* Right: Triggers */}
            <div className="space-y-6">
               <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Triggered Criteria</h4>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Clinical Criteria</label>
                    <div className="flex flex-wrap gap-2">
                       {['Fever >38C', 'Hypotension', 'Tachycardia', 'Purulent Drainage', 'Heat/Pain/Swelling', 'Abdominal Pain', 'Cough/Dyspnea', 'Other'].map(c => (
                         <button
                           key={c}
                           type="button"
                           onClick={() => toggleCriteria(c)}
                           className={cn(
                             "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                             formData.triggeredCriteria?.includes(c) 
                               ? "bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-900/10" 
                               : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                           )}
                         >
                           {c}
                         </button>
                       ))}
                    </div>
                    {formData.triggeredCriteria?.includes('Other') && (
                      <motion.input 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        placeholder="Specify other criteria..." 
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500" 
                        value={formData.criteriaOther || ''}
                        onChange={e => setFormData({...formData, criteriaOther: e.target.value})}
                      />
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Laboratory Criteria</label>
                    <div className="flex flex-wrap gap-2">
                       {['Positive Blood Culture', 'Positive Urine Culture', 'Positive Tip Culture', 'WBC >12,000', 'WBC <4,000', 'Radiographic Evidence', 'C-Reactive Protein +', 'Other'].map(l => (
                         <button
                           key={l}
                           type="button"
                           onClick={() => toggleLab(l)}
                           className={cn(
                             "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                             formData.triggeredLabs?.includes(l) 
                               ? "bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-900/10" 
                               : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                           )}
                         >
                           {l}
                         </button>
                       ))}
                    </div>
                    {formData.triggeredLabs?.includes('Other') && (
                      <motion.input 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        placeholder="Specify other lab..." 
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                        value={formData.labOther || ''}
                        onChange={e => setFormData({...formData, labOther: e.target.value})}
                      />
                    )}
                  </div>
                  
                  <div className="space-y-1.5 pt-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Additional Symptoms / Notes</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium h-20 resize-none outline-none" placeholder="Enter findings..." value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
                  </div>
               </div>
            </div>
          </div>

          </div>
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex flex-col sm:flex-row gap-4">
             <button type="button" onClick={onClose} className="flex-1 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] border border-slate-200 sm:border-none rounded-2xl">Cancel Report</button>
             <button type="submit" className="flex-2 py-4 bg-rose-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-rose-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-[11px]">Submit Clinical Stream</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function BundleModal({ onClose, formData, setFormData, onSubmit }: any) {
  const calculateStats = () => {
    let total = 0;
    let compliant = 0;
    formData.devicesPresent?.forEach((dev: string) => {
      const elements = BUNDLE_ELEMENTS[dev as keyof typeof BUNDLE_ELEMENTS] || [];
      total += elements.length;
      const bundle = formData.bundles?.[dev];
      if (bundle) {
        compliant += Object.values(bundle.elements || {}).filter(Boolean).length;
      }
    });
    return { total, compliant };
  };

  const { total: totalApplicable, compliant: totalCompliant } = calculateStats();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-brand-primary p-2 rounded-xl text-white shadow-lg shadow-teal-900/10">
               <ShieldCheck className="w-5 h-5" />
             </div>
             <h3 className="text-sm sm:text-lg font-bold text-slate-900 uppercase tracking-tight">Daily Bundles Compliance Monitoring</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Patient Info */}
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-2">
               <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Patient Information</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time</label>
                  <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
               </div>
               <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Unit / Ward</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
               </div>
               <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Patient Name</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hosp Number</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.hospNo} onChange={e => setFormData({...formData, hospNo: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Age</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sex</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
               </div>
            </div>
          </div>

          {/* Devices */}
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-2">
               <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Device(s) Present Today</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               {DEVICES.map(dev => (
                 <label key={dev.id} className={cn(
                   "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                   formData.devicesPresent?.includes(dev.id) ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-teal-900/10" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                 )}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.devicesPresent?.includes(dev.id)} 
                      onChange={(e) => {
                        const updated = e.target.checked 
                          ? [...(formData.devicesPresent || []), dev.id]
                          : (formData.devicesPresent || []).filter((id: string) => id !== dev.id);
                        
                        const newBundles = { ...formData.bundles };
                        if (e.target.checked && !newBundles[dev.id]) {
                          newBundles[dev.id] = { deviceType: dev.id, elements: {}, isCompliant: false };
                        }
                        
                        setFormData({...formData, devicesPresent: updated, bundles: newBundles});
                      }} 
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest">{dev.label}</span>
                 </label>
               ))}
            </div>
          </div>

          {/* Section C: Bundle Compliance */}
          {formData.devicesPresent?.length > 0 && (
            <div className="space-y-8">
               <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Bundle Compliance</h4>
               </div>
               <div className="space-y-12">
                  {formData.devicesPresent.map((devId: string) => {
                    const dev = DEVICES.find(d => d.id === devId);
                    const elements = BUNDLE_ELEMENTS[devId as keyof typeof BUNDLE_ELEMENTS] || [];
                    const bundle = formData.bundles?.[devId] || { elements: {} };

                    return (
                      <div key={devId} className="space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="h-px flex-1 bg-slate-100" />
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{dev?.label} — {dev?.hai} Bundle</h5>
                           <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {elements.map((el, i) => (
                             <label key={i} className={cn(
                               "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                               bundle.elements?.[el] ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                             )}>
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 checked:bg-emerald-500"
                                  checked={bundle.elements?.[el] || false}
                                  onChange={(e) => {
                                    const updatedBundles = { ...formData.bundles };
                                    updatedBundles[devId] = {
                                      ...bundle,
                                      elements: { ...bundle.elements, [el]: e.target.checked }
                                    };
                                    setFormData({...formData, bundles: updatedBundles});
                                  }}
                                />
                                <span className="text-[10px] font-bold leading-tight">{el}</span>
                             </label>
                           ))}
                        </div>
                        <div className="flex flex-col gap-2">
                           <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Remarks</label>
                           <input 
                             className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-brand-primary"
                             value={bundle.remarks || ''}
                             onChange={e => {
                               const updatedBundles = { ...formData.bundles };
                               updatedBundles[devId] = { ...bundle, remarks: e.target.value };
                               setFormData({...formData, bundles: updatedBundles});
                             }}
                           />
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}

          {/* Overall Daily Compliance summary */}
          {formData.devicesPresent?.length > 0 && (
            <div className="p-6 bg-slate-900 rounded-3xl text-white">
               <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary mb-1">Overall Daily Compliance</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Compliance Score for {formData.devicesPresent.length} Device(s)</p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-4xl font-black tracking-tighter",
                      totalCompliant === totalApplicable ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {Math.round((totalCompliant / (totalApplicable || 1)) * 100)}%
                    </span>
                    <p className="text-[8px] font-black uppercase text-slate-500 mt-1">{totalCompliant} / {totalApplicable} Elements Compliant</p>
                  </div>
               </div>
            </div>
          )}

          {/* Staff */}
          <div className="space-y-4 pt-8 border-t border-slate-100">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Name / Initials</label>
                   <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Designation</label>
                   <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.staffDesignation} onChange={e => setFormData({...formData, staffDesignation: e.target.value})} />
                </div>
             </div>
          </div>

          {/* Section D: Form Compliance Audit (Physical Forms) */}
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
               <div className="flex items-center gap-3">
                 <div className="bg-brand-primary/10 p-2 rounded-lg">
                   <ShieldCheck className="w-4 h-4 text-brand-primary" />
                 </div>
                 <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 leading-none">Form Completion Audit</h4>
                   <p className="text-[10px] text-slate-500 font-medium tracking-tight mt-1">Audit of Physician (PIC) and Nurse (NIC) physical form completion</p>
                 </div>
               </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
               {formData.formMonitoring?.map((item: any, idx: number) => (
                 <div key={item.section} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-900 mb-1">{item.section}</h5>
                      <p className="text-[10px] text-slate-500">
                        {item.section === 'Clinical Criteria Section' 
                          ? "Check if symptoms (fever, chills, etc) are documented" 
                          : "Check if all required fields and signatures are present"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                       <div className="flex bg-slate-100 p-1 rounded-xl">
                         {['Complete', 'Incomplete', 'N/A'].map(s => (
                           <button 
                             key={s}
                             type="button"
                             onClick={() => {
                               const updated = [...formData.formMonitoring];
                               updated[idx] = { ...item, status: s };
                               setFormData({ ...formData, formMonitoring: updated });
                             }}
                             className={cn(
                               "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                               item.status === s 
                                ? s === 'Complete' ? "bg-brand-primary text-white shadow-md shadow-teal-900/10" : s === 'Incomplete' ? "bg-rose-500 text-white shadow-md shadow-rose-900/10" : "bg-slate-400 text-white"
                                : "text-slate-400 hover:text-slate-600"
                             )}
                           >
                             {s}
                           </button>
                         ))}
                       </div>

                       {item.section === 'Physician-in-Charge (PIC)' && (
                         <div className="flex-1 min-w-[150px]">
                            <input 
                              placeholder="e.g. Dr. Charlie Mignonette Bala" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:ring-1 ring-brand-primary"
                              value={item.physicianName || ''}
                              onChange={e => {
                                const updated = [...formData.formMonitoring];
                                updated[idx] = { ...item, physicianName: e.target.value };
                                setFormData({ ...formData, formMonitoring: updated });
                              }}
                            />
                         </div>
                       )}

                       {item.section !== 'Clinical Criteria Section' && (
                         <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              item.isSigned ? "bg-teal-500" : "bg-slate-200"
                            )}>
                               <div className={cn(
                                 "absolute top-0.5 bottom-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm",
                                 item.isSigned ? "left-4.5" : "left-0.5"
                               )} />
                            </div>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={item.isSigned}
                              onChange={() => {
                                const updated = [...formData.formMonitoring];
                                updated[idx] = { ...item, isSigned: !item.isSigned };
                                setFormData({ ...formData, formMonitoring: updated });
                              }}
                            />
                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900">Signed</span>
                         </label>
                       )}
                    </div>

                    {item.status === 'Incomplete' && (
                      <div className="w-full md:w-48">
                        <input 
                          placeholder="What is missing?" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] outline-none focus:ring-1 ring-brand-primary"
                          value={item.remarks || ''}
                          onChange={e => {
                            const updated = [...formData.formMonitoring];
                            updated[idx] = { ...item, remarks: e.target.value };
                            setFormData({ ...formData, formMonitoring: updated });
                          }}
                        />
                      </div>
                    )}
                 </div>
               ))}
            </div>
          </div>

          </div>
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 shrink-0">
             <button type="submit" className="btn-primary w-full py-4 shadow-xl shadow-teal-900/10 font-bold uppercase tracking-widest text-[10px]">Record Daily Compliance Monitoring</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function HAIValidationModal({ onClose, haiCase, onSubmit, user, loading }: any) {
  const [formData, setFormData] = useState({
    status: haiCase.status,
    decisionNote: haiCase.decisionNote || '',
    validatorName: user?.name || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    // Allow corrections during validation
    correctedDeviceDays: haiCase.deviceDays || 0,
    correctedRiskLevel: haiCase.riskLevel || 'BLUE'
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-5 h-5 text-brand-primary" />
             <h3 className="text-sm sm:text-lg font-bold uppercase tracking-tight">IPCU HAI Validation Queue</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
            
            {/* Case Details Summary for Validator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400">Suspected Case</span>
                    <span className="text-sm font-bold text-slate-900">{haiCase.patientName}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">HAI Type</span>
                    <span className="text-[10px] font-black text-rose-500 uppercase">{haiCase.type}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Unit</span>
                    <span className="text-[10px] font-black text-slate-700 uppercase">{haiCase.unit}</span>
                 </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Trigger Date</span>
                    <span className="text-[10px] font-black text-slate-700">{haiCase.triggerDate}</span>
                 </div>
                 <div className="flex justify-between items-center text-rose-500">
                    <span className="text-[10px] font-bold uppercase">Device Days</span>
                    <span className="text-[10px] font-black">{haiCase.deviceDays} Days</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Input Risk</span>
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      haiCase.riskLevel === 'RED' ? "bg-rose-500" : haiCase.riskLevel === 'YELLOW' ? "bg-amber-400" : "bg-blue-500"
                    )} />
                 </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
               <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Triggered Criteria</h4>
                  <div className="flex flex-wrap gap-2">
                     {haiCase.triggeredCriteria?.map((c: string) => (
                       <span key={c} className="px-2 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-100">{c}</span>
                     ))}
                     {haiCase.triggeredLabs?.map((l: string) => (
                       <span key={l} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100">{l}</span>
                     ))}
                  </div>
               </div>
            </div>

            <div className="h-px bg-slate-200 w-full" />

            {/* Validation Inputs */}
            <div className="space-y-6">
              <div className="space-y-4">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IPCU Official Classification</label>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['CONFIRMED', 'NOT_HAI', 'NEEDS_MORE_DATA'].map(s => (
                      <label key={s} className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all",
                        formData.status === s ? "bg-brand-primary border-brand-primary text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      )}>
                         <input type="radio" value={s} checked={formData.status === s} onChange={() => setFormData({...formData, status: s as any})} className="hidden" />
                         <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight">{s.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Device Days Verification</label>
                    <input 
                      type="number" 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" 
                      value={formData.correctedDeviceDays} 
                      onChange={e => setFormData({...formData, correctedDeviceDays: parseInt(e.target.value) || 0})} 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validated Risk Level</label>
                    <select 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none"
                      value={formData.correctedRiskLevel}
                      onChange={e => setFormData({...formData, correctedRiskLevel: e.target.value as any})}
                    >
                       <option value="BLUE">Low</option>
                       <option value="YELLOW">Medium</option>
                       <option value="RED">High</option>
                    </select>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Date</label>
                   <input type="date" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Time</label>
                   <input type="time" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Note / Justification</label>
                 <textarea 
                   className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs h-24 resize-none outline-none focus:ring-1 focus:ring-brand-primary" 
                   value={formData.decisionNote} 
                   onChange={e => setFormData({...formData, decisionNote: e.target.value})}
                   placeholder="Enter detailed IPCU findings..."
                 />
              </div>
              <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IPCN / Validator Name</label>
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.validatorName} onChange={e => setFormData({...formData, validatorName: e.target.value})} placeholder="Enter name..." />
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 bg-white border-t border-slate-100 shrink-0">
            <button 
              type="submit" 
              disabled={loading}
              className={cn(
                "w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all",
                loading && "opacity-70 cursor-wait"
              )}
            >
              {loading ? 'Publishing...' : 'Publish Final Validation'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MonitoringDayValidationModal({ onClose, patient, day, dayIndex, onSubmit, user }: any) {
  const [formData, setFormData] = useState({
    status: 'Verified',
    clinicalAccuracy: 'Accurate',
    complianceAccuracy: 'Accurate',
    remarks: '',
    validatorName: user?.name || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-teal-600 border-b border-teal-700 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-5 h-5" />
             <h3 className="text-sm sm:text-lg font-bold uppercase tracking-tight">IPCU Daily Bundle Verification</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-teal-700 rounded-full transition-colors text-teal-200"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(patient.id, dayIndex, formData); }} className="flex-1 overflow-hidden flex flex-col bg-slate-50">
          <div className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
            
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-teal-600 uppercase">Monitoring Log: Day {day.dayNumber}</span>
              <h4 className="text-sm font-bold text-slate-900">{patient.patientName}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day.bundleType} • {day.date}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reported Clinical Signs</p>
                <div className="flex flex-col gap-1.5">
                   {Object.entries(day.clinicalCriteria || {}).map(([key, val]) => (
                      <div key={key} className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all",
                        val ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-100 text-slate-300"
                      )}>
                        <span className="text-[9px] font-black uppercase tracking-tight truncate">{key}</span>
                        <div className={cn("w-2 h-2 rounded-full", val ? "bg-amber-500" : "bg-slate-200")} />
                      </div>
                   ))}
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Compliance Checklist</p>
                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                   {Object.entries(day.bundleChecklist || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center p-2.5 bg-white border border-slate-100 rounded-xl">
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight max-w-[60%] leading-tight">{key}</span>
                         <span className={cn(
                           "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest",
                           val === 'Done' ? "bg-emerald-50 text-emerald-600" : val === 'Not Done' ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"
                         )}>{val}</span>
                      </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Clinical Accuracy</label>
                 <div className="flex flex-col gap-2">
                    {['Accurate', 'Inaccurate'].map(s => (
                      <button key={s} type="button" onClick={() => setFormData({...formData, clinicalAccuracy: s})} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border", formData.clinicalAccuracy === s ? "bg-teal-500 border-teal-500 text-white" : "bg-white border-slate-200 text-slate-400")}>{s}</button>
                    ))}
                 </div>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Compliance Scoring</label>
                 <div className="flex flex-col gap-2">
                    {['Accurate', 'Correction Needed'].map(s => (
                      <button key={s} type="button" onClick={() => setFormData({...formData, complianceAccuracy: s})} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border", formData.complianceAccuracy === s ? "bg-teal-500 border-teal-500 text-white" : "bg-white border-slate-200 text-slate-400")}>{s}</button>
                    ))}
                 </div>
              </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validator Remarks</label>
               <textarea className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs h-20 resize-none outline-none" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Add verification findings or discrepancies..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IPCN Name</label>
                 <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.validatorName} onChange={e => setFormData({...formData, validatorName: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Verification Date</label>
                 <input type="date" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
               </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 bg-white border-t border-slate-100 shrink-0">
            <button type="submit" className="w-full py-4 bg-teal-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Submit Verification</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DeviceEnrollmentModal({ onClose, user, showToast }: { onClose: () => void, user: UserProfile | null, showToast: any }) {
  const [form, setForm] = useState<Partial<BundleMonitoring>>({
    patientName: '',
    hospitalNo: '',
    age: '',
    sex: 'Male',
    unit: UNITS[0],
    roomWard: '',
    attendingPhysician: '',
    assignedMonitor: { name: '' },
    devices: {},
    surgery: { type: '', startDate: '', endDate: null },
    status: 'ACTIVE'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.assignedMonitor?.name) {
      alert("Assigned Monitor Name is required.");
      return;
    }

    try {
      await addDoc(collection(db, 'bundle_monitorings'), removeUndefined({
        ...form,
        monitoringDays: [],
        staffId: user.uid,
        staffName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      onClose();
      showToast('Patient enrolled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bundle_monitorings');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">Patient Enrollment & Device Registration</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enroll patient for IPCU clinical monitoring</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Demographics */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-teal-500/10 p-2 rounded-lg">
                  <ClipboardList className="w-4 h-4 text-teal-600" />
                </div>
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Demographics & Locations</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Patient Name</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Hospital #</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.hospitalNo} onChange={e => setForm({...form, hospitalNo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Age</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Sex</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.sex} onChange={e => setForm({...form, sex: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Unit</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Room/Ward</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.roomWard} onChange={e => setForm({...form, roomWard: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Attending Physician (PIC)</label>
                  <input placeholder="e.g. Dr. Charlie Mignonette Bala" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500" value={form.attendingPhysician} onChange={e => setForm({...form, attendingPhysician: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Monitoring Assignment */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Monitoring Assignment</h4>
              </div>
              <div className="space-y-4 p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div>
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Assigned Monitor</label>
                  <input required className="w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl font-bold outline-none focus:border-blue-500 text-xs" value={form.assignedMonitor?.name || ''} onChange={e => setForm({...form, assignedMonitor: { name: e.target.value }})} placeholder="Enter monitor name..." />
                </div>
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tight italic">* Required to track clinical compliance</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Device & Surgery Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Device Registration</h4>
              </div>
              <div className="space-y-6">
                {/* CLABSI */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">CLABSI / Central Line</span>
                    <input type="checkbox" className="w-4 h-4 rounded text-teal-600" checked={!!form.devices?.clabsi} onChange={e => {
                      const devices = { ...form.devices };
                      if (e.target.checked) devices.clabsi = { type: 'IJ Line', insertionDate: new Date().toISOString().split('T')[0] };
                      else delete devices.clabsi;
                      setForm({...form, devices});
                    }} />
                  </div>
                  {form.devices?.clabsi && (
                    <div className="grid grid-cols-2 gap-3">
                      <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" placeholder="Line Type/Site" value={form.devices.clabsi.type} onChange={e => setForm({...form, devices: {...form.devices!, clabsi: {...form.devices?.clabsi!, type: e.target.value}}})} />
                      <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" value={form.devices.clabsi.insertionDate} onChange={e => setForm({...form, devices: {...form.devices!, clabsi: {...form.devices?.clabsi!, insertionDate: e.target.value}}})} />
                    </div>
                  )}
                </div>

                {/* CAUTI */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">CAUTI / Foley</span>
                    <input type="checkbox" className="w-4 h-4 rounded text-teal-600" checked={!!form.devices?.cauti} onChange={e => {
                      const devices = { ...form.devices };
                      if (e.target.checked) devices.cauti = { type: 'Foley Catheter', insertionDate: new Date().toISOString().split('T')[0] };
                      else delete devices.cauti;
                      setForm({...form, devices});
                    }} />
                  </div>
                  {form.devices?.cauti && (
                    <div className="grid grid-cols-2 gap-3">
                      <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" placeholder="Catheter Type" value={form.devices.cauti.type} onChange={e => setForm({...form, devices: {...form.devices!, cauti: {...form.devices?.cauti!, type: e.target.value}}})} />
                      <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" value={form.devices.cauti.insertionDate} onChange={e => setForm({...form, devices: {...form.devices!, cauti: {...form.devices?.cauti!, insertionDate: e.target.value}}})} />
                    </div>
                  )}
                </div>

                {/* VAP */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">VAP / Ventilator</span>
                    <input type="checkbox" className="w-4 h-4 rounded text-teal-600" checked={!!form.devices?.vap} onChange={e => {
                      const devices = { ...form.devices };
                      if (e.target.checked) devices.vap = { type: 'ETT', intubationDate: new Date().toISOString().split('T')[0] };
                      else delete devices.vap;
                      setForm({...form, devices});
                    }} />
                  </div>
                  {form.devices?.vap && (
                    <div className="grid grid-cols-2 gap-3">
                      <input className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" placeholder="Ventilator Type" value={form.devices.vap.type} onChange={e => setForm({...form, devices: {...form.devices!, vap: {...form.devices?.vap!, type: e.target.value}}})} />
                      <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold" value={form.devices.vap.intubationDate} onChange={e => setForm({...form, devices: {...form.devices!, vap: {...form.devices?.vap!, intubationDate: e.target.value}}})} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(!form.age || parseInt(form.age) >= 18) && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-amber-600">
                  <Microscope className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Surgical History (SSI)</h4>
                </div>
                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Procedure / Surgery Type</label>
                    <input className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500" value={form.surgery?.type || ''} onChange={e => setForm({...form, surgery: {...form.surgery!, type: e.target.value}})} placeholder="e.g. Exploratory Laparotomy" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Surgery Start Date</label>
                      <input type="date" className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500" value={form.surgery?.startDate || ''} onChange={e => setForm({...form, surgery: {...form.surgery!, startDate: e.target.value}})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Surgery End Date</label>
                      <input type="date" className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500" value={form.surgery?.endDate || ''} onChange={e => setForm({...form, surgery: {...form.surgery!, endDate: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 shrink-0 mt-auto">
             <button type="submit" className="w-full btn-primary py-5 text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Enroll Patient and Start Monitoring</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MonitoringDayModal({ patient, onClose, user, onSave }: { patient: BundleMonitoring, onClose: () => void, user: UserProfile | null, onSave: (day: MonitoringDay) => void }) {
  const [dayNumber, setDayNumber] = useState((patient.monitoringDays?.length || 0) + 1);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMissed, setIsMissed] = useState(false);
  const [missedReason, setMissedReason] = useState('');
  const [monitorName, setMonitorName] = useState(user?.name || '');
  
  const [isTriggeringHAI, setIsTriggeringHAI] = useState(false);
  const [triggerReasons, setTriggerReasons] = useState<string[]>([]);
  const [triggerOther, setTriggerOther] = useState('');

  const TRIGGER_OPTIONS = [
    'Clinical criteria met',
    'Fever + device',
    'Purulent discharge',
    'Suspicion of infection',
    'Abnormal labs',
    'Other'
  ];

  const [selectedBundleType, setSelectedBundleType] = useState<'CLABSI' | 'CAUTI' | 'VAP' | 'SSI'>(
    patient.devices.clabsi ? 'CLABSI' : patient.devices.vap ? 'VAP' : patient.devices.cauti ? 'CAUTI' : 'SSI'
  );
  const [selectedSubtype, setSelectedSubtype] = useState<string>(
    patient.devices.clabsi ? 'Maintenance' : patient.devices.ssi ? 'Post-op' : 'Maintenance'
  );
  
  const [bundleChecklist, setBundleChecklist] = useState<Record<string, 'Done' | 'Not Done' | 'N/A'>>({});
  const [clinicalCriteria, setClinicalCriteria] = useState<Record<string, any>>({});
  
  const isPedia = (patient.age.toLowerCase().includes('mo') || parseInt(patient.age) < 18);

  // Clear checklist when switching bundles
  useEffect(() => {
    setBundleChecklist({});
    if (selectedBundleType === 'CLABSI') {
      if (!['Insertion', 'Maintenance'].includes(selectedSubtype)) setSelectedSubtype('Maintenance');
    } else if (selectedBundleType === 'SSI') {
      if (!['Pre-op', 'Intra-op', 'Post-op'].includes(selectedSubtype)) setSelectedSubtype('Post-op');
    } else {
      setSelectedSubtype('Maintenance');
    }
  }, [selectedBundleType, selectedSubtype === 'Maintenance' /* only handle type changes if needed, but easier to just check types */]);

  // Robust subtype sync
  useEffect(() => {
    if (selectedBundleType === 'CLABSI' && !['Insertion', 'Maintenance'].includes(selectedSubtype)) {
      setSelectedSubtype('Maintenance');
    } else if (selectedBundleType === 'SSI' && !['Pre-op', 'Intra-op', 'Post-op'].includes(selectedSubtype)) {
      setSelectedSubtype('Post-op');
    } else if (['CAUTI', 'VAP'].includes(selectedBundleType)) {
      setSelectedSubtype('Maintenance');
    }
  }, [selectedBundleType]);

  const getBundleItems = () => {
    if (selectedBundleType === 'CLABSI') {
      if (selectedSubtype === 'Insertion') return CLABSI_DETAILED_BUNDLES.INSERTION;
      return isPedia ? CLABSI_DETAILED_BUNDLES.MAINTENANCE_PEDIA : CLABSI_DETAILED_BUNDLES.MAINTENANCE_ADULT;
    }
    if (selectedBundleType === 'CAUTI') return isPedia ? CAUTI_BUNDLES.PEDIA : CAUTI_BUNDLES.ADULT;
    if (selectedBundleType === 'VAP') return isPedia ? VAP_BUNDLES.PEDIA : VAP_BUNDLES.ADULT;
    if (selectedBundleType === 'SSI' && !isPedia) {
      if (selectedSubtype === 'Pre-op') return (SSI_BUNDLES_CONST as any).PREOP;
      if (selectedSubtype === 'Intra-op') return (SSI_BUNDLES_CONST as any).INTRAOP;
      return (SSI_BUNDLES_CONST as any).POSTOP;
    }
    return [];
  };

  const getClinicalItems = () => {
    if (selectedBundleType === 'SSI' && !isPedia) return CLINICAL_CRITERIA_DETAILED.SSI;
    const key = `${selectedBundleType}_${isPedia ? 'PEDIA' : 'ADULT'}` as keyof typeof CLINICAL_CRITERIA_DETAILED;
    return CLINICAL_CRITERIA_DETAILED[key] || [];
  };

  const bundleItems = getBundleItems();
  const clinicalItems = getClinicalItems();

  const calculateComplianceScores = () => {
    if (isMissed) return { bundle: 0, clinical: 0, overall: 0 };

    const applicableItems = bundleItems.filter(item => bundleChecklist[item] && bundleChecklist[item] !== 'N/A');
    const doneItems = applicableItems.filter(item => bundleChecklist[item] === 'Done');
    const bundleScore = applicableItems.length > 0 ? (doneItems.length / applicableItems.length) * 100 : 100;

    return {
      bundle: parseFloat(bundleScore.toFixed(2)),
      clinical: 100, // Clinical findings don't affect compliance score per prompt
      overall: parseFloat(bundleScore.toFixed(2))
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!monitorName.trim()) {
      alert("Monitor of the Day is required.");
      return;
    }

    if (isMissed && !missedReason) {
      alert("Please provide a reason for the missed day.");
      return;
    }

    if (isTriggeringHAI && triggerReasons.length === 0) {
      alert("Please select at least one reason for the HAI trigger.");
      return;
    }

    const compliance = calculateComplianceScores();

    const finalReason = triggerReasons.map(r => r === 'Other' ? `Other: ${triggerOther}` : r).join(', ');

    const day: MonitoringDay = {
      date,
      dayNumber,
      bundleType: selectedBundleType,
      bundleSubtype: selectedSubtype,
      isPedia,
      bundleChecklist,
      clinicalCriteria,
      complianceScores: compliance as any,
      missedDay: isMissed,
      missedReason: isMissed ? missedReason : null,
      monitor: { name: monitorName },
      staffId: user.uid,
      staffName: user.name,
      possibleHAI: isTriggeringHAI,
      triggerReason: isTriggeringHAI ? finalReason : undefined,
      triggeredBy: isTriggeringHAI ? user.name : undefined,
      triggeredDateTime: isTriggeringHAI ? new Date().toISOString() : undefined
    };

    onSave(day);
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-6xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Calendar className="w-6 h-6 text-teal-400" />
            </div>
            <div>
               <h3 className="text-xl font-black uppercase tracking-tight">Add Monitoring Day {dayNumber}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{patient.patientName} • Managed by {patient.assignedMonitor?.name || 'N/A'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-10 custom-scrollbar bg-slate-50/50">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                   <label className="text-[10px] font-black text-teal-600 uppercase tracking-widest block mb-2">Monitor of the Day (Required)</label>
                   <input 
                     required 
                     placeholder="Enter Link Nurse Name..."
                     className="w-full px-4 py-3 bg-slate-50 border border-teal-100 rounded-xl text-xs font-bold outline-none focus:border-teal-500 focus:bg-white transition-all" 
                     value={monitorName} 
                     onChange={e => setMonitorName(e.target.value)} 
                   />
                </div>
                <div className="w-full md:w-48">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Monitoring Date</label>
                   <input type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-teal-500" value={date} onChange={e => setDate(e.target.value)} />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
             <div className="md:col-span-1 space-y-6">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Active Bundle</label>
                  <div className="flex flex-col gap-2">
                    {(isPedia ? ['CLABSI', 'CAUTI', 'VAP'] : ['CLABSI', 'CAUTI', 'VAP', 'SSI']).map(b => (
                      <button 
                        key={b} 
                        type="button"
                        onClick={() => setSelectedBundleType(b as any)}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest text-left border transition-all rounded-xl",
                          selectedBundleType === b ? "bg-teal-600 border-teal-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {b} Bundle
                      </button>
                    ))}
                  </div>
               </div>

               {selectedBundleType === 'CLABSI' && (
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">CLABSI Phase</label>
                    <div className="flex gap-2">
                      {(isPedia ? ['Maintenance'] : ['Insertion', 'Maintenance']).map(s => (
                        <button key={s} type="button" onClick={() => setSelectedSubtype(s)} className={cn("flex-1 py-2 text-[9px] font-black uppercase rounded-xl border transition-all", selectedSubtype === s ? "bg-teal-500 border-teal-500 text-white" : "bg-white border-slate-200 text-slate-400")}>{s}</button>
                      ))}
                    </div>
                 </div>
               )}

               {selectedBundleType === 'SSI' && (
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">SSI Phase</label>
                    <div className="flex flex-col gap-2">
                      {['Pre-op', 'Intra-op', 'Post-op'].map(s => (
                        <button key={s} type="button" onClick={() => setSelectedSubtype(s)} className={cn("px-3 py-2 text-[9px] font-black uppercase rounded-xl border transition-all text-left", selectedSubtype === s ? "bg-teal-500 border-teal-500 text-white" : "bg-white border-slate-200 text-slate-400")}>{s}</button>
                      ))}
                    </div>
                 </div>
               )}

               <div className={cn("p-6 rounded-2xl border transition-all", isMissed ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200")}>
                  <label className="flex items-center gap-4 cursor-pointer">
                     <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-rose-500" checked={isMissed} onChange={e => setIsMissed(e.target.checked)} />
                     <span className={cn("text-[10px] font-black uppercase tracking-widest", isMissed ? "text-rose-600" : "text-slate-500")}>Mark as Missed Day</span>
                  </label>
                  {isMissed && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-bold text-rose-400 uppercase leading-tight italic">Missed days count as 0% compliance</p>
                      <textarea 
                        className="w-full p-4 text-xs border border-rose-100 bg-white rounded-xl resize-none h-24 outline-none focus:border-rose-400" 
                        placeholder="Reason for missing this day..."
                        value={missedReason}
                        required={isMissed}
                        onChange={e => setMissedReason(e.target.value)}
                      />
                    </div>
                  )}
               </div>
             </div>

             <div className="md:col-span-3 space-y-10">
                {!isMissed ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Maintenance Bundle Checklist</h4>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {bundleItems.map(item => (
                          <div key={item} className="flex flex-col bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                             <span className="text-[10px] font-bold text-slate-700 leading-tight mb-3">{item}</span>
                             <div className="flex bg-slate-50 p-1 rounded-xl">
                                {(['Done', 'Not Done', 'N/A'] as const).map(status => (
                                  <button 
                                    key={status}
                                    type="button"
                                    onClick={() => setBundleChecklist({...bundleChecklist, [item]: status})}
                                    className={cn(
                                      "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                      bundleChecklist[item] === status 
                                        ? status === 'Done' ? "bg-emerald-500 text-white shadow-sm" : status === 'Not Done' ? "bg-rose-500 text-white shadow-sm" : "bg-slate-400 text-white"
                                        : "text-slate-400 hover:text-slate-500"
                                    )}
                                  >
                                    {status}
                                  </button>
                                ))}
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Clinical Criteria Detection</h4>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {clinicalItems.map(item => (
                          <div key={item} className="flex flex-col bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                             <span className="text-[9px] font-bold text-slate-700 leading-tight mb-2 min-h-[2.5em]">{item}</span>
                             <div className="flex gap-2">
                                <button type="button" onClick={() => setClinicalCriteria({...clinicalCriteria, [item]: true})} className={cn("flex-1 py-1 text-[8px] font-black rounded-lg transition-all uppercase", clinicalCriteria[item] === true ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400")}>Present</button>
                                <button type="button" onClick={() => setClinicalCriteria({...clinicalCriteria, [item]: false})} className={cn("flex-1 py-1 text-[8px] font-black rounded-lg transition-all uppercase", clinicalCriteria[item] === false ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400")}>Absent</button>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border-2 border-dashed border-rose-100 text-center space-y-4">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-rose-500" />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">Missed Day Recorded</h5>
                      <p className="text-[10px] text-slate-500 font-medium">Compliance: 0% | Reason Required Below</p>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {!isTriggeringHAI && (
             <div className="pt-6 shrink-0 mt-auto flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsTriggeringHAI(true)}
                  className="flex-1 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"
                >
                  Flag as Possible HAI
                </button>
                <button type="submit" className={cn("flex-[2] py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all active:scale-[0.98]", isMissed ? "bg-rose-600 text-white shadow-rose-900/20" : "bg-slate-900 text-white shadow-slate-900/20")}>
                  {isMissed ? 'Confirm Missed Day Protocol' : 'Save Clinical Monitoring Data'}
                </button>
             </div>
          )}

          {isTriggeringHAI && (
            <div className="pt-6 shrink-0 mt-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
               <div className="p-6 bg-rose-50 rounded-3xl border border-rose-200">
                  <div className="flex items-center gap-3 mb-6">
                     <AlertTriangle className="w-5 h-5 text-rose-500" />
                     <h4 className="text-sm font-black text-rose-600 uppercase tracking-tight">Reason for Possible HAI Trigger</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                     {TRIGGER_OPTIONS.map(opt => (
                       <label key={opt} className={cn(
                         "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer",
                         triggerReasons.includes(opt) ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-900/20" : "bg-white border-rose-100 text-rose-600 hover:border-rose-200"
                       )}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={triggerReasons.includes(opt)}
                            onChange={e => {
                              if (e.target.checked) setTriggerReasons([...triggerReasons, opt]);
                              else setTriggerReasons(triggerReasons.filter(r => r !== opt));
                            }}
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest">{opt}</span>
                       </label>
                     ))}
                  </div>
                  {triggerReasons.includes('Other') && (
                    <div className="mb-6">
                       <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-2">Specify Other Reason</label>
                       <textarea 
                         className="w-full p-4 border border-rose-200 rounded-2xl text-xs bg-white outline-none focus:ring-2 ring-rose-500 transition-all h-20 resize-none"
                         placeholder="Enter details..."
                         value={triggerOther}
                         onChange={e => setTriggerOther(e.target.value)}
                       />
                    </div>
                  )}
                  <div className="flex gap-4">
                     <button 
                       type="button" 
                       onClick={() => { setIsTriggeringHAI(false); setTriggerReasons([]); }}
                       className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-rose-200 text-rose-400 rounded-2xl hover:bg-white transition-all"
                     >
                       Cancel Flag
                     </button>
                     <button 
                       type="submit" 
                       className="flex-[2] py-4 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-rose-900/20 active:scale-95 transition-all"
                     >
                       Record Flag & Save Data
                     </button>
                  </div>
               </div>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}

function RateTile({ label, rate, unit, baseline }: { label: string, rate: number, unit: string, baseline: number }) {
  const isRising = rate > baseline;
  return (
    <div className={cn(
      "bento-card p-6 flex flex-col justify-between",
      isRising ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"
    )}>
       <div>
         <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</h4>
         <div className={cn(
           "text-3xl font-black",
           isRising ? "text-amber-600" : "text-emerald-600"
         )}>{rate}</div>
       </div>
       <div>
          <div className="text-[8px] font-bold uppercase tracking-tight text-slate-400 mb-1">{unit}</div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Baseline: {baseline}</div>
       </div>
    </div>
  );
}
