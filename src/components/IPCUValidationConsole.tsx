import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  ChevronRight, 
  Activity, 
  Stethoscope, 
  ClipboardList, 
  Layers,
  XCircle,
  Mail,
  Calendar,
  Microscope,
  Info,
  AlertOctagon,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, HAICase, AMSRequest, Audit, BOCLog, Role, IPCUAction, NSIReport, OutbreakReport } from '../types';
import { cn, formatDate } from '../lib/utils';
import { UNITS, DEVICES } from '../constants';

type ValidationType = 'HAI' | 'AMS' | 'AUDIT' | 'BUNDLE' | 'NSI' | 'OUTBREAK';

interface PendingItem {
  id: string;
  type: ValidationType;
  patientName?: string;
  unit: string;
  subType: string;
  dateFlagged: string;
  riskLevel?: string;
  originalData: any;
}

export default function IPCUValidationConsole({ user }: { user: UserProfile | null }) {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [validatedHistory, setValidatedHistory] = useState<any[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  
  // States for Sections 4-7
  const [confirmedHAI, setConfirmedHAI] = useState<HAICase[]>([]);
  const [validatedAMS, setValidatedAMS] = useState<AMSRequest[]>([]);
  const [validatedAudits, setValidatedAudits] = useState<Audit[]>([]);
  const [validatedBundles, setValidatedBundles] = useState<BOCLog[]>([]);
  const [validatedNSI, setValidatedNSI] = useState<NSIReport[]>([]);
  const [validatedOutbreaks, setValidatedOutbreaks] = useState<OutbreakReport[]>([]);

  useEffect(() => {
    // 1. Fetch Pending HAI Cases
    const qHAI = query(collection(db, 'hai_cases'), where('status', '==', 'PENDING'));
    const unsubHAI = onSnapshot(qHAI, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as HAICase;
        return {
          id: d.id,
          type: 'HAI' as ValidationType,
          patientName: data.patientName,
          unit: data.unit,
          subType: data.type,
          dateFlagged: data.triggerDate,
          riskLevel: data.riskLevel,
          originalData: data
        };
      });
      updatePendingList('HAI', items);
    });

    // 2. Fetch Pending AMS Requests
    const qAMS = query(collection(db, 'ams_requests'), where('status', '==', 'PENDING'));
    const unsubAMS = onSnapshot(qAMS, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as AMSRequest;
        return {
          id: d.id,
          type: 'AMS' as ValidationType,
          patientName: data.patientName,
          unit: data.unit || data.location || 'Unknown',
          subType: data.type,
          dateFlagged: data.date,
          originalData: data
        };
      });
      updatePendingList('AMS', items);
    });

    // 3. Fetch Pending Audits
    const qAudits = query(collection(db, 'audits'), where('isValidated', '==', false));
    const unsubAudits = onSnapshot(qAudits, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as Audit;
        return {
          id: d.id,
          type: 'AUDIT' as ValidationType,
          unit: data.unit,
          subType: data.type,
          dateFlagged: new Date(data.timestamp).toLocaleDateString(),
          originalData: data
        };
      });
      updatePendingList('AUDIT', items);
    });

    // 4. Fetch Pending Bundle Logs
    const qBundles = query(collection(db, 'boc_logs'), where('isValidated', '==', false));
    const unsubBundles = onSnapshot(qBundles, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as BOCLog;
        return {
          id: d.id,
          type: 'BUNDLE' as ValidationType,
          patientName: data.patientName,
          unit: data.unit,
          subType: 'Bundle Care',
          dateFlagged: data.date,
          originalData: data
        };
      });
      updatePendingList('BUNDLE', items);
    });

    // 5. Fetch Pending NSI Reports
    const qNSI = query(collection(db, 'nsi_reports'), where('status', '==', 'PENDING'));
    const unsubNSI = onSnapshot(qNSI, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as NSIReport;
        return {
          id: d.id,
          type: 'NSI' as ValidationType,
          patientName: data.staff.name,
          unit: data.incident.unit,
          subType: data.incident.exposureType,
          dateFlagged: data.incident.date,
          originalData: data
        };
      });
      updatePendingList('NSI', items);
    });

    // 6. Fetch Pending Outbreaks
    const qOutbreaks = query(collection(db, 'outbreaks'), where('status', '==', 'Suspected'));
    const unsubOutbreaks = onSnapshot(qOutbreaks, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data() as OutbreakReport;
        return {
          id: d.id,
          type: 'OUTBREAK' as ValidationType,
          unit: data.epidemiology?.unitsAffected || 'Multiple',
          subType: (data.type || []).join(', '),
          dateFlagged: data.detectedAt,
          originalData: data
        };
      });
      updatePendingList('OUTBREAK', items);
    });

    // History Queries (Validated MTD)
    const qConfirmedHAI = query(collection(db, 'hai_cases'), where('status', '==', 'CONFIRMED'));
    const unsubConfirmedHAI = onSnapshot(qConfirmedHAI, (snap) => {
      setConfirmedHAI(snap.docs.map(d => ({ id: d.id, ...d.data() } as HAICase)));
    });

    const qValidatedAMS = query(collection(db, 'ams_requests'), where('status', 'in', ['APPROVED', 'DENIED', 'OVERRIDDEN']));
    const unsubValidatedAMS = onSnapshot(qValidatedAMS, (snap) => {
      setValidatedAMS(snap.docs.map(d => ({ id: d.id, ...d.data() } as AMSRequest)));
    });

    const qValidatedAudits = query(collection(db, 'audits'), where('isValidated', '==', true));
    const unsubValidatedAudits = onSnapshot(qValidatedAudits, (snap) => {
      setValidatedAudits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Audit)));
    });

    const qValidatedBundles = query(collection(db, 'boc_logs'), where('isValidated', '==', true));
    const unsubValidatedBundles = onSnapshot(qValidatedBundles, (snap) => {
      setValidatedBundles(snap.docs.map(d => ({ id: d.id, ...d.data() } as BOCLog)));
    });

    const qValidatedNSI = query(collection(db, 'nsi_reports'), where('status', '!=', 'PENDING'));
    const unsubValidatedNSI = onSnapshot(qValidatedNSI, (snap) => {
      setValidatedNSI(snap.docs.map(d => ({ id: d.id, ...d.data() } as NSIReport)));
    });

    const qValidatedOutbreaks = query(collection(db, 'outbreaks'), where('status', 'in', ['Confirmed', 'Closed', 'Controlled']));
    const unsubValidatedOutbreaks = onSnapshot(qValidatedOutbreaks, (snap) => {
      setValidatedOutbreaks(snap.docs.map(d => ({ id: d.id, ...d.data() } as OutbreakReport)));
    });

    return () => {
      unsubHAI();
      unsubAMS();
      unsubAudits();
      unsubBundles();
      unsubNSI();
      unsubOutbreaks();
      unsubConfirmedHAI();
      unsubValidatedAMS();
      unsubValidatedAudits();
      unsubValidatedBundles();
      unsubValidatedNSI();
      unsubValidatedOutbreaks();
    };
  }, []);

  const [pendingMap, setPendingMap] = useState<Record<ValidationType, PendingItem[]>>({
    HAI: [], AMS: [], AUDIT: [], BUNDLE: [], NSI: [], OUTBREAK: []
  });

  const updatePendingList = (type: ValidationType, items: PendingItem[]) => {
    setPendingMap(prev => {
      const newMap = { ...prev, [type]: items };
      const allPending = (Object.values(newMap).flat() as PendingItem[]).sort((a, b) => new Date(b.dateFlagged).getTime() - new Date(a.dateFlagged).getTime());
      setPendingItems(allPending);
      return newMap;
    });
  };

  const openValidation = (item: PendingItem) => {
    setSelectedItem(item);
    setIsValidationModalOpen(true);
  };

  const handleValidationSubmit = async (decision: any) => {
    if (!selectedItem || !user) return;
    
    const { id, type } = selectedItem;
    let collectionName = '';
    let updateData: any = {
      isValidated: true,
      validatedBy: user.uid,
      validatorName: user.name,
      validatedAt: serverTimestamp(),
      ...decision
    };

    if (type === 'HAI') {
      collectionName = 'hai_cases';
      // status will be set in decision (CONFIRMED, NOT_HAI, etc)
    } else if (type === 'AMS') {
      collectionName = 'ams_requests';
      // status set in decision
    } else if (type === 'AUDIT') {
      collectionName = 'audits';
    } else if (type === 'BUNDLE') {
      collectionName = 'boc_logs';
    } else if (type === 'NSI') {
      collectionName = 'nsi_reports';
      updateData = {
        ...updateData,
        status: decision.status,
        validation: {
          classification: decision.classification,
          rootCauses: decision.rootCauses,
          contributingFactors: decision.contributingFactors,
          decision: decision.status,
          correctiveActions: decision.correctiveActions,
          validatorName: user.name,
          validatorId: user.uid,
          validatedAt: serverTimestamp()
        }
      };
    } else if (type === 'OUTBREAK') {
      collectionName = 'outbreaks';
      updateData = {
        ...updateData,
        status: decision.status === 'VALIDATED' ? 'Confirmed' : (decision.status === 'REJECTED' ? 'Closed' : 'Under Investigation'),
        validation: {
          decision: decision.status === 'VALIDATED' ? 'Confirmed Outbreak' : (decision.status === 'REJECTED' ? 'Not an Outbreak' : 'Needs More Data'),
          basis: decision.basis,
          notes: decision.notes,
          validatorName: user.name,
          validatorId: user.uid,
          validatedAt: serverTimestamp()
        }
      };
    }

    try {
      await updateDoc(doc(db, collectionName, id), updateData);
      
      setIsValidationModalOpen(false);
      setSelectedItem(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, collectionName);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">IPCU Validation Console</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
            Central Verification Agency • MHARSMC
          </p>
        </div>
      </div>

      {/* Modern Switcher */}
      <div className="flex bg-white p-2 w-fit rounded-3xl shadow-sm border border-slate-100 mb-8">
        {[
          { id: 'pending', label: 'Case Verification Queue', icon: Clock, count: pendingItems.length },
          { id: 'history', label: 'Validation Archives', icon: ClipboardList }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={cn(
                "px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-3",
                activeSubTab === tab.id ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10" : "text-slate-400 hover:text-slate-500"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black",
                  activeSubTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'pending' ? (
          <motion.div 
            key="pending"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-12"
          >
            {/* Pending Validations */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Cases Requiring Validation</h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              
              <div className="bento-card bg-white overflow-hidden shadow-2xl shadow-slate-200/50">
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Flagged Entity</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Context / Unit</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Trigger Metrics</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Priority</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900 mb-0.5">{item.patientName || item.subType}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              {item.type === 'HAI' && <Activity className="w-2.5 h-2.5 text-rose-500" />}
                              {item.type === 'AMS' && <Stethoscope className="w-2.5 h-2.5 text-blue-500" />}
                              {item.type === 'AUDIT' && <ClipboardList className="w-2.5 h-2.5 text-emerald-500" />}
                              {item.type === 'BUNDLE' && <Layers className="w-2.5 h-2.5 text-amber-500" />}
                              {item.type === 'NSI' && <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />}
                              {item.type === 'OUTBREAK' && <AlertOctagon className="w-2.5 h-2.5 text-rose-700" />}
                              {item.type} • {item.subType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">{item.unit}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{item.dateFlagged}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                             {item.type === 'HAI' && item.originalData.triggeredCriteria?.map((c: string) => (
                               <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold uppercase rounded">{c}</span>
                             ))}
                             {item.type === 'AMS' && <span className="text-[10px] font-bold opacity-60 italic">{item.originalData.antibiotic}</span>}
                             {item.type === 'AUDIT' && <span className="text-[10px] font-bold text-emerald-600">Score: {item.originalData.score || 0}%</span>}
                             {item.type === 'BUNDLE' && (
                               <span className={cn(
                                 "text-[10px] font-black uppercase",
                                 item.originalData.compliancePercentage === 100 ? "text-emerald-600" : "text-rose-600"
                               )}>
                                 {Math.round(item.originalData.compliancePercentage)}% Compliance
                               </span>
                             )}
                             {item.type === 'OUTBREAK' && (
                               <span className="text-[10px] font-bold text-rose-600 italic">Attack Rate: {item.originalData.epidemiology?.attackRate || 'N/A'}%</span>
                             )}
                             {item.type === 'NSI' && (
                               <span className="text-[10px] font-bold text-slate-600 tracking-tight">{item.originalData.staff.position}</span>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full shadow-sm",
                                item.riskLevel === 'RED' ? "bg-rose-500" : 
                                item.riskLevel === 'YELLOW' ? "bg-amber-400" : 
                                item.type === 'AMS' ? "bg-blue-500" : "bg-slate-900"
                              )} />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {item.riskLevel || 'Standard'}
                              </span>
                           </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                             <div className="flex items-center gap-2">
                               {user?.role === 'ADMIN' && (
                                 <button 
                                   onClick={async (e) => {
                                     e.stopPropagation();
                                     if (!confirm('Are you sure?')) return;
                                     const colMap: Record<string, string> = { HAI: 'hai_cases', AMS: 'ams_requests', AUDIT: 'audits', BUNDLE: 'boc_logs', NSI: 'nsi_reports', OUTBREAK: 'outbreaks' };
                                     try { await deleteDoc(doc(db, colMap[item.type], item.id)); } catch (e) { handleFirestoreError(e, OperationType.DELETE, item.id); }
                                   }}
                                   className="p-1.5 text-rose-400 hover:text-rose-600"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                               <button 
                                 onClick={() => openValidation(item)}
                             className="px-4 py-2 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-900 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                           >
                               Review Case
                           </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pendingItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                           <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                                 <ShieldCheck className="w-10 h-10" />
                              </div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Queue is Empty</p>
                              <p className="text-[10px] text-slate-300 font-bold max-w-[200px] leading-relaxed uppercase">Institutional biosecurity is currently within optimal parameters.</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-12"
          >
            {/* Confirmed HAI Events */}
            <HistorySection 
              title="Confirmed HAI Primary Events" 
              icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
              headers={['Patient', 'Unit', 'HAI Type', 'Device Days', 'Validator']}
              items={confirmedHAI.map(c => [
                c.patientName,
                c.unit,
                <span className="text-xs font-black text-rose-600 italic">{c.type}</span>,
                `${c.deviceDays} Days`,
                <span className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">{c.validatorName || 'System'}</span>
                  <span className="text-[9px] text-slate-400">{c.validatedAt?.toDate?.()?.toLocaleDateString() || c.validatedAt || '-'}</span>
                </span>
              ])}
            />

            {/* Validated AMS Requests */}
            <HistorySection 
              title="Validated AMS Pharmacological Requests" 
              icon={<Stethoscope className="w-5 h-5 text-blue-500" />}
              headers={['Patient', 'Antibiotic', 'Status', 'Indication', 'Validator']}
              items={validatedAMS.map(a => [
                a.patientName,
                a.antibiotic,
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                  a.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>{a.status}</span>,
                a.indicationForUse || a.diagnosis,
                a.validatorName || '-'
              ])}
            />

            {/* Validated IPC Audits */}
            <HistorySection 
              title="Validated IPC Biosecurity Audits" 
              icon={<ClipboardList className="w-5 h-5 text-emerald-500" />}
              headers={['Audit Type', 'Unit', 'Compliance', 'Validator', 'Date']}
              items={validatedAudits.map(a => [
                a.type.replace(/_/g, ' '),
                a.unit,
                <span className="text-xs font-black text-emerald-600">{a.score}%</span>,
                a.validatorName || '-',
                new Date(a.timestamp).toLocaleDateString()
              ])}
            />

            {/* Validated Bundle Discrepancies */}
            <HistorySection 
              title="Validated Bundle Compliance Logs" 
              icon={<Layers className="w-5 h-5 text-amber-500" />}
              headers={['Patient', 'Unit', 'Type', 'Status', 'IPCU Decision']}
              items={validatedBundles.map(b => [
                b.patientName,
                b.unit,
                'Care Bundle',
                <span className={cn(
                  "text-[10px] font-bold uppercase",
                  b.compliancePercentage === 100 ? "text-emerald-500" : "text-rose-500"
                )}>{b.compliancePercentage}% Reported</span>,
                <span className={cn(
                  "px-2 py-1 rounded-xl text-[9px] font-black uppercase",
                  b.verification?.finalDecision === 'Compliant' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>{b.verification?.finalDecision || 'Validated'}</span>
              ])}
            />

            {/* Validated NSI Reports */}
            <HistorySection 
              title="Validated Sharps Exposure Records" 
              icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
              headers={['Staff Name', 'Unit', 'Exposure', 'Classification', 'Result']}
              items={validatedNSI.map(n => [
                n.staff.name,
                n.incident.unit,
                n.incident.exposureType,
                <span className="text-[10px] font-black uppercase text-slate-400">{n.validation?.classification || '-'}</span>,
                <span className={cn(
                  "px-2 py-1 rounded-xl text-[9px] font-black uppercase",
                  n.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>{n.status}</span>
              ])}
            />

            {/* Validated Outbreaks */}
            <HistorySection 
              title="Institutional Outbreak Archives" 
              icon={<ShieldAlert className="w-5 h-5 text-slate-900" />}
              headers={['Outbreak Type', 'Affected Units', 'Total Cases', 'Status', 'Closure Date']}
              items={validatedOutbreaks.map(o => [
                (o.type || []).join(', '),
                o.epidemiology?.unitsAffected || 'Ward',
                o.lineList?.length || 0,
                <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase">{o.status}</span>,
                o.dateClosed || '-'
              ])}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isValidationModalOpen && selectedItem && (
          <ValidationModal 
            item={selectedItem} 
            user={user}
            onClose={() => setIsValidationModalOpen(false)}
            onSubmit={handleValidationSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistorySection({ title, icon, headers, items }: { title: string, icon: React.ReactNode, headers: string[], items: any[][] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        {icon}
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h3>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="bento-card bg-white overflow-hidden shadow-xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {headers.map(h => (
                  <th key={h} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-6 py-4 text-xs font-bold text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={headers.length} className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No validation records for this category</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ValidationModal({ item, user, onClose, onSubmit }: any) {
  const [decision, setDecision] = useState<any>({
    status: item.type === 'HAI' ? 'CONFIRMED' : (item.type === 'AMS' ? 'APPROVED' : (item.type === 'NSI' ? 'VALIDATED' : 'VALIDATED')),
    reason: '',
    notes: '',
    basis: [],
    rootCauses: [],
    contributingFactors: [],
    correctiveActions: [],
    classification: 'Significant Exposure'
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(decision);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-2xl",
              item.type === 'HAI' ? "bg-rose-500" : "bg-brand-primary"
            )}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight italic">IPCU Validation Protocol</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Reference: {item.id.slice(0, 8)} • Verification Stage</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"><XCircle className="w-8 h-8" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-10">
            
            {/* Source Data Review */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <Info className="w-4 h-4 text-brand-primary" />
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Case Submission Details</h4>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient Name</p>
                      <p className="text-xs font-bold text-slate-900">{item.patientName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Location / Unit</p>
                      <p className="text-xs font-bold text-slate-900">{item.unit}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                      <p className="text-xs font-black text-rose-500 uppercase italic">{item.subType}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Logged</p>
                      <p className="text-xs font-bold text-slate-900">{item.dateFlagged}</p>
                    </div>
                  </div>
                  
                  {item.type === 'NSI' && (
                    <div className="pt-4 border-t border-slate-50 space-y-4">
                      <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                         <p className="text-[10px] font-black text-rose-900 uppercase mb-1">Exposure Context</p>
                         <p className="text-xs font-bold text-slate-700">{item.originalData.incident.exposureType} using {item.originalData.incident.deviceInvolved}</p>
                         <p className="text-[10px] text-rose-500 font-medium italic mt-1">Activity: {item.originalData.incident.activity}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Source Risk</p>
                            <p className="text-[10px] font-bold text-slate-600">{(item.originalData.source?.risks || []).join(', ') || 'Unknown'}</p>
                         </div>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Staff Position</p>
                            <p className="text-[10px] font-bold text-slate-600">{item.originalData.staff.position}</p>
                         </div>
                      </div>
                    </div>
                  )}

                  {item.type === 'OUTBREAK' && (
                    <div className="pt-4 border-t border-slate-50 space-y-4">
                      <div className="p-4 bg-slate-900 rounded-2xl">
                         <p className="text-[10px] font-black text-white/50 uppercase mb-1">Investigation Summary</p>
                         <p className="text-xs font-bold text-white">Detected {(item.originalData.type || []).join(', ')} Cluster</p>
                         <p className="text-[10px] text-brand-primary font-black uppercase mt-1">{item.originalData.epidemiology?.indexCase ? `Index: ${item.originalData.epidemiology.indexCase}` : 'In Search of Index Case'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Trigger Criteria</p>
                        <div className="flex flex-wrap gap-1">
                          {(item.originalData.triggerCriteria || []).map((c: string) => <span key={c} className="px-2 py-1 bg-slate-100 rounded text-[8px] font-bold text-slate-500 uppercase">{c}</span>)}
                        </div>
                      </div>
                    </div>
                  )}

                  {item.type === 'HAI' && (
                    <div className="pt-4 border-t border-slate-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Triggered Criteria / Symptoms</p>
                      <div className="flex flex-wrap gap-1">
                        {item.originalData.triggeredCriteria?.map((c: string) => <span key={c} className="px-2 py-1 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-600 uppercase tracking-tight">{c}</span>)}
                        {item.originalData.triggeredLabs?.map((l: string) => <span key={l} className="px-2 py-1 bg-blue-50 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-tight">{l}</span>)}
                      </div>
                    </div>
                  )}

                  {item.type === 'AMS' && (
                     <div className="pt-4 border-t border-slate-50 space-y-3">
                        <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-900 uppercase tracking-widest mb-1">Requested Agent</p>
                           <p className="text-sm font-black text-blue-600">{item.originalData.antibiotic}</p>
                           <p className="text-[10px] font-bold text-blue-500 mt-1">{item.originalData.dose} • {item.originalData.indicationForUse}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Justification</p>
                           <p className="text-[10px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl italic">"{item.originalData.justification || item.originalData.diagnosis}"</p>
                        </div>
                     </div>
                  )}
                </div>
              </div>

              {/* IPCU Final Decision */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Validation Protocol Decision</h4>
                 </div>
                 
                 <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-8 shadow-2xl shadow-slate-900/20">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Classification Select</label>
                       <div className="grid grid-cols-1 gap-2">
                          {(item.type === 'HAI' ? [
                            { id: 'CONFIRMED', label: 'Confirmed HAI Event', color: 'text-rose-400' },
                            { id: 'NOT_HAI', label: 'Does Not Meet Criteria', color: 'text-emerald-400' },
                            { id: 'NEEDS_MORE_DATA', label: 'Insufficient Evidence', color: 'text-amber-400' }
                          ] : item.type === 'AMS' ? [
                            { id: 'APPROVED', label: 'Clinical Approval', color: 'text-emerald-400' },
                            { id: 'DENIED', label: 'Access Denied', color: 'text-rose-400' },
                            { id: 'OVERRIDDEN', label: 'IPCU Manual Override', color: 'text-blue-400' }
                          ] : item.type === 'NSI' ? [
                            { id: 'VALIDATED', label: 'Validated NSI Case', color: 'text-emerald-400' },
                            { id: 'NOT_NSI', label: 'Not an Exposure Event', color: 'text-rose-400' },
                            { id: 'NEEDS_MORE_DATA', label: 'Pending Lab Review', color: 'text-amber-400' }
                          ] : item.type === 'OUTBREAK' ? [
                            { id: 'VALIDATED', label: 'Confirmed Outbreak', color: 'text-rose-400' },
                            { id: 'REJECTED', label: 'Pseudo-outbreak/Cluster', color: 'text-emerald-400' },
                            { id: 'NEEDS_MORE_DATA', label: 'Pending Line List', color: 'text-amber-400' }
                          ] : [
                            { id: 'VALIDATED', label: 'Findings Verified', color: 'text-emerald-400' },
                            { id: 'REJECTED', label: 'Findings Discarded', color: 'text-rose-400' }
                          ]).map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setDecision({ ...decision, status: opt.id })}
                              className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                                decision.status === opt.id 
                                  ? "bg-white/10 border-white/40 ring-4 ring-white/5" 
                                  : "bg-transparent border-white/5 hover:border-white/20"
                              )}
                            >
                              <span className={cn("text-xs font-black uppercase tracking-widest", decision.status === opt.id ? opt.color : "text-slate-400")}>
                                {opt.label}
                              </span>
                              {decision.status === opt.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Reason & Corrective Actions */}
            <div className="p-10 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {item.type === 'NSI' ? (
                     <>
                        <div className="space-y-6">
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exposure Classification</label>
                              <div className="flex gap-2">
                                 {['Significant', 'Non-significant'].map(c => (
                                    <button 
                                      key={c}
                                      type="button"
                                      onClick={() => setDecision({...decision, classification: `${c} Exposure`})}
                                      className={cn(
                                        "flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                        decision.classification === `${c} Exposure` ? "bg-rose-500 text-white border-transparent" : "bg-white text-slate-400 border-slate-100"
                                      )}
                                    >
                                       {c}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Root Cause Determination</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {['Unsafe Practice', 'Improper Disposal', 'Lack of PPE', 'Equipment Failure', 'Staff Fatigue', 'Other'].map(r => (
                                    <label key={r} className={cn(
                                       "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                       decision.rootCauses.includes(r) ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-slate-50 border-transparent text-slate-400"
                                    )}>
                                       <input type="checkbox" checked={decision.rootCauses.includes(r)} onChange={(e) => {
                                          const newList = e.target.checked ? [...decision.rootCauses, r] : decision.rootCauses.filter((rc: string) => rc !== r);
                                          setDecision({...decision, rootCauses: newList});
                                       }} className="hidden" />
                                       <span className="text-[9px] font-black uppercase tracking-tight">{r}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contributing Factors</label>
                              <div className="grid grid-cols-1 gap-2">
                                 {['High Workload', 'Incomplete Training', 'Poor Lighting', 'Non-compliance with Sharps Protocol', 'Other'].map(f => (
                                    <label key={f} className={cn(
                                       "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                       decision.contributingFactors.includes(f) ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-slate-50 border-transparent text-slate-400"
                                    )}>
                                       <input type="checkbox" checked={decision.contributingFactors.includes(f)} onChange={(e) => {
                                          const newList = e.target.checked ? [...decision.contributingFactors, f] : decision.contributingFactors.filter((cf: string) => cf !== f);
                                          setDecision({...decision, contributingFactors: newList});
                                       }} className="hidden" />
                                       <span className="text-[9px] font-black uppercase tracking-tight">{f}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corrective Actions</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {['Re-education', 'Reinforcement', 'Replace Sharps Container', 'Escalation to Unit Head', 'Other'].map(a => (
                                    <label key={a} className={cn(
                                       "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                       decision.correctiveActions.includes(a) ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-transparent text-slate-400"
                                    )}>
                                       <input type="checkbox" checked={decision.correctiveActions.includes(a)} onChange={(e) => {
                                          const newList = e.target.checked ? [...decision.correctiveActions, a] : decision.correctiveActions.filter((ca: string) => ca !== a);
                                          setDecision({...decision, correctiveActions: newList});
                                       }} className="hidden" />
                                       <span className="text-[9px] font-black uppercase tracking-tight">{a}</span>
                                    </label>
                                 ))}
                              </div>
                           </div>
                        </div>
                     </>
                  ) : item.type === 'OUTBREAK' ? (
                     <>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Basis for Decision</label>
                           <div className="grid grid-cols-1 gap-2">
                              {['Epidemiologic Link', 'Lab Confirmation', 'Above Baseline', 'Environmental Findings', 'No Evidence of Transmission'].map(b => (
                                 <label key={b} className={cn(
                                    "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                                    decision.basis.includes(b) ? "bg-rose-50 border-rose-100 text-rose-900" : "bg-slate-50 border-slate-100 text-slate-500"
                                 )}>
                                    <input type="checkbox" checked={decision.basis.includes(b)} onChange={(e) => {
                                       const newList = e.target.checked ? [...decision.basis, b] : decision.basis.filter((bi: string) => bi !== b);
                                       setDecision({...decision, basis: newList});
                                    }} className="w-5 h-5 rounded-lg text-rose-600" />
                                    <span className="text-[10px] font-black uppercase tracking-tight">{b}</span>
                                 </label>
                              ))}
                           </div>
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Validator Narrative</label>
                           <textarea value={decision.notes} onChange={e => setDecision({...decision, notes: e.target.value})} placeholder="Detailed clinical justification for case status change..." className="w-full h-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-xs font-medium outline-none" />
                        </div>
                     </>
                  ) : (
                    <>
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clinical Reasoning / Decision Foundation</label>
                         <select 
                           className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none"
                           value={decision.reason}
                           onChange={e => setDecision({ ...decision, reason: e.target.value })}
                         >
                            <option value="">Select Pre-defined Rationale...</option>
                            <option value="nhs_criteria">Meets NHSN/CDC Surveillance Criteria</option>
                            <option value="no_nhs_criteria">Does Not Meet Clinical Definitions</option>
                            <option value="lab_negative">Microbiological Evidence Negative</option>
                            <option value="inc_doc">Clinical Documentation Incomplete</option>
                            <option value="indication_correct">Antibiotic Indication Verified</option>
                            <option value="audit_verified">Observational Findings Confirmed</option>
                         </select>
                         <textarea 
                           placeholder="Clinical notes / Addendum..." 
                           className="w-full h-32 bg-slate-50 border border-slate-200 rounded-3xl p-5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
                           value={decision.notes}
                           onChange={e => setDecision({ ...decision, notes: e.target.value })}
                         />
                      </div>

                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corrective Actions & Directives</label>
                         <div className="grid grid-cols-1 gap-2">
                            {[
                              'Educational reinforcement provided to unit',
                              'Immediate isolation recommended',
                              'AMS recommendation issued to physician',
                              'Device removal recommended',
                              'Unit-wide re-audit scheduled',
                              'Escalated to Hospital Infection Committee'
                            ].map(action => (
                              <label key={action} className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                                decision.correctiveActions.includes(action) 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-900" 
                                  : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                              )}>
                                 <input 
                                   type="checkbox" 
                                   className="w-5 h-5 rounded-lg text-emerald-600"
                                   checked={decision.correctiveActions.includes(action)}
                                   onChange={(e) => {
                                     if(e.target.checked) setDecision({...decision, correctiveActions: [...decision.correctiveActions, action]});
                                     else setDecision({...decision, correctiveActions: decision.correctiveActions.filter((a: string) => a !== action)});
                                   }}
                                 />
                                 <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{action}</span>
                              </label>
                            ))}
                         </div>
                      </div>
                    </>
                  )}
               </div>
            </div>

            {/* Validator Info */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-slate-100 rounded-[2rem]">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 border border-slate-200">
                     <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logged Validator</p>
                     <p className="text-sm font-black text-slate-900">{user?.name} · {user?.email}</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-4 w-full md:w-auto">
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="flex-1 md:flex-none px-8 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || !decision.status}
                    className="flex-1 md:flex-none px-12 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                     {loading ? 'Finalizing...' : 'Submit Final Validation'}
                  </button>
               </div>
            </div>

          </form>
        </div>
      </motion.div>
    </div>
  );
}
