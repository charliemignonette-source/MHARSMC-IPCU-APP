import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Target, ShieldCheck, FileText, ClipboardCheck, Activity, Users, Edit2, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const MANUAL_DENOMINATOR_METRICS = ['A.1.1', 'A.2.1', 'A.5.1', 'A.3.1', 'A.4.1', 'A.6.1', 'A.7.1'];

export default function QualityObjectives({ user }: { user: UserProfile }) {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState({
    hhMaterials: { validated: 0, total: 0 },
    hhBehavioral: { validated: 0, total: 0 },
    ppeAvailability: { validated: 0, total: 0 },
    ppeBehavioral: { validated: 0, total: 0 },
    haiSurveillance: { visited: 0, total: 0 },
    caseValidation: { validated: 0, total: 0 },
    safeInjection: { validated: 0, total: 0 },
    environmentalCleaning: { validated: 0, total: 0 },
    deviceBundle: { validated: 0, total: 0 },
    ssiBundle: { validated: 0, total: 0 }
  });

  useEffect(() => {
    // Generate real-time listeners for all quality objectives based on the selected month
    const startOfSelectedMonth = startOfMonth(new Date(month + '-01'));
    const endOfSelectedMonth = endOfMonth(new Date(month + '-01'));

    const isDateInMonth = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        return isWithinInterval(d, { start: startOfSelectedMonth, end: endOfSelectedMonth });
      } catch {
        return false;
      }
    };

    setLoading(true);

    // 0. Fetch Quality Goals (Manual Denominators)
    const unsubGoals = onSnapshot(doc(db, 'quality_goals', month), (docSnap) => {
      if (docSnap.exists()) {
        setGoals(docSnap.data() as Record<string, number>);
      } else {
        setGoals({});
      }
    });

    // 1. Audits Collection (covers HH, PPE, Safe Injection, Environmental, etc.)
    const qAudits = query(collection(db, 'audits'));
    const unsubAudits = onSnapshot(qAudits, (snap) => {
      let hhMatVal = 0, hhMatTot = 0;
      let hhBehVal = 0, hhBehTot = 0;
      let ppeMatVal = 0, ppeMatTot = 0;
      let ppeBehVal = 0, ppeBehTot = 0;
      let siVal = 0, siTot = 0;
      let envVal = 0, envTot = 0;

      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.date && isDateInMonth(data.date)) {
          if (data.type === 'Hand Hygiene Behavior') {
            hhBehTot++;
            if (data.isValidated) hhBehVal++;
          } else if (data.type === 'Hand Hygiene Materials') {
            hhMatTot++;
            if (data.isValidated) hhMatVal++;
          } else if (data.type === 'PPE Donning/Doffing') {
            ppeBehTot++;
            if (data.isValidated) ppeBehVal++;
          } else if (data.type === 'Sharps & Safety') {
            siTot++;
            if (data.isValidated) siVal++;
          } else if (data.type === 'Environmental Check') {
            envTot++;
            if (data.isValidated) envVal++;
          }
        }
      });

      setMetrics(prev => ({
        ...prev,
        hhMaterials: { validated: hhMatVal, total: hhMatTot },
        hhBehavioral: { validated: hhBehVal, total: hhBehTot },
        ppeAvailability: { validated: ppeMatVal, total: ppeMatTot }, 
        ppeBehavioral: { validated: ppeBehVal, total: ppeBehTot },
        safeInjection: { validated: siVal, total: siTot },
        environmentalCleaning: { validated: envVal, total: envTot }
      }));
    });

    // 2. HAICases Collection (covers Case Validation)
    const qHai = query(collection(db, 'hai_cases'));
    const unsubHai = onSnapshot(qHai, (snap) => {
      let caseVal = 0, caseTot = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.dateOfEvent && isDateInMonth(data.dateOfEvent)) {
          caseTot++;
          if (data.status === 'CONFIRMED' || data.status === 'REJECTED') {
            caseVal++; // IPCU validated
          }
        }
      });
      setMetrics(prev => ({
        ...prev,
        caseValidation: { validated: caseVal, total: caseTot }
      }));
    });

    // 3. Bundles / BOC Logs Collection (covers Device Bundle, SSI Bundle)
    const qBundles = query(collection(db, 'boc_logs'));
    const unsubBundles = onSnapshot(qBundles, (snap) => {
      let devVal = 0, devTot = 0;
      let ssiVal = 0, ssiTot = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.date && isDateInMonth(data.date)) {
          if (['CLABSI', 'CAUTI', 'VAP'].includes(data.bundleType)) {
            devTot++;
            if (data.isValidated) devVal++;
          } else if (data.bundleType === 'SSI') {
            ssiTot++;
            if (data.isValidated) ssiVal++;
          }
        }
      });
      setMetrics(prev => ({
        ...prev,
        deviceBundle: { validated: devVal, total: devTot },
        ssiBundle: { validated: ssiVal, total: ssiTot }
      }));
      setLoading(false);
    });

    return () => {
      unsubGoals();
      unsubAudits();
      unsubHai();
      unsubBundles();
    };
  }, [month]);

  const saveGoal = async (id: string) => {
    const val = parseInt(editValue, 10);
    if (isNaN(val) || val < 0) return;
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'quality_goals', month), {
        [id]: val
      }, { merge: true });
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to save goal.');
    } finally {
      setIsSaving(false);
    }
  };

  const objectives = [
    {
      id: 'A.1.1',
      title: 'HH Materials Availability',
      desc: 'Maintain continuous availability of hand hygiene materials through IPCU validation.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.hhMaterials },
      icon: ShieldCheck
    },
    {
      id: 'A.1.2',
      title: 'HH Behavioral Compliance',
      desc: 'Ensure consistent validation of submitted HH behavioral compliance (WHO 5 Moments).',
      target: '100%',
      freq: 'Monthly submitted',
      data: metrics.hhBehavioral,
      icon: Users
    },
    {
      id: 'A.2.1',
      title: 'PPE Availability',
      desc: 'Ensure PPE availability and accessibility through scheduled IPCU validation.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.ppeAvailability },
      icon: ShieldCheck
    },
    {
      id: 'A.2.2',
      title: 'PPE Behavioral Compliance',
      desc: 'Ensure validation of submitted opportunity-based PPE observations.',
      target: '100%',
      freq: 'Monthly submitted',
      data: metrics.ppeBehavioral,
      icon: Users
    },
    {
      id: 'A.5.1',
      title: 'HAI Surveillance Coverage',
      desc: 'Ensure complete surveillance coverage of all high-risk units visited.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.haiSurveillance }, 
      icon: Activity
    },
    {
      id: 'A.5.2',
      title: 'Case Validation Completeness',
      desc: 'Ensure validation of all suspected HAIs using DOH/NHSN definitions.',
      target: '100%',
      freq: 'Monthly suspected cases',
      data: metrics.caseValidation,
      icon: FileText
    },
    {
      id: 'A.3.1',
      title: 'Safe Injection Practices',
      desc: 'Ensure scheduled safe injection practices audits are validated by IPCU.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.safeInjection },
      icon: ClipboardCheck
    },
    {
      id: 'A.4.1',
      title: 'Env Cleaning Audit Coverage',
      desc: 'Ensure scheduled environmental cleaning audits are validated by IPCU.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.environmentalCleaning },
      icon: ClipboardCheck
    },
    {
      id: 'A.6.1',
      title: 'Device Bundle Audit Coverage',
      desc: 'Ensure scheduled device care bundles (CLABSI, VAP, CAUTI) are validated.',
      target: '100%',
      freq: 'Weekly scheduled',
      data: { ...metrics.deviceBundle },
      icon: ClipboardCheck
    },
    {
      id: 'A.7.1',
      title: 'SSI Bundle Audit Coverage',
      desc: 'Ensure scheduled operative SSI prevention bundles are validated.',
      target: '100%',
      freq: 'Monthly scheduled',
      data: { ...metrics.ssiBundle },
      icon: ClipboardCheck
    }
  ];

  // Apply manual goals where applicable
  objectives.forEach(obj => {
    if (MANUAL_DENOMINATOR_METRICS.includes(obj.id)) {
      obj.data.total = goals[obj.id] || 0; // Override total with scheduled goal
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary/10 rounded-xl">
              <Target className="w-6 h-6 text-brand-primary" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quality Objectives Tracker</h1>
          </div>
          <p className="text-sm font-medium text-slate-500 max-w-2xl">
            Track metrics against targets. For scheduled activities, input the target denominator manually. For submitted forms, the denominator auto-updates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-brand-primary transition-colors"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-primary rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Calculating Metrics...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {objectives.map((obj, i) => {
            const isManualSource = MANUAL_DENOMINATOR_METRICS.includes(obj.id);
            const percentage = obj.data.total === 0 ? 0 : Math.round((obj.data.validated / obj.data.total) * 100);
            const isMeetingTarget = percentage >= 100;

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={obj.id}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col h-full"
              >
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 h-1.5 transition-all duration-1000",
                    obj.data.total === 0 ? "bg-slate-200 w-full" : (isMeetingTarget ? "bg-emerald-500" : "bg-brand-primary")
                  )}
                  style={{ width: `${obj.data.total === 0 ? 100 : Math.max(percentage, 5)}%` }}
                />

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                      isMeetingTarget && obj.data.total > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
                    )}>
                      <obj.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{obj.id}</h3>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{obj.title}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-6 flex-1">
                  {obj.desc}
                </p>

                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isManualSource ? 'Target (Auto Numerator)' : 'Submitted (Fully Auto)'}
                    </div>
                    {isManualSource && (
                      <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                        Manual Denom
                      </span>
                    )}
                  </div>

                  <div className="flex items-end justify-between bg-slate-50 rounded-2xl p-4">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {obj.freq}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className={cn(
                          "text-3xl font-black tracking-tighter",
                          obj.data.total === 0 ? "text-slate-300" : (isMeetingTarget ? "text-emerald-600" : "text-brand-primary")
                        )}>
                          {obj.data.total === 0 ? '-' : `${percentage}%`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Validated / Denominator
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-lg font-black text-slate-900">{obj.data.validated}</span>
                        <span className="text-slate-300 font-black">/</span>
                        
                        {editingId === obj.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-2 py-1 text-sm font-bold text-slate-900 bg-white border border-brand-primary outline-none rounded-lg text-center shadow-sm"
                            />
                            <button
                              onClick={() => saveGoal(obj.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/edit cursor-pointer" onClick={() => {
                            if (isManualSource) {
                              setEditingId(obj.id);
                              setEditValue(obj.data.total.toString());
                            }
                          }}>
                            <span className={cn(
                              "text-lg font-black",
                              isManualSource && obj.data.total === 0 ? "text-rose-500 animate-pulse" : "text-slate-400"
                            )}>
                              {obj.data.total}
                            </span>
                            {isManualSource && (
                              <div className="p-1 rounded-md text-slate-300 hover:text-brand-primary hover:bg-white border border-transparent hover:border-slate-200 transition-all opacity-0 group-hover/edit:opacity-100">
                                <Edit2 className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "absolute top-5 right-5 flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                  obj.data.total === 0 
                    ? "bg-slate-100 text-slate-500" 
                    : (isMeetingTarget ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
                )}>
                  {obj.data.total === 0 ? 'No Target Data' : (isMeetingTarget ? 'On Track' : 'Needs Focus')}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
