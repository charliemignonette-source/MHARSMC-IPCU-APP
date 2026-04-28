import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  Plus,
  ArrowRight,
  Info,
  Calendar,
  Syringe,
  Ghost,
  XCircle,
  FileText,
  User,
  Activity,
  Heart,
  ClipboardCheck,
  Search,
  Filter,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  doc, 
  updateDoc,
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, NSIReport, NSIStatus, NSIExposureType, NSIDevice, NSIActivity } from '../types';
import { UNITS, NSI_CONSTANTS } from '../constants';
import { cn, formatDate } from '../lib/utils';

interface NSIProps {
  user: UserProfile | null;
}

export default function NSI({ user }: NSIProps) {
  const [reports, setReports] = useState<NSIReport[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedReport, setSelectedReport] = useState<NSIReport | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard' | 'list'>(
    user?.role === 'ADMIN' || user?.role === 'IPCN' ? 'dashboard' : 'form'
  );

  const isValidator = useMemo(() => {
    return user?.role === 'ADMIN' || user?.role === 'IPCN' || 
           user?.email === 'mharmc.hipc@gmail.com' || user?.email === 'alleiagurl@gmail.com';
  }, [user]);

  // Form State
  const initialFormState = {
    incident: {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      unit: user?.unit || UNITS[0],
      exposureType: 'Needle-stick' as NSIExposureType,
      exposureOther: '',
      deviceInvolved: 'Hollow-bore needle' as NSIDevice,
      deviceOther: '',
      activity: 'Recapping' as NSIActivity,
      activityOther: ''
    },
    staff: {
      name: user?.name || '',
      position: 'Nurse',
      positionOther: '',
      employmentStatus: 'Regular' as const,
      hepBStatus: 'Complete' as const
    },
    source: {
      name: '',
      hospNo: '',
      diagnosis: '',
      risks: [] as string[],
      riskOther: ''
    },
    description: {
      narrative: '',
      ppeWorn: false,
      properDisposal: false,
      safetyDeviceActivated: 'N/A' as const
    },
    actions: {
      firstAid: [] as string[],
      reportedTo: [] as string[],
      pep: 'Unknown' as const
    }
  };

  const [formData, setFormData] = useState(initialFormState);

  // Validation State
  const [validationData, setValidationData] = useState({
    classification: 'Significant Exposure' as const,
    rootCauses: [] as string[],
    rootCauseOther: '',
    contributingFactors: [] as string[],
    factorOther: '',
    decision: 'VALIDATED' as NSIStatus,
    correctiveActions: [] as string[],
    actionOther: ''
  });

  useEffect(() => {
    if (!user) return;
    
    const baseQuery = collection(db, 'nsi_reports');
    let q;
    
    if (isValidator) {
      q = query(baseQuery, orderBy('createdAt', 'desc'));
    } else {
      q = query(baseQuery, where('reporterId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NSIReport)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'nsi_reports');
    });
    return () => unsubscribe();
  }, [user, isValidator]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthReports = reports.filter(r => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date();
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && r.status === 'VALIDATED';
    });

    const unitCounts: Record<string, number> = {};
    const causeCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};

    thisMonthReports.forEach(r => {
      unitCounts[r.incident.unit] = (unitCounts[r.incident.unit] || 0) + 1;
      r.validation?.rootCauses.forEach(c => {
        causeCounts[c] = (causeCounts[c] || 0) + 1;
      });
      deviceCounts[r.incident.deviceInvolved] = (deviceCounts[r.incident.deviceInvolved] || 0) + 1;
    });

    const topUnit = Object.entries(unitCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topCause = Object.entries(causeCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topDevice = Object.entries(deviceCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      total: thisMonthReports.length,
      topUnit,
      topCause,
      topDevice
    };
  }, [reports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'nsi_reports'), {
        reporterId: user.uid,
        reporterEmail: user.email,
        reporterName: user.name, // adding name
        createdAt: serverTimestamp(),
        status: 'PENDING',
        ...formData
      });
      setIsAdding(false);
      setFormData(initialFormState);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'nsi_reports');
    }
  };

  const handleValidate = async () => {
    if (!user || !selectedReport?.id) return;
    try {
      await updateDoc(doc(db, 'nsi_reports', selectedReport.id), {
        status: validationData.decision,
        validation: {
          ...validationData,
          validatorName: user.name,
          validatorId: user.uid,
          validatedAt: serverTimestamp()
        }
      });
      setSelectedReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'nsi_reports');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'IPCN')) return;
    if (!confirm('Are you sure you want to delete this exposure record? This action is permanent.')) return;
    try {
      await deleteDoc(doc(db, 'nsi_reports', id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `nsi_reports/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <Syringe className="w-6 h-6 sm:w-8 sm:h-8 text-rose-600" />
            NSI SURVEILLANCE
          </h2>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Needle-stick & Occupational Exposure Matrix</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl sm:rounded-2xl w-full lg:w-auto overflow-x-auto no-scrollbar">
          {(isValidator ? ['dashboard', 'list', 'form'] : ['form', 'list']).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={cn(
                "flex-1 lg:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === t ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' && isValidator && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bento-card bg-rose-600 text-white p-4 sm:p-6">
            <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 text-white">Monthly Incidents</h4>
            <div className="text-2xl sm:text-4xl font-black">{stats.total}</div>
            <p className="text-[8px] mt-2 opacity-80 uppercase font-bold tracking-tighter">Validated Cases Only</p>
          </div>
          <div className="bento-card bg-white p-4 sm:p-6 border border-slate-200">
            <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Highest Risk Unit</h4>
            <div className="text-sm sm:text-xl font-black text-slate-800 truncate">{stats.topUnit}</div>
          </div>
          <div className="bento-card bg-white p-4 sm:p-6 border border-slate-200">
            <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Primary Device</h4>
            <div className="text-sm sm:text-xl font-black text-slate-800 truncate">{stats.topDevice}</div>
          </div>
          <div className="bento-card bg-white p-4 sm:p-6 border border-slate-200">
            <h4 className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Common Cause</h4>
            <div className="text-[10px] sm:text-xs font-black text-slate-800 leading-tight line-clamp-2">{stats.topCause}</div>
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bento-card bg-white overflow-hidden border border-rose-100">
            <div className="bg-rose-600 p-8 text-white">
              <div className="flex items-center gap-4 mb-4">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-tight">Immediate Exposure Report</h3>
              </div>
              <p className="text-xs font-medium text-rose-100 max-w-2xl leading-relaxed">
                This form triggers an immediate IPCU notification. Ensure all required fields are accurate for proper PEP assessment and baseline surveillance.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-12">
              {/* Incident Details */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
                  <Clock className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Incident Matrix</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Date of Incident</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.date}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, date: e.target.value}})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Time</label>
                    <input 
                      type="time"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.time}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, time: e.target.value}})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Unit / Area</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.unit}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, unit: e.target.value}})}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Exposure Type</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.exposureType}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, exposureType: e.target.value as any}})}
                    >
                      {NSI_CONSTANTS.EXPOSURE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {formData.incident.exposureType === 'Other' && (
                      <input 
                        placeholder="Specify exposure type..."
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                        value={formData.incident.exposureOther}
                        onChange={e => setFormData({...formData, incident: {...formData.incident, exposureOther: e.target.value}})}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Device Involved</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.deviceInvolved}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, deviceInvolved: e.target.value as any}})}
                    >
                      {NSI_CONSTANTS.DEVICES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {formData.incident.deviceInvolved === 'Other' && (
                      <input 
                        placeholder="Specify device..."
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                        value={formData.incident.deviceOther}
                        onChange={e => setFormData({...formData, incident: {...formData.incident, deviceOther: e.target.value}})}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Activity</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.incident.activity}
                      onChange={e => setFormData({...formData, incident: {...formData.incident, activity: e.target.value as any}})}
                    >
                      {NSI_CONSTANTS.ACTIVITIES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {formData.incident.activity === 'Other' && (
                      <input 
                        placeholder="Specify activity..."
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                        value={formData.incident.activityOther}
                        onChange={e => setFormData({...formData, incident: {...formData.incident, activityOther: e.target.value}})}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Exposed Staff Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Exposed Personnel Details</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Full Name</label>
                    <input 
                      placeholder="Personnel Name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.staff.name}
                      onChange={e => setFormData({...formData, staff: {...formData.staff, name: e.target.value}})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Position</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.staff.position}
                      onChange={e => setFormData({...formData, staff: {...formData.staff, position: e.target.value}})}
                    >
                      {NSI_CONSTANTS.POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {formData.staff.position === 'Other' && (
                      <input 
                        placeholder="Specify position..."
                        className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                        value={formData.staff.positionOther}
                        onChange={e => setFormData({...formData, staff: {...formData.staff, positionOther: e.target.value}})}
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Employment Status</label>
                    <div className="flex gap-4">
                      {['Regular', 'Contractual', 'Trainee'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, staff: {...formData.staff, employmentStatus: s as any}})}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            formData.staff.employmentStatus === s ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">HepB Vaccination Status</label>
                    <div className="flex gap-4">
                      {['Complete', 'Incomplete', 'Unknown'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, staff: {...formData.staff, hepBStatus: s as any}})}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            formData.staff.hepBStatus === s ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Patient Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
                  <Activity className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Source Profile (If Known)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Patient Name</label>
                    <input 
                      placeholder="Optional"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                      value={formData.source?.name}
                      onChange={e => setFormData({...formData, source: {...formData.source!, name: e.target.value}})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Hosp Number</label>
                    <input 
                      placeholder="Optional"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                      value={formData.source?.hospNo}
                      onChange={e => setFormData({...formData, source: {...formData.source!, hospNo: e.target.value}})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Diagnosis</label>
                    <input 
                      placeholder="Optional"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                      value={formData.source?.diagnosis}
                      onChange={e => setFormData({...formData, source: {...formData.source!, diagnosis: e.target.value}})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Known Infectious Risks</label>
                  <div className="flex flex-wrap gap-3">
                    {NSI_CONSTANTS.RISKS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          const current = formData.source?.risks || [];
                          const next = current.includes(r) ? current.filter(i => i !== r) : [...current, r];
                          setFormData({...formData, source: {...formData.source!, risks: next}});
                        }}
                        className={cn(
                          "px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                          formData.source?.risks.includes(r) ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-200" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {formData.source?.risks.includes('Other') && (
                    <input 
                      placeholder="Specify other risks..."
                      className="w-full mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500"
                      value={formData.source?.riskOther || ''}
                      onChange={e => setFormData({...formData, source: {...formData.source!, riskOther: e.target.value}})}
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
                  <FileText className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Incident Narrative</span>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Detailed Description of Event</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-medium h-32 resize-none outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="Describe exactly what happened step-by-step..."
                    value={formData.description.narrative}
                    onChange={e => setFormData({...formData, description: {...formData.description, narrative: e.target.value}})}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, description: {...formData.description, ppeWorn: !formData.description.ppeWorn}})}
                    className={cn(
                      "p-4 rounded-xl text-[10px] font-black tracking-widest uppercase border flex items-center justify-between transition-all",
                      formData.description.ppeWorn ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <span>PPE Worn Correctly?</span>
                    <CheckCircle2 className={cn("w-4 h-4", formData.description.ppeWorn ? "opacity-100" : "opacity-20")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, description: {...formData.description, properDisposal: !formData.description.properDisposal}})}
                    className={cn(
                      "p-4 rounded-xl text-[10px] font-black tracking-widest uppercase border flex items-center justify-between transition-all",
                      formData.description.properDisposal ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                    )}
                  >
                    <span>Proper Sharp Disposal?</span>
                    <CheckCircle2 className={cn("w-4 h-4", formData.description.properDisposal ? "opacity-100" : "opacity-20")} />
                  </button>
                   <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Safety Device Activated?</label>
                    <div className="flex bg-slate-50 rounded-xl p-1">
                      {['Yes', 'No', 'N/A'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFormData({...formData, description: {...formData.description, safetyDeviceActivated: v as any}})}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                            formData.description.safetyDeviceActivated === v ? "bg-white text-rose-600 shadow-sm" : "text-slate-400"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
                  <Heart className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Immediate Actions Matrix</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-slate-400">First Aid Executed</label>
                      <div className="grid grid-cols-1 gap-2">
                        {NSI_CONSTANTS.FIRST_AID.map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              const current = formData.actions.firstAid;
                              const next = current.includes(f) ? current.filter(i => i !== f) : [...current, f];
                              setFormData({...formData, actions: {...formData.actions, firstAid: next}});
                            }}
                            className={cn(
                              "text-left px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-tight border transition-all",
                              formData.actions.firstAid.includes(f) ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-50 text-slate-400"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                        {formData.actions.firstAid.includes('Other') && (
                          <input 
                            placeholder="Specify other first aid..."
                            className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                            value={formData.actions.firstAidOther || ''}
                            onChange={e => setFormData({...formData, actions: {...formData.actions, firstAidOther: e.target.value}})}
                          />
                        )}
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400">Reported To</label>
                        <div className="flex flex-wrap gap-2">
                          {NSI_CONSTANTS.REPORTED_TO.map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                const current = formData.actions.reportedTo;
                                const next = current.includes(r) ? current.filter(i => i !== r) : [...current, r];
                                setFormData({...formData, actions: {...formData.actions, reportedTo: next}});
                              }}
                              className={cn(
                                "px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                formData.actions.reportedTo.includes(r) ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-400"
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400">PEP Initiation Status (Initial)</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Initiated', 'Not indicated', 'Declined', 'Unknown'].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setFormData({...formData, actions: {...formData.actions, pep: p as any}})}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                formData.actions.pep === p ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-100 text-slate-400"
                              )}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="flex gap-4 pt-8">
                <button 
                  type="submit"
                  className="flex-1 bg-rose-600 text-white rounded-2xl py-5 shadow-2xl shadow-rose-900/30 text-[12px] font-black uppercase tracking-[0.2em] hover:bg-rose-700 transition-all active:scale-[0.98]"
                >
                  Submit Formal Exposure Record
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                placeholder="Search staff, device, or unit..." 
                className="bg-transparent border-none text-xs font-bold w-full outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:bg-slate-50">
                <Filter className="w-4 h-4" />
               </button>
               <button className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:bg-slate-50">
                <Download className="w-4 h-4" />
               </button>
            </div>
          </div>

          <div className="bento-card bg-white border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Unit</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Staff Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Device</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Validation</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="text-[11px] font-black text-slate-800">{report.incident.date}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{report.incident.unit}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-[11px] font-bold text-slate-700">{report.staff.name}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{report.staff.position}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-[11px] font-bold text-slate-800 truncate max-w-[150px]">{report.incident.exposureType}</div>
                        <div className="text-[9px] font-bold text-rose-500 uppercase tracking-tight">{report.incident.deviceInvolved}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-1",
                          report.status === 'VALIDATED' ? "bg-emerald-100 text-emerald-700" : 
                          report.status === 'NOT_NSI' ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                        )}>
                          {report.status}
                        </div>
                        {report.validation && (
                          <div className="text-[8px] font-bold text-slate-400 uppercase">Valid: {report.validation.classification}</div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSelectedReport(report)}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
                          </button>
                          {user?.role === 'ADMIN' && (
                            <button 
                              onClick={() => handleDelete(report.id!)}
                              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reports.length === 0 && (
              <div className="py-24 flex flex-col items-center justify-center opacity-20">
                <Ghost className="w-16 h-16 mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">No data in line list</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail / Validation Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl bg-white sm:rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="bg-rose-500 p-2 rounded-xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight">Record #{selectedReport.id?.slice(-6)}</h3>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source: {selectedReport.reporterEmail}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    {user?.role === 'ADMIN' && (
                      <button 
                        onClick={() => handleDelete(selectedReport.id!)}
                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50/10 rounded-lg transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors font-bold text-slate-400">
                      <XCircle className="w-6 h-6" />
                    </button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 custom-scrollbar">
                 <div className="space-y-8">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Incident Summary
                       </h4>
                       <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exposed Staff</label>
                                <p className="text-sm font-bold text-slate-800">{selectedReport.staff.name}</p>
                             </div>
                             <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exposure Type</label>
                                <p className="text-sm font-bold text-rose-600">{selectedReport.incident.exposureType}</p>
                             </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Narrative</label>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium mt-1 bg-white p-4 rounded-xl border border-slate-100 italic">
                                "{selectedReport.description.narrative}"
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">PPE Worn</p>
                              <div className={cn("text-[9px] font-black", selectedReport.description.ppeWorn ? "text-emerald-500" : "text-rose-400")}>
                                {selectedReport.description.ppeWorn ? "YES" : "NO"}
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Disposal</p>
                              <div className={cn("text-[9px] font-black", selectedReport.description.properDisposal ? "text-emerald-500" : "text-rose-400")}>
                                {selectedReport.description.properDisposal ? "PROPER" : "IMPROPER"}
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Device Safety</p>
                              <div className="text-[9px] font-black text-slate-500">
                                {selectedReport.description.safetyDeviceActivated}
                              </div>
                            </div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" />
                        Immediate Response
                       </h4>
                       <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2 bento-card p-4 border border-slate-100 space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">First Aid Done</label>
                            <div className="flex flex-wrap gap-1">
                               {selectedReport.actions.firstAid.map(f => (
                                 <span key={f} className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[8px] font-bold uppercase">{f}</span>
                               ))}
                            </div>
                          </div>
                          <div className="bento-card p-4 border border-slate-100 text-center space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">PEP</label>
                             <p className="text-[10px] font-black text-rose-600">{selectedReport.actions.pep}</p>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8 md:border-l border-slate-100 md:pl-12">
                   {isValidator ? (
                     <div className="space-y-8">
                       <div className="flex items-center gap-3 mb-2">
                         <ClipboardCheck className="w-5 h-5 text-rose-600" />
                         <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">IPCU Validation Matrix</h4>
                       </div>
                       
                       <div className="space-y-6">
                         <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400">Exposure Classification</label>
                              <div className="flex bg-slate-50 rounded-xl p-1">
                                {['Significant Exposure', 'Non-significant Exposure'].map(v => (
                                  <button
                                    key={v}
                                    onClick={() => setValidationData({...validationData, classification: v as any})}
                                    className={cn(
                                      "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                      validationData.classification === v ? "bg-white text-rose-600 shadow-sm" : "text-slate-400"
                                    )}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-400">Root Cause Analysis (RCA)</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {NSI_CONSTANTS.ROOT_CAUSES.map(c => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                      const current = validationData.rootCauses;
                                      const next = current.includes(c) ? current.filter(i => i !== c) : [...current, c];
                                      setValidationData({...validationData, rootCauses: next});
                                    }}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border",
                                      validationData.rootCauses.includes(c) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                                    )}
                                  >
                                    {c}
                                  </button>
                                ))}
                                {validationData.rootCauses.includes('Other') && (
                                  <input 
                                    placeholder="Specify root cause..."
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
                                    value={validationData.rootCauseOther}
                                    onChange={e => setValidationData({...validationData, rootCauseOther: e.target.value})}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-400">Contributing Factors</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {NSI_CONSTANTS.CONTRIBUTING_FACTORS.map(f => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => {
                                      const current = validationData.contributingFactors;
                                      const next = current.includes(f) ? current.filter(i => i !== f) : [...current, f];
                                      setValidationData({...validationData, contributingFactors: next});
                                    }}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border",
                                      validationData.contributingFactors.includes(f) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                                    )}
                                  >
                                    {f}
                                  </button>
                                ))}
                                {validationData.contributingFactors.includes('Other') && (
                                  <input 
                                    placeholder="Specify factor..."
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
                                    value={validationData.factorOther}
                                    onChange={e => setValidationData({...validationData, factorOther: e.target.value})}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-400">Corrective Actions</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {NSI_CONSTANTS.CORRECTIVE_ACTIONS.map(a => (
                                  <button
                                    key={a}
                                    type="button"
                                    onClick={() => {
                                      const current = validationData.correctiveActions;
                                      const next = current.includes(a) ? current.filter(i => i !== a) : [...current, a];
                                      setValidationData({...validationData, correctiveActions: next});
                                    }}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border",
                                      validationData.correctiveActions.includes(a) ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400"
                                    )}
                                  >
                                    {a}
                                  </button>
                                ))}
                                {validationData.correctiveActions.includes('Other') && (
                                  <input 
                                    placeholder="Specify action..."
                                    className="col-span-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-900"
                                    value={validationData.actionOther}
                                    onChange={e => setValidationData({...validationData, actionOther: e.target.value})}
                                  />
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                               <label className="text-[10px] font-black uppercase text-slate-400">Final IPCU Decision</label>
                               <div className="flex bg-slate-50 rounded-xl p-1">
                                  {['VALIDATED', 'NOT_NSI', 'NEEDS_MORE_DATA'].map(d => (
                                    <button
                                      key={d}
                                      onClick={() => setValidationData({...validationData, decision: d as any})}
                                      className={cn(
                                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        validationData.decision === d ? "bg-white text-rose-600 shadow-sm" : "text-slate-400"
                                      )}
                                    >
                                      {d}
                                    </button>
                                  ))}
                               </div>
                            </div>
                         </div>

                         <button 
                          onClick={handleValidate}
                          className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                         >
                            Authorize Validation Change
                         </button>
                       </div>
                     </div>
                   ) : (
                     <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                        <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Validation Protected</h4>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 max-w-[200px]">Validation is exclusively accessible to IPCU Validators and Administrators</p>
                     </div>
                   )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
