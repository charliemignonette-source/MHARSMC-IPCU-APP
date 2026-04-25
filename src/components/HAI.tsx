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
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, HAICase, BOCLog, HAIType, IPCUAction } from '../types';
import { UNITS, DEVICES, BUNDLE_ELEMENTS } from '../constants';
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
    triggeredLabs: [],
    deviceDays: 0
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

    return () => { unsub1(); unsub2(); };
  }, [user, isIPCU]);

  const handleCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'hai_cases'), {
        ...caseForm,
        auditorId: user.uid,
        auditorEmail: user.email,
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
        validatedAt: serverTimestamp()
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
          validatorId: user.uid
        }
      });
      setIsVerifying(false);
      setSelectedLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'boc_logs');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">Infection Surveillance</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Active HAI detection and therapeutic bundle monitoring</p>
        </div>
        <div className="flex gap-4">
           {activeView === 'surveillance' ? (
             <button 
              onClick={() => setIsAddingCase(true)}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Report Case</span>
            </button>
           ) : (
             <button 
              onClick={() => setIsAddingBundle(true)}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Log Bundle</span>
            </button>
           )}
        </div>
      </div>

      {/* Modern Switcher */}
      <div className="flex bg-slate-100 p-1.5 w-fit rounded-2xl mb-8">
        {(['surveillance', 'bundles'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn(
              "px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
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
               <RateTile label="VAP Rate" rate={2.04} unit="per 1,000 vent-days" baseline={2.0} />
               <RateTile label="CLABSI Rate" rate={0.42} unit="per 1,000 line-days" baseline={1.5} />
               <RateTile label="CAUTI Rate" rate={1.15} unit="per 1,000 cath-days" baseline={1.0} />
               <RateTile label="SSI Rate" rate={0.8} unit="per 100 procedures" baseline={1.0} />
               <div className={cn(
                 "bento-card p-6 flex flex-col justify-between",
                 1.05 >= 1 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
               )}>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Overall HAI Rate</h4>
                    <div className={cn(
                      "text-3xl font-black",
                      1.05 >= 1 ? "text-rose-600" : "text-emerald-600"
                    )}>1.05%</div>
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-tight text-slate-400">Target: <span className="text-emerald-600">{" < 1% "}</span></div>
               </div>
            </div>

            {/* Possible HAI Cases Today */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Possible HAI Cases Today (Triggered)</h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="bento-card bg-white overflow-hidden">
                <table className="w-full text-left border-collapse border-spacing-0">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
             {bundleLogs.map(log => (
               <div key={log.id} className="bento-card p-6 bg-white hover:border-teal-500/20 transition-all cursor-pointer group relative flex flex-col">
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
                       <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified by IPCU
                       </p>
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
          />
        )}

        {isAddingBundle && (
          <BundleModal 
            onClose={() => setIsAddingBundle(false)}
            formData={bundleForm}
            setFormData={setBundleForm}
            onSubmit={handleBundleSubmit}
          />
        )}
        {isVerifying && selectedLog && (
          <VerificationModal
            onClose={() => { setIsVerifying(false); setSelectedLog(null); }}
            log={selectedLog}
            formData={verificationForm}
            setFormData={setVerificationForm}
            onSubmit={handleVerifySubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VerificationModal({ onClose, log, formData, setFormData, onSubmit }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
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
        <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[80vh] bg-slate-50">
           
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
                    <div className="grid grid-cols-1 gap-2">
                       {['Reinforced proper technique', 'Educated staff', 'Escalated to unit head'].map(action => (
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
                            <span className="text-[10px] font-bold text-slate-300">{action}</span>
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

           <button type="submit" className="w-full py-5 bg-brand-primary text-white font-black uppercase tracking-[0.2em] rounded-3xl shadow-2xl shadow-teal-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Publish Official Verification</button>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-rose-500 p-2 rounded-xl text-white shadow-lg shadow-rose-900/10">
               <AlertTriangle className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Clinical HAI Detection Entry</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[85vh]">
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
                      </select>
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
                       {['Fever >38C', 'Hypotension', 'Tachycardia', 'Purulent Drainage', 'Heat/Pain/Swelling', 'Abdominal Pain', 'Cough/Dyspnea'].map(c => (
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
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Laboratory Criteria</label>
                    <div className="flex flex-wrap gap-2">
                       {['Positive Blood Culture', 'Positive Urine Culture', 'Positive Tip Culture', 'WBC >12,000', 'WBC <4,000', 'Radiographic Evidence', 'C-Reactive Protein +'].map(l => (
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
                  </div>
                  
                  <div className="space-y-1.5 pt-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Additional Symptoms / Notes</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium h-20 resize-none outline-none" placeholder="Enter findings..." value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
                  </div>
               </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
             <button type="button" onClick={onClose} className="flex-1 py-4 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Cancel Report</button>
             <button type="submit" className="flex-1 py-4 bg-rose-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-rose-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Submit Clinical Stream</button>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-brand-primary p-2 rounded-xl text-white shadow-lg shadow-teal-900/10">
               <ShieldCheck className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Daily Bundles Compliance Monitoring</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-8 space-y-8 overflow-y-auto max-h-[85vh]">
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

          <button type="submit" className="btn-primary w-full py-4 shadow-xl shadow-teal-900/10 font-bold uppercase tracking-widest text-[10px] mt-4">Record Daily Compliance Monitoring</button>
        </form>
      </motion.div>
    </div>
  );
}

function HAIValidationModal({ onClose, haiCase, onSubmit }: any) {
  const [formData, setFormData] = useState({
    status: haiCase.status,
    decisionNote: haiCase.decisionNote || '',
    validatorName: ''
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
           <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-brand-primary" />
              <h3 className="text-lg font-bold uppercase tracking-tight">IPCU HAI Validation Queue</h3>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="p-8 space-y-6">
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
              <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none" value={formData.validatorName} onChange={e => setFormData({...formData, validatorName: e.target.value})} />
           </div>
           <button type="submit" className="w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10">Publish Validation Decision</button>
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
