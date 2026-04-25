import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, Calendar, Clock, MapPin, 
  UserPlus, Plus, Trash2, ClipboardList, 
  ShieldCheck, AlertTriangle, Activity, 
  Microscope, Send, Save, CheckCircle2,
  XCircle, Filter, Search, ChevronRight
} from 'lucide-react';
import { 
  collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp, where,
  doc, updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, OutbreakReport, OutbreakCase, OutbreakStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const REPORTING_SOURCES = [
  'Unit Staff', 'Laboratory', 'Physician', 'IPCU', 'Other'
];

const OUTBREAK_TYPES = [
  'HAI Cluster', 'Gastroenteritis', 'Respiratory Cluster', 
  'Febrile Cluster', 'MDRO Cluster', 'Foodborne', 
  'Environmental', 'Other'
];

const TRIGGER_CRITERIA = [
  '≥2 epidemiologically linked cases', 'Sudden increase above baseline',
  'Unusual organism', 'Sentinel event', 'Lab alert'
];

const TRANSMISSION_MODES = [
  'Contact', 'Droplet', 'Airborne', 'Common Source', 'Unknown'
];

const CONTROL_MEASURES = [
  'Isolation', 'Cohorting', 'Enhanced Cleaning', 'Terminal Cleaning',
  'Device Audit', 'Hand Hygiene Reinforcement', 'PPE Reinforcement',
  'Environmental Correction', 'Staff Education', 'Other'
];

const STATUS_COLORS: Record<OutbreakStatus, string> = {
  'Suspected': 'bg-amber-100 text-amber-700',
  'Under Investigation': 'bg-blue-100 text-blue-700',
  'Confirmed': 'bg-rose-100 text-rose-700',
  'Controlled': 'bg-emerald-100 text-emerald-700',
  'Closed': 'bg-slate-100 text-slate-700'
};

export default function Outbreak({ user }: { user: UserProfile | null }) {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [reports, setReports] = useState<OutbreakReport[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReport, setActiveReport] = useState<OutbreakReport | null>(null);

  const [formData, setFormData] = useState<Partial<OutbreakReport>>({
    detectedAt: format(new Date(), 'yyyy-MM-dd'),
    detectedTime: format(new Date(), 'HH:mm'),
    reportingSrc: [],
    type: [],
    triggerCriteria: [],
    lineList: [],
    epidemiology: {
      indexCase: '',
      totalCases: 0,
      attackRate: '',
      unitsAffected: '',
      possibleSource: '',
      transmissionMode: []
    },
    findings: {
      envSwabbing: { done: false, results: '' },
      waterTesting: { done: false, results: '' },
      labAlerts: { organism: '', resistancePattern: '' }
    },
    controlMeasures: {
      actions: [],
      dateImplemented: format(new Date(), 'yyyy-MM-dd'),
      responsibleUnit: ''
    },
    status: 'Suspected'
  });

  useEffect(() => {
    const q = query(collection(db, 'outbreaks'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as OutbreakReport)));
    });
    return unsub;
  }, []);

  const handleAddCase = () => {
    const newCase: OutbreakCase = {
      patientName: '',
      hospNo: '',
      unit: '',
      onSetDate: format(new Date(), 'yyyy-MM-dd'),
      symptoms: '',
      labResults: '',
      deviceProcedure: '',
      outcome: 'Ongoing'
    };
    setFormData({
      ...formData,
      lineList: [...(formData.lineList || []), newCase]
    });
  };

  const handleRemoveCase = (index: number) => {
    const newList = [...(formData.lineList || [])];
    newList.splice(index, 1);
    setFormData({ ...formData, lineList: newList });
  };

  const handleCaseUpdate = (index: number, field: keyof OutbreakCase, value: string) => {
    const newList = [...(formData.lineList || [])];
    newList[index] = { ...newList[index], [field]: value };
    setFormData({ ...formData, lineList: newList });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (activeReport?.id) {
        // Update existing
        await updateDoc(doc(db, 'outbreaks', activeReport.id), {
          ...formData,
          createdAt: serverTimestamp() // or keep original? user likely wants latest edits tracked
        });
      } else {
        // New report
        await addDoc(collection(db, 'outbreaks'), {
          ...formData,
          reportedBy: user.name,
          reporterId: user.uid,
          reporterEmail: user.email,
          createdAt: serverTimestamp()
        });
      }
      setView('LIST');
      resetForm();
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveReport(null);
    setFormData({
      detectedAt: format(new Date(), 'yyyy-MM-dd'),
      detectedTime: format(new Date(), 'HH:mm'),
      reportingSrc: [],
      type: [],
      triggerCriteria: [],
      lineList: [],
      epidemiology: {
        indexCase: '',
        totalCases: 0,
        attackRate: '',
        unitsAffected: '',
        possibleSource: '',
        transmissionMode: []
      },
      findings: {
        envSwabbing: { done: false, results: '' },
        waterTesting: { done: false, results: '' },
        labAlerts: { organism: '', resistancePattern: '' }
      },
      controlMeasures: {
        actions: [],
        dateImplemented: format(new Date(), 'yyyy-MM-dd'),
        responsibleUnit: ''
      },
      status: 'Suspected'
    });
  };

  const toggleArrayItem = (field: keyof OutbreakReport | string, item: string, path?: string) => {
    if (path) {
      // Handle nested arrays like epidemiology.transmissionMode
      const [parent, child] = path.split('.');
      const current = (formData as any)[parent][child] as string[];
      const updated = current.includes(item) 
        ? current.filter(i => i !== item)
        : [...current, item];
      setFormData({
        ...formData,
        [parent]: { ...(formData as any)[parent], [child]: updated }
      });
      return;
    }

    const current = (formData as any)[field] as string[];
    const updated = current.includes(item) 
      ? current.filter(i => i !== item)
      : [...current, item];
    setFormData({ ...formData, [field]: updated });
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Outbreak Management</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Surveillance, Detection & Investigation Registry</p>
        </div>
        <button
          onClick={() => {
            if (view === 'LIST') setView('FORM');
            else {
              setView('LIST');
              resetForm();
            }
          }}
          className={cn(
            "px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2",
            view === 'LIST' 
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {view === 'LIST' ? (
            <><Plus className="w-4 h-4" /> New Report</>
          ) : (
            <><XCircle className="w-4 h-4" /> Cancel</>
          )}
        </button>
      </div>

      {view === 'LIST' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
             {reports.length === 0 ? (
               <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <AlertOctagon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No active outbreaks reported</p>
               </div>
             ) : (
               reports.map(report => (
                 <motion.div
                   key={report.id}
                   layoutId={report.id}
                   className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 hover:shadow-md transition-all group"
                 >
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-brand-primary/5 group-hover:text-brand-primary transition-colors">
                            <AlertTriangle className="w-6 h-6 text-rose-500" />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <h3 className="font-black text-slate-900 uppercase tracking-tight">{(report.type || []).join(', ') || 'Unspecified Type'}</h3>
                               <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest", STATUS_COLORS[report.status])}>
                                 {report.status}
                               </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Detected: {report.detectedAt} • {report.lineList?.length || 0} Cases</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveReport(report);
                          setFormData(report);
                          setView('FORM');
                        }}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                         <ChevronRight className="w-5 h-5 text-slate-400" />
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className="space-y-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attack Rate</span>
                         <p className="text-xs font-bold text-slate-700">{report.epidemiology?.attackRate || 'N/A'}</p>
                      </div>
                      <div className="space-y-1 text-center border-x border-slate-200 px-2">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Units</span>
                         <p className="text-xs font-bold text-slate-700 truncate">{report.epidemiology?.unitsAffected || 'N/A'}</p>
                      </div>
                      <div className="space-y-1 text-center">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Validation</span>
                         <p className="text-[10px] font-black uppercase text-brand-primary">{report.validation?.decision || 'PENDING'}</p>
                      </div>
                      <div className="space-y-1 text-right">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reporter</span>
                         <p className="text-xs font-bold text-slate-700 truncate">{report.reportedBy}</p>
                      </div>
                   </div>
                 </motion.div>
               ))
             )}
          </div>

          <div className="space-y-6">
             <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20">
                <div className="flex items-center gap-3 mb-6">
                   <Activity className="w-5 h-5 text-brand-primary" />
                   <h3 className="font-black uppercase tracking-widest text-xs">Trigger Protocol</h3>
                </div>
                <div className="space-y-4">
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest mb-1">Standard Definition</p>
                      <p className="text-xs text-white/70 leading-relaxed font-medium">A cluster is defined as ≥2 epidemiologically linked cases within a specific unit over 14 days.</p>
                   </div>
                   <p className="text-[10px] text-white/40 font-black uppercase tracking-widest text-center">Contact IPCU Immediately for Lab Alerts</p>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-10"
          >
            {/* Header Summary */}
            <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-8">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Detected</label>
                  <div className="relative">
                     <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                       required
                       type="date" 
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-10 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                       value={formData.detectedAt}
                       onChange={e => setFormData({...formData, detectedAt: e.target.value})}
                     />
                  </div>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time Detected</label>
                  <div className="relative">
                     <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                       required
                       type="time" 
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-10 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                       value={formData.detectedTime}
                       onChange={e => setFormData({...formData, detectedTime: e.target.value})}
                     />
                  </div>
               </div>
               <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</label>
                  <div className="flex flex-wrap gap-2">
                     {(['Suspected', 'Under Investigation', 'Confirmed', 'Controlled', 'Closed'] as OutbreakStatus[]).map(s => (
                       <button
                         key={s}
                         type="button"
                         onClick={() => setFormData({...formData, status: s})}
                         className={cn(
                           "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                           formData.status === s 
                             ? "bg-slate-900 text-white border-transparent shadow-md"
                             : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                         )}
                       >
                         {s}
                       </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Reporting & Identification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               {/* Selection Groups */}
               <div className="space-y-8">
                  <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                     <div className="flex items-center gap-3">
                        <ClipboardList className="w-5 h-5 text-brand-primary" />
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Detection Source</h3>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {REPORTING_SOURCES.map(src => (
                          <label key={src} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                               checked={formData.reportingSrc?.includes(src)}
                               onChange={() => toggleArrayItem('reportingSrc', src)}
                             />
                             <span className="text-[11px] font-bold text-slate-700">{src}</span>
                          </label>
                        ))}
                     </div>
                  </div>

                  <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                     <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-brand-primary" />
                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Type of Outbreak</h3>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {OUTBREAK_TYPES.map(t => (
                          <label key={t} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                               checked={formData.type?.includes(t)}
                               onChange={() => toggleArrayItem('type', t)}
                             />
                             <span className="text-[11px] font-bold text-slate-700">{t}</span>
                          </label>
                        ))}
                     </div>
                  </div>
               </div>

               {/* Trigger Criteria */}
               <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                     <AlertOctagon className="w-5 h-5 text-rose-500" />
                     <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Trigger Criteria</h3>
                  </div>
                  <div className="space-y-3">
                     {TRIGGER_CRITERIA.map(c => (
                        <label key={c} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-brand-primary/30 transition-all group">
                           <input 
                             type="checkbox" 
                             className="w-5 h-5 rounded-lg border-slate-300 text-rose-500 focus:ring-rose-500/20"
                             checked={formData.triggerCriteria?.includes(c)}
                             onChange={() => toggleArrayItem('triggerCriteria', c)}
                           />
                           <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 group-hover:text-slate-900">{c}</span>
                        </label>
                     ))}
                  </div>
               </div>
            </div>

            {/* Case Line List */}
            <div className="space-y-6">
               <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                     <UserPlus className="w-5 h-5 text-brand-primary" />
                     <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Case Line List</h3>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddCase}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                     <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
               </div>

               <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full">
                        <thead>
                           <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Patient Name</th>
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Hosp Number</th>
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Unit</th>
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Onset Date</th>
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Symptoms</th>
                              <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">Outcome</th>
                              <th className="px-6 py-4"></th>
                           </tr>
                        </thead>
                        <tbody>
                           {(formData.lineList || []).map((row, idx) => (
                             <tr key={idx} className="border-b border-slate-50 last:border-0 group">
                               <td className="px-4 py-3">
                                 <input className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.patientName} onChange={e => handleCaseUpdate(idx, 'patientName', e.target.value)} />
                               </td>
                               <td className="px-4 py-3">
                                 <input className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.hospNo} onChange={e => handleCaseUpdate(idx, 'hospNo', e.target.value)} />
                               </td>
                               <td className="px-4 py-3">
                                 <input className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.unit} onChange={e => handleCaseUpdate(idx, 'unit', e.target.value)} />
                               </td>
                               <td className="px-4 py-3">
                                 <input type="date" className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.onSetDate} onChange={e => handleCaseUpdate(idx, 'onSetDate', e.target.value)} />
                               </td>
                               <td className="px-4 py-3">
                                 <input className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.symptoms} onChange={e => handleCaseUpdate(idx, 'symptoms', e.target.value)} />
                               </td>
                               <td className="px-4 py-3">
                                 <select className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white" value={row.outcome} onChange={e => handleCaseUpdate(idx, 'outcome', e.target.value)}>
                                   <option>Ongoing</option>
                                   <option>Recovered</option>
                                   <option>Transferred</option>
                                   <option>Expired</option>
                                 </select>
                               </td>
                               <td className="px-4 py-3 text-right">
                                 <button type="button" onClick={() => handleRemoveCase(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>

            {/* Epidemiologic & Findings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                  <div className="flex items-center gap-3">
                     <Search className="w-5 h-5 text-brand-primary" />
                     <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Epidemiologic Summary</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Index Case</label>
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.epidemiology?.indexCase} onChange={e => setFormData({...formData, epidemiology: {...formData.epidemiology!, indexCase: e.target.value}})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Cases</label>
                        <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.epidemiology?.totalCases} onChange={e => setFormData({...formData, epidemiology: {...formData.epidemiology!, totalCases: parseInt(e.target.value)}})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attack Rate (%)</label>
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.epidemiology?.attackRate} onChange={e => setFormData({...formData, epidemiology: {...formData.epidemiology!, attackRate: e.target.value}})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Possible Source</label>
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.epidemiology?.possibleSource} onChange={e => setFormData({...formData, epidemiology: {...formData.epidemiology!, possibleSource: e.target.value}})} />
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transmission Mode</label>
                     <div className="grid grid-cols-2 gap-2">
                        {TRANSMISSION_MODES.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleArrayItem('transmissionMode', m, 'epidemiology.transmissionMode')}
                            className={cn(
                              "px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border",
                              formData.epidemiology?.transmissionMode.includes(m)
                                ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                                : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                            )}
                          >
                            {m}
                          </button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                  <div className="flex items-center gap-3">
                     <Microscope className="w-5 h-5 text-brand-primary" />
                     <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Lab & Findings</h3>
                  </div>
                  <div className="space-y-6">
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                           <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Env. Swabbing</p>
                           <p className="text-[10px] font-bold text-slate-400">Surface or zone swabbing performed</p>
                        </div>
                        <button type="button" onClick={() => setFormData({...formData, findings: {...formData.findings!, envSwabbing: {...formData.findings!.envSwabbing, done: !formData.findings!.envSwabbing.done}}})} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", formData.findings?.envSwabbing.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                           {formData.findings?.envSwabbing.done ? 'DONE' : 'PENDING'}
                        </button>
                     </div>
                     <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div>
                           <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Water Testing</p>
                           <p className="text-[10px] font-bold text-slate-400">System testing performed</p>
                        </div>
                        <button type="button" onClick={() => setFormData({...formData, findings: {...formData.findings!, waterTesting: {...formData.findings!.waterTesting, done: !formData.findings!.waterTesting.done}}})} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", formData.findings?.waterTesting.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                           {formData.findings?.waterTesting.done ? 'DONE' : 'PENDING'}
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alert Organism</label>
                           <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.findings?.labAlerts.organism} onChange={e => setFormData({...formData, findings: {...formData.findings!, labAlerts: {...formData.findings!.labAlerts, organism: e.target.value}}})} />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resistance Pattern</label>
                           <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={formData.findings?.labAlerts.resistancePattern} onChange={e => setFormData({...formData, findings: {...formData.findings!, labAlerts: {...formData.findings!.labAlerts, resistancePattern: e.target.value}}})} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Control Measures */}
            <div className="p-8 bg-slate-100 rounded-[3rem] space-y-8">
               <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Control Measures Implemented</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-wrap gap-2">
                     {CONTROL_MEASURES.map(m => (
                       <button
                         key={m}
                         type="button"
                         onClick={() => toggleArrayItem('actions', m, 'controlMeasures.actions')}
                         className={cn(
                           "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                           formData.controlMeasures?.actions.includes(m)
                             ? "bg-white text-emerald-600 border-white shadow-md"
                             : "bg-slate-200/50 text-slate-500 border-transparent hover:bg-white/50"
                         )}
                       >
                         {m}
                       </button>
                     ))}
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-1.5 font-sans">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date Implemented</label>
                        <input type="date" className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none" value={formData.controlMeasures?.dateImplemented} onChange={e => setFormData({...formData, controlMeasures: {...formData.controlMeasures!, dateImplemented: e.target.value}})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsible Unit</label>
                        <input className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none" value={formData.controlMeasures?.responsibleUnit} onChange={e => setFormData({...formData, controlMeasures: {...formData.controlMeasures!, responsibleUnit: e.target.value}})} />
                     </div>
                  </div>
               </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-4 p-8 bg-white border-t border-slate-100 rounded-b-[3rem]">
               <button
                 type="button"
                 onClick={() => {
                   setView('LIST');
                   resetForm();
                 }}
                 className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-500 hover:bg-slate-50 transition-all"
               >
                 Cancel
               </button>
               <button
                 type="submit"
                 disabled={isSubmitting}
                 className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
               >
                 {isSubmitting ? 'Submitting...' : <><Save className="w-4 h-4" /> Save Investigation Report</>}
               </button>
            </div>
          </motion.form>
        </AnimatePresence>
      )}
    </div>
  );
}
