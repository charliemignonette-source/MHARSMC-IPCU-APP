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
import { UserProfile, HAICase, BOCLog, HAIType, IPCUAction, BundleMonitoring, Population, BundleDailyCheck } from '../types';
import { UNITS, DEVICES, BUNDLE_ELEMENTS, IPCU_CORRECTIVE_ACTIONS, CLABSI_DETAILED_BUNDLES } from '../constants';
import { cn, formatDate } from '../lib/utils';

export default function HAI({ user }: { user: UserProfile | null }) {
  const isIPCU = user?.role === 'ADMIN' || user?.role === 'IPCN';
  const [activeView, setActiveView] = useState<'surveillance' | 'bundles'>(isIPCU ? 'surveillance' : 'bundles');
  
  useEffect(() => {
    if (!isIPCU && activeView === 'surveillance') {
      // Logic for non-IPCU users if needed, though they usually use bundles
    }
  }, [isIPCU, activeView]);

  const [isAddingCase, setIsAddingCase] = useState(false);
  const [isAddingBundle, setIsAddingBundle] = useState(false);
  
  const [cases, setCases] = useState<HAICase[]>([]);
  const [bundleLogs, setBundleLogs] = useState<BOCLog[]>([]);
  const [monitorings, setMonitorings] = useState<BundleMonitoring[]>([]);
  const [denominators, setDenominators] = useState<any[]>([]);
  const [isManagingDenominators, setIsManagingDenominators] = useState(false);
  const [isEnrollingDevice, setIsEnrollingDevice] = useState(false);
  const [selectedMonitoring, setSelectedMonitoring] = useState<BundleMonitoring | null>(null);
  const [isViewingDailyChecks, setIsViewingDailyChecks] = useState(false);

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
      await addDoc(collection(db, 'hai_cases'), {
        ...caseForm,
        auditorId: user.uid,
        auditorEmail: user.email,
        auditorName: user.name, // adding name
        isValidated: false,
        createdAt: serverTimestamp()
      });
      setIsAddingCase(false);
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
        compliantElements += Object.values(bundle.elements).filter(Boolean).length;
        bundle.isCompliant = Object.values(bundle.elements).filter(Boolean).length === requiredElements.length;
      }
    });

    const finalPct = totalElements > 0 ? (compliantElements / totalElements) * 100 : 0;

    try {
      await addDoc(collection(db, 'boc_logs'), {
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
      });
      setIsAddingBundle(false);
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

  const handleValidationSubmit = async (validationData: any) => {
    if (!selectedCase?.id || !user) return;
    try {
      await updateDoc(doc(db, 'hai_cases', selectedCase.id), {
        ...validationData,
        isValidated: true,
        validatedBy: user.uid,
        validatorName: validationData.validatorName || user.name,
        validatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsValidating(false);
      setSelectedCase(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'hai_cases');
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLog?.id) return;
    try {
      await updateDoc(doc(db, 'boc_logs', selectedLog.id), {
        isValidated: true,
        verification: {
          ...verificationForm,
          validatorId: user.uid,
          validatorName: verificationForm?.validatorName || user.name
        }
      });
      setIsVerifying(false);
      setSelectedLog(null);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row shadow-sm sm:shadow-none items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">Infection Surveillance</h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">Active HAI detection and therapeutic bundle monitoring</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
           {isIPCU && (
             <button 
               onClick={() => setIsManagingDenominators(true)}
               className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
             >
               Set Monthly Data
             </button>
           )}
           {activeView === 'surveillance' ? (
             <button 
              onClick={() => setIsAddingCase(true)}
              className="flex-1 sm:flex-none btn-primary px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-center">Report Case</span>
            </button>
           ) : (
             <div className="flex gap-2 w-full sm:w-auto">
               <button 
                 onClick={() => setIsEnrollingDevice(true)}
                 className="flex-1 sm:flex-none btn-primary px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
               >
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-center text-nowrap">Enroll Device</span>
               </button>
               <button 
                onClick={() => setIsAddingBundle(true)}
                className="flex-1 sm:flex-none bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-center text-nowrap">Quick Log</span>
              </button>
             </div>
           )}
        </div>
      </div>

      {/* Modern Switcher */}
      <div className="flex bg-slate-100 p-1 w-full sm:w-fit rounded-xl sm:rounded-2xl mb-8 overflow-x-auto no-scrollbar">
        {(['surveillance', 'bundles'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "flex-1 sm:flex-none px-4 sm:px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all whitespace-nowrap",
              activeView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-500"
            )}
          >
            {view === 'surveillance' ? 'Active Surveillance' : 'Bundles of Care'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'surveillance' ? (
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

            {/* Possible HAI Cases Today */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Possible HAI Cases Today (Triggered)</h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="bento-card bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0 min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient / Unit</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Device / Proc</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Triggered Criteria</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">HAI Type</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Risk</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cases.filter(c => c.status === 'PENDING').map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{c.patientName}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{c.unit}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-xs font-medium text-slate-600">{c.deviceType || c.procedureType}</span>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1">
                                {c.triggeredCriteria?.map(cr => <span key={cr} className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold uppercase rounded">{cr}</span>)}
                                {c.triggeredLabs?.map(l => <span key={l} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 [font-size:8px] font-black uppercase rounded">{l}</span>)}
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-xs font-black text-rose-500 uppercase italic">{c.type}</span>
                          </td>
                          <td className="px-6 py-4">
                             <span className={cn(
                               "w-3 h-3 rounded-full block shadow-sm",
                               c.riskLevel === 'RED' ? "bg-rose-500" : c.riskLevel === 'YELLOW' ? "bg-amber-400" : c.riskLevel === 'BLUE' ? "bg-blue-500" : "bg-slate-900"
                             )} />
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
                               {isIPCU ? (
                                 <button 
                                   onClick={() => { setSelectedCase(c); setIsValidating(true); }}
                                   className="text-[9px] font-black uppercase tracking-widest text-brand-primary p-2 hover:bg-teal-50 rounded-lg transition-colors border border-transparent hover:border-teal-100"
                                 >
                                   Validate
                                 </button>
                               ) : (
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                                   {c.status}
                                 </span>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Root Cause Flags */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">HAI Risk Flags & Root Cause Analysis</h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {cases.filter(c => c.status === 'PENDING').slice(0, 3).map(c => (
                   <div key={c.id} className="bento-card p-6 bg-white border-l-4 border-l-rose-500">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <h4 className="text-xs font-black text-slate-900 uppercase">{c.patientName}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{c.unit} • {c.type}</p>
                         </div>
                         <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500">
                            <AlertTriangle className="w-4 h-4" />
                         </div>
                      </div>
                      <div className="space-y-3">
                         <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm" />
                            <span className="text-slate-600">Bundle Compliance: {c.bundleCompliance || 0}%</span>
                         </div>
                         <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" />
                            <span className="text-slate-600">Device Days: {c.deviceDays} Days</span>
                         </div>
                      </div>
                   </div>
                 ))}
                 {cases.filter(c => c.status === 'PENDING').length === 0 && (
                   <div className="col-span-full py-12 text-center bento-card border-dashed">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active flags detected</p>
                   </div>
                 )}
              </div>
            </div>

            {/* Confirmed HAI Events (MTD) */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Confirmed HAI Events (Month-to-Date)</h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="bento-card bg-white overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Patient</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">HAI Type</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Validator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cases.filter(c => c.status === 'CONFIRMED').map(c => (
                      <tr key={c.id}>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">{c.patientName}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">{c.unit}</td>
                        <td className="px-6 py-4">
                           <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase tracking-widest">{c.type}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-600">{c.triggerDate}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">{c.validatorName || 'System'}</td>
                        {isIPCU && (
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={(e) => handleDelete(e, 'hai_cases', c.id)}
                              className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Confirmed Case"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="bundles"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
             {/* New Monitoring Dashboard */}
             <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Active Device Monitorings</h3>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {monitorings.filter(m => m.status === 'ACTIVE').map(m => (
                     <div 
                       key={m.id} 
                       onClick={() => { setSelectedMonitoring(m); setIsViewingDailyChecks(true); }}
                       className="bento-card p-6 bg-white hover:border-teal-500/30 transition-all cursor-pointer group border-b-4 border-b-teal-500 shadow-teal-900/5 shadow-xl relative overflow-hidden"
                     >
                       <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50/50 rounded-full translate-x-12 -translate-y-12 transition-transform group-hover:scale-125" />
                       
                       <div className="relative">
                         <div className="flex justify-between items-start mb-4">
                            <span className={cn(
                              "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                              m.population === 'Adult' ? "bg-slate-100 text-slate-600" : "bg-purple-50 text-purple-600"
                            )}>{m.population}</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.unit}</span>
                         </div>
                         
                         <h4 className="text-sm font-black text-slate-900 mb-1 group-hover:text-teal-700 transition-colors uppercase">{m.patientName}</h4>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-4">Hosp #: {m.hospNo} • AGE: {m.age}</p>
                         
                         <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-teal-50 rounded-xl text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                               <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                               <p className="text-[9px] font-black text-slate-400 uppercase leading-none">Device Type</p>
                               <p className="text-xs font-black text-slate-900 uppercase">{m.deviceType} <span className="text-[10px] text-slate-400 font-bold ml-1">{m.deviceDetail}</span></p>
                            </div>
                         </div>

                         <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex flex-col">
                               <span className="text-[8px] font-bold text-slate-400 uppercase leading-tight">Inserted On</span>
                               <span className="text-[11px] font-black text-slate-700 uppercase">{m.insertionDate}</span>
                            </div>
                            <button 
                              className="px-4 py-1.5 bg-teal-50 text-teal-600 text-[9px] font-black uppercase tracking-widest rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors"
                            >
                              Add Daily Check
                            </button>
                         </div>
                       </div>
                     </div>
                   ))}
                   {monitorings.filter(m => m.status === 'ACTIVE').length === 0 && (
                     <div className="col-span-full py-20 text-center bento-card border-dashed">
                        <Activity className="w-8 h-8 text-slate-200 mx-auto mb-4" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active device monitorings found</p>
                        <button 
                          onClick={() => setIsEnrollingDevice(true)}
                          className="mt-4 text-[9px] font-black text-teal-600 uppercase tracking-widest hover:underline"
                        >
                          Enroll First Patient
                        </button>
                     </div>
                   )}
                </div>
             </div>

             <div className="space-y-4 pt-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Recent One-off Bundle Logs</h3>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bundleLogs.map(log => (
                    <div key={log.id} className="bento-card p-6 bg-white hover:border-teal-500/20 transition-all cursor-pointer group relative flex flex-col">
                      {/* ... existing bundleLog item contents ... */}
                 <div className="flex items-center justify-between mb-6">
                    <div className={cn(
                       "p-2 rounded-xl transition-colors",
                       log.compliancePercentage === 100 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      {log.compliancePercentage === 100 ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.isValidated && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.unit}</span>
                    </div>
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 mb-1">{log.patientName}</h4>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2">Hosp #: {log.hospNo} • AGE: {log.age}</p>
                 
                 <div className="flex flex-wrap gap-1 mb-4">
                    {log.devicesPresent?.map(dev => (
                      <span key={dev} className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">
                        {DEVICES.find(d => d.id === dev)?.label || dev}
                      </span>
                    ))}
                 </div>

                 <div className="mb-4 space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Logged by: {log.staffName || 'Staff'}</p>
                    {log.isValidated && (
                       <div className="space-y-0.5">
                         <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Verified by: {log.verification?.validatorName || 'IPCU'}
                         </p>
                         <p className="text-[8px] font-medium text-slate-400 uppercase">
                           {formatDate(log.verification?.date || log.timestamp)}
                         </p>
                       </div>
                    )}
                 </div>

                 <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Compliance</span>
                      <span className={cn(
                        "text-lg font-black tracking-tight",
                        log.compliancePercentage === 100 ? "text-emerald-500" : log.compliancePercentage > 70 ? "text-amber-500" : "text-rose-500"
                      )}>
                        {Math.round(log.compliancePercentage)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isIPCU && (
                        <button 
                          onClick={(e) => handleDelete(e, 'boc_logs', log.id)}
                          className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Bundle Log"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {(user?.role === 'IPCN' || user?.role === 'ADMIN') && !log.isValidated && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                            setVerificationForm({
                              ...verificationForm!,
                              independentAssessment: log.devicesPresent.reduce((acc, dev) => ({
                                ...acc,
                                [dev]: { isCompliant: log.bundles[dev]?.isCompliant || false, notes: '' }
                              }), {})
                            });
                            setIsVerifying(true);
                          }}
                          className="px-3 py-1.5 bg-teal-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-2"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Verify
                        </button>
                      )}
                      {log.isValidated && (
                        <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                 </div>
               </div>
             ))}
             {bundleLogs.length === 0 && <div className="col-span-full py-20 text-center bento-card border-dashed"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No bundle surveillance logs recorded today</p></div>}
                </div>
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
          />
        )}
        {isEnrollingDevice && (
          <DeviceEnrollmentModal 
            onClose={() => setIsEnrollingDevice(false)}
            user={user}
          />
        )}
        {isViewingDailyChecks && selectedMonitoring && (
          <DailyCheckModal 
            onClose={() => { setIsViewingDailyChecks(false); setSelectedMonitoring(null); }}
            monitoring={selectedMonitoring}
            user={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DenominatorsModal({ onClose, denominators, user }: any) {
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
        await addDoc(collection(db, 'hai_denominators'), {
          ...form,
          month: currentMonthStr,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
      } else {
        await updateDoc(doc(db, 'hai_denominators', snap.docs[0].id), {
          ...form,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
      }
      onClose();
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
        compliant += Object.values(bundle.elements).filter(Boolean).length;
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
                              placeholder="Doctor's Name" 
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

function HAIValidationModal({ onClose, haiCase, onSubmit, user }: any) {
  const [formData, setFormData] = useState({
    status: haiCase.status,
    decisionNote: haiCase.decisionNote || '',
    validatorName: user?.name || '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-5 h-5 text-brand-primary" />
             <h3 className="text-sm sm:text-lg font-bold uppercase tracking-tight">IPCU HAI Validation Queue</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Suspected Case</div>
              <div className="text-xs font-bold text-slate-900">{haiCase.patientName} ({haiCase.type})</div>
           </div>
           <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IPCU Decision</label>
              <div className="grid grid-cols-2 gap-2">
                 {['CONFIRMED', 'NOT_HAI', 'NEEDS_MORE_DATA'].map(s => (
                   <label key={s} className={cn(
                     "flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all",
                     formData.status === s ? "bg-brand-primary border-brand-primary text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                   )}>
                      <input type="radio" value={s} checked={formData.status === s} onChange={() => setFormData({...formData, status: s as any})} className="hidden" />
                      <span className="text-[10px] font-black uppercase tracking-tight">{s.replace('_', ' ')}</span>
                   </label>
                 ))}
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Date</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validation Time</label>
                <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-xs font-bold outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Decision Notes</label>
              <textarea 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs h-24 resize-none outline-none focus:ring-1 focus:ring-brand-primary" 
                value={formData.decisionNote} 
                onChange={e => setFormData({...formData, decisionNote: e.target.value})}
                placeholder="Brief justification for classification..."
              />
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validator Name</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.validatorName} onChange={e => setFormData({...formData, validatorName: e.target.value})} placeholder="Enter name of IPCN/IPCO..." />
           </div>
          </div>
          <div className="p-4 sm:p-6 bg-white border-t border-slate-100 shrink-0">
            <button type="submit" className="w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Publish Validation Decision</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}


  );
}

function DeviceEnrollmentModal({ onClose, user }: { onClose: () => void, user: UserProfile | null }) {
  const [form, setForm] = useState<Partial<BundleMonitoring>>({
    population: 'Adult',
    patientName: '',
    hospNo: '',
    age: '',
    gender: 'Male',
    unit: UNITS[0],
    deviceType: 'CLABSI',
    deviceDetail: 'IJ Line',
    insertionDate: new Date().toISOString().split('T')[0],
    insertionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    status: 'ACTIVE',
    insertionBundle: {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      inserterName: '',
      inserterType: 'Physician',
      elements: {},
      isCompliant: false
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const insertionElements = CLABSI_DETAILED_BUNDLES.INSERTION;
      const elementsMap = form.insertionBundle?.elements || {};
      const compliantCount = insertionElements.filter(el => elementsMap[el]).length;
      const isCompliant = compliantCount === insertionElements.length;

      await addDoc(collection(db, 'bundle_monitorings'), {
        ...form,
        insertionBundle: {
          ...form.insertionBundle,
          isCompliant,
        },
        dailyChecks: {},
        staffId: user.uid,
        staffName: user.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bundle_monitorings');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-white uppercase tracking-tight">Enroll Device Monitoring</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Clinical Monitoring Record</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-100 pb-2">Patient Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Patient Name</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.patientName} onChange={e => setForm({...form, patientName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Hosp #</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.hospNo} onChange={e => setForm({...form, hospNo: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Population</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.population} onChange={e => setForm({...form, population: e.target.value as Population})}>
                    <option value="Adult">Adult</option>
                    <option value="Pediatric">Pediatric</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Age</label>
                  <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.age} onChange={e => setForm({...form, age: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Gender</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as any})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest border-b border-teal-100 pb-2">Device Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Device Type</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value as any})}>
                    <option value="CLABSI">CLABSI (Central Line)</option>
                    <option value="VAP">VAP (Ventilator)</option>
                    <option value="CAUTI">CAUTI (Foley)</option>
                    <option value="SSI">SSI (Surgical Site)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Detail (Site/Type)</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.deviceDetail} onChange={e => setForm({...form, deviceDetail: e.target.value})} placeholder="e.g. IJ Line" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Unit</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Insertion Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={form.insertionDate} onChange={e => setForm({...form, insertionDate: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          {form.deviceType === 'CLABSI' && (
            <div className="space-y-6 pt-4">
              <div className="p-6 bg-teal-50 rounded-2xl border border-teal-100">
                <h4 className="text-xs font-black text-teal-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Central Line Insertion Bundle (BOC-027)
                </h4>
                <div className="grid grid-cols-1 gap-3">
                   {CLABSI_DETAILED_BUNDLES.INSERTION.map(el => (
                     <label key={el} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-teal-100 hover:bg-teal-50/50 cursor-pointer transition-colors">
                       <input 
                         type="checkbox" 
                         className="mt-1 w-4 h-4 text-teal-600 rounded bg-slate-100 border-slate-300 focus:ring-teal-500"
                         checked={form.insertionBundle?.elements[el] || false}
                         onChange={e => {
                           const newElements = { ...form.insertionBundle?.elements, [el]: e.target.checked };
                           setForm({...form, insertionBundle: { ...form.insertionBundle!, elements: newElements }});
                         }}
                       />
                       <span className="text-[10px] font-bold text-slate-700 leading-tight">{el}</span>
                     </label>
                   ))}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                   <div>
                     <label className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-1 block">Performed By (Inserter Name)</label>
                     <input className="w-full px-4 py-2 bg-white border border-teal-100 rounded-lg text-xs font-bold" value={form.insertionBundle?.inserterName} onChange={e => setForm({...form, insertionBundle: {...form.insertionBundle!, inserterName: e.target.value}})} />
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-1 block">Inserter Type</label>
                      <select className="w-full px-4 py-2 bg-white border border-teal-100 rounded-lg text-xs font-bold" value={form.insertionBundle?.inserterType} onChange={e => setForm({...form, insertionBundle: {...form.insertionBundle!, inserterType: e.target.value as any}})}>
                        <option value="Physician">Physician</option>
                        <option value="Nurse">Nurse</option>
                      </select>
                   </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 shrink-0 mt-auto">
             <button type="submit" className="w-full btn-primary py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-900/10">Start Clinical Monitoring</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DailyCheckModal({ onClose, monitoring, user }: { onClose: () => void, monitoring: BundleMonitoring, user: UserProfile | null }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<'AM' | 'PM' | 'Night'>('AM');
  const [isAddingCheck, setIsAddingCheck] = useState(false);
  
  const [checkForm, setCheckForm] = useState<Partial<DailyShiftCheck>>({
    done: true,
    elements: {},
    clinicalCriteria: {
      fever: false,
      chills: false,
      hypotension: false,
      isSigned: true
    }
  });

  const dailyCheck = monitoring.dailyChecks?.[selectedDate];
  const shiftCheck = dailyCheck?.shifts?.[selectedShift];

  const handleAddCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const updatedDailyChecks = { ...monitoring.dailyChecks };
      if (!updatedDailyChecks[selectedDate]) {
        updatedDailyChecks[selectedDate] = {
          date: selectedDate,
          shifts: {
            AM: { done: false, elements: {} },
            PM: { done: false, elements: {} },
            Night: { done: false, elements: {} }
          }
        };
      }
      
      updatedDailyChecks[selectedDate].shifts[selectedShift] = {
        ...checkForm,
        done: true,
        staffId: user.uid,
        staffName: user.name,
        updatedAt: serverTimestamp()
      } as DailyShiftCheck;

      await updateDoc(doc(db, 'bundle_monitorings', monitoring.id!), {
        dailyChecks: updatedDailyChecks,
        updatedAt: serverTimestamp()
      });
      setIsAddingCheck(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bundle_monitorings');
    }
  };

  const handleMissDay = async () => {
    const reason = window.prompt("Reason for missing this day?");
    if (!reason || !user) return;
    try {
      const updatedDailyChecks = { ...monitoring.dailyChecks };
      updatedDailyChecks[selectedDate] = {
        date: selectedDate,
        shifts: {
          AM: { done: false, elements: {} },
          PM: { done: false, elements: {} },
          Night: { done: false, elements: {} }
        },
        missed: true,
        missedReason: reason
      };

      await updateDoc(doc(db, 'bundle_monitorings', monitoring.id!), {
        dailyChecks: updatedDailyChecks,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, 'bundle_monitorings');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-5xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className="p-2 bg-teal-500/20 rounded-xl">
                <Calendar className="w-6 h-6 text-teal-400" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{monitoring.patientName}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{monitoring.deviceType} Monitoring Log</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleMissDay}
              className="text-[10px] font-black bg-rose-500/20 text-rose-400 px-4 py-2 rounded-xl hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest"
            >
              Mark Day as Missed
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 custom-scrollbar bg-slate-50/50">
          {dailyCheck?.missed && (
             <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4">
                <XCircle className="w-5 h-5 text-rose-500" />
                <div>
                   <p className="text-xs font-black text-rose-600 uppercase tracking-tight">Day Marked as Missed</p>
                   <p className="text-[10px] font-bold text-rose-400">Reason: {dailyCheck.missedReason}</p>
                </div>
             </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex gap-4">
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Date</label>
                  <input type="date" className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
               </div>
               <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Shift</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {(['AM', 'PM', 'Night'] as const).map(s => (
                      <button key={s} onClick={() => setSelectedShift(s)} className={cn("px-4 py-1.5 text-[10px] font-black rounded-lg transition-all", selectedShift === s ? "bg-white shadow-sm text-teal-600" : "text-slate-400 hover:text-slate-500")}>{s}</button>
                    ))}
                  </div>
               </div>
             </div>

             {!shiftCheck?.done && !dailyCheck?.missed && (
               <button onClick={() => setIsAddingCheck(true)} className="px-6 py-2.5 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-teal-900/10">Add {selectedShift} Check</button>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Daily Checklist */}
             <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b pb-2">Maintenance Bundle Elements</h4>
                {shiftCheck?.done ? (
                  <div className="space-y-2">
                    {CLABSI_DETAILED_BUNDLES.MAINTENANCE.map(el => (
                      <div key={el} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 italic">
                         {shiftCheck.elements[el] ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                         <span className="text-[10px] font-bold text-slate-600">{el}</span>
                      </div>
                    ))}
                  </div>
                ) : isAddingCheck ? (
                  <div className="space-y-2">
                    {CLABSI_DETAILED_BUNDLES.MAINTENANCE.map(el => (
                      <label key={el} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:bg-teal-50/50 cursor-pointer transition-colors">
                        <input 
                           type="checkbox" 
                           className="mt-1 w-4 h-4 text-teal-600 rounded bg-slate-50 border-slate-300"
                           checked={checkForm.elements?.[el] || false}
                           onChange={e => setCheckForm({...checkForm, elements: {...checkForm.elements, [el]: e.target.checked}})}
                        />
                        <span className="text-[10px] font-bold text-slate-700 leading-tight">{el}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase italic">No data recorded for this shift</p>
                  </div>
                )}
             </div>

             {/* Clinical Criteria */}
             <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b pb-2">Clinical Criteria</h4>
                {shiftCheck?.done ? (
                   <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
                      <div className="grid grid-cols-1 gap-2">
                         {Object.entries(shiftCheck.clinicalCriteria || {}).map(([key, val]) => (
                            key !== 'isSigned' && (
                              <div key={key} className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                                 <span className="text-slate-500">{key}</span>
                                 <span className={val ? "text-rose-500" : "text-emerald-500"}>{val ? 'Present' : 'Absent'}</span>
                              </div>
                            )
                         ))}
                      </div>
                      <div className="pt-4 border-t text-center">
                         <p className="text-[9px] font-black text-teal-600 uppercase italic">Digitally Signed: {shiftCheck.staffName}</p>
                      </div>
                   </div>
                ) : isAddingCheck ? (
                   <div className="p-6 bg-white rounded-3xl border border-teal-200 shadow-lg shadow-teal-900/5 space-y-6">
                      <div className="space-y-3">
                         {(monitoring.population === 'Adult' ? CLABSI_DETAILED_BUNDLES.CLINICAL_ADULT : CLABSI_DETAILED_BUNDLES.CLINICAL_PEDIA).map(c => (
                            <label key={c} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                               <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{c}</span>
                               <div className="flex gap-2">
                                  <button type="button" onClick={() => setCheckForm({...checkForm, clinicalCriteria: {...checkForm.clinicalCriteria!, [c]: true}})} className={cn("px-4 py-1 text-[9px] font-black rounded-lg", checkForm.clinicalCriteria?.[c as any] ? "bg-rose-500 text-white" : "bg-white text-slate-400 border border-slate-200")}>Yes</button>
                                  <button type="button" onClick={() => setCheckForm({...checkForm, clinicalCriteria: {...checkForm.clinicalCriteria!, [c]: false}})} className={cn("px-4 py-1 text-[9px] font-black rounded-lg", checkForm.clinicalCriteria?.[c as any] === false ? "bg-emerald-500 text-white" : "bg-white text-slate-400 border border-slate-200")}>No</button>
                               </div>
                            </label>
                         ))}
                      </div>
                      <button onClick={handleAddCheck} className="w-full btn-primary py-4 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-teal-900/10">Submit {selectedShift} Observations</button>
                   </div>
                ) : (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                    <p className="text-[10px] font-black text-slate-300 uppercase italic">Waiting for clinical data...</p>
                  </div>
                )}
             </div>
          </div>
        </div>
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
