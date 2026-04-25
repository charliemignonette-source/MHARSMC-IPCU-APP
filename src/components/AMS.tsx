import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  FlaskConical, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Search,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AMSRequest, AMSStatus } from '../types';
import { UNITS, ANTIBIOTICS } from '../constants';
import { cn, formatDate } from '../lib/utils';

export default function AMS({ user }: { user: UserProfile | null }) {
  const [requests, setRequests] = useState<AMSRequest[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AMSStatus | 'ALL'>('ALL');
  const [formData, setFormData] = useState<Partial<AMSRequest>>({
    type: 'RESTRICTED_USE',
    hospNo: '',
    location: '',
    firstName: '',
    middleName: '',
    lastName: '',
    patientName: '',
    date: new Date().toISOString().split('T')[0],
    drugAllergy: { hasAllergy: false, specify: '' },
    sex: 'Male',
    dob: '',
    age: '',
    ageUnit: 'Years',
    weight: '',
    height: '',
    serumCreatinine: '',
    creatinineClearance: '',
    sgpt: '',
    sgot: '',
    antimicrobialsRequested: [],
    drugDoses: {},
    dosingRegimen: '',
    indicationForUse: 'Empiric',
    focusOfInfection: [],
    infectiousDiagnosis: '',
    cultureSent: [],
    cultureDateSent: new Date().toISOString().split('T')[0],
    previousAntibiotics: [],
    immunocompromisingCondition: [],
    microbiology: {
      date: new Date().toISOString().split('T')[0],
      specimen: '',
      organism: '',
      resistancePattern: ''
    },
    criticallyIll: {
      sepsisCriteria: [],
      organDysfunctionCriteria: []
    },
    unit: UNITS[0],
    antibiotic: '',
    dose: '',
    diagnosis: '',
    justification: '',
    prescriberContact: '',
    requestingPhysician: '',
    durationRequested: '',
    status: 'PENDING'
  });

  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});
  const [reviewPhysicians, setReviewPhysicians] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const baseQuery = collection(db, 'ams_requests');
    let q;

    if (user.role === 'ADMIN' || user.role === 'IPCN' || user.role === 'APPROVER' || user.role === 'PHARMACY') {
      q = query(baseQuery, orderBy('createdAt', 'desc'));
    } else {
      q = query(baseQuery, where('prescriberId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AMSRequest));
      setRequests(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ams_requests');
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const patientName = `${formData.firstName} ${formData.middleName ? formData.middleName + ' ' : ''}${formData.lastName}`;
      const now = new Date();
      const dateTimeRequested = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      await addDoc(collection(db, 'ams_requests'), {
        ...formData,
        patientName,
        dateTimeRequested,
        prescriberId: user.uid,
        prescriberEmail: user.email || '',
        status: 'PENDING',
        isValidated: false,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ams_requests');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'RESTRICTED_USE',
      hospNo: '',
      location: '',
      firstName: '',
      middleName: '',
      lastName: '',
      patientName: '',
      date: new Date().toISOString().split('T')[0],
      drugAllergy: { hasAllergy: false, specify: '' },
      sex: 'Male',
      dob: '',
      age: '',
      ageUnit: 'Years',
      weight: '',
      height: '',
      serumCreatinine: '',
      creatinineClearance: '',
      sgpt: '',
      sgot: '',
      antimicrobialsRequested: [],
      drugDoses: {},
      dosingRegimen: '',
      indicationForUse: 'Empiric',
      focusOfInfection: [],
      infectiousDiagnosis: '',
      cultureSent: [],
      cultureDateSent: new Date().toISOString().split('T')[0],
      previousAntibiotics: [],
      immunocompromisingCondition: [],
      microbiology: {
        date: new Date().toISOString().split('T')[0],
        specimen: '',
        organism: '',
        resistancePattern: ''
      },
      criticallyIll: {
        sepsisCriteria: [],
        organDysfunctionCriteria: []
      },
      unit: UNITS[0],
      antibiotic: '',
      dose: '',
      diagnosis: '',
      justification: '',
      prescriberContact: '',
      requestingPhysician: '',
      durationRequested: '',
      status: 'PENDING'
    });
  };

  const handleAction = async (requestId: string, status: AMSStatus) => {
    if (!user) return;
    const remarks = reviewRemarks[requestId] || '';
    const requestingPhysician = reviewPhysicians[requestId] || '';
    const now = new Date();
    const dateTimeApproved = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    try {
      const updateData: any = {
        status,
        remarks,
        reviewerId: user.uid,
        reviewerEmail: user.email,
        reviewedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      };

      if (status === 'APPROVED') {
        updateData.dateTimeApproved = dateTimeApproved;
      }

      if (requestingPhysician) {
        updateData.requestingPhysician = requestingPhysician;
      }

      await updateDoc(doc(db, 'ams_requests', requestId), updateData);
      
      setReviewRemarks(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setReviewPhysicians(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `ams_requests/${requestId}`);
    }
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isApprover = user?.role === 'APPROVER' || user?.role === 'ADMIN' || user?.role === 'IPCN';
  const isPharmacy = user?.role === 'PHARMACY' || user?.role === 'ADMIN';

  const filteredRequests = (activeFilter === 'ALL' 
    ? requests 
    : requests.filter(r => r.status === activeFilter)
  ).filter(r => {
    if (user?.role === 'PHARMACY') return r.status === 'APPROVED' || r.status === 'DISPENSED';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">AMS Stewardship</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Antimicrobial stewardship and restriction protocols</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">New Drug Request</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Statistics highlights in a bento-like sidebar for this view - Only for IPCU/Admin/Physician */}
        {(user?.role !== 'USER') && (
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bento-card p-6 bg-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-full -mr-16 -mt-16 blur-2xl opacity-40" />
              <div className="relative">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Unit Pressure</h3>
                <div className="space-y-4">
                  {['ICU A', 'WARD C', 'NICU'].map((unit, i) => (
                    <div key={unit}>
                      <div className="flex justify-between text-xs font-bold mb-1.5 flex items-center">
                        <span className="text-slate-700">{unit}</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded uppercase", i === 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500")}>
                          {i === 0 ? 'High' : 'Normal'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: i === 0 ? '85%' : i === 1 ? '45%' : '15%' }}
                          className={cn("h-full rounded-full", i === 0 ? "bg-rose-500" : "bg-teal-500")} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-brand-dark p-6 rounded-3xl text-white shadow-xl shadow-slate-900/10">
              <div className="flex items-center gap-3 mb-4">
                <ShieldAlert className="w-6 h-6 text-teal-400" />
                <h3 className="text-sm font-bold uppercase tracking-tight">Rapid Response Protocol</h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-6">
                All restricted antimicrobials require mandatory review within 72 hours of initiation. 
                Manual overrides must be documented with emergent clinical justification.
              </p>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-black">12.4</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">AVG DAILY REQ</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">+1.2%</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">VS LW</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ledger - The main list */}
        <div className={cn(
          "col-span-12 bento-card bg-white min-h-[500px] flex flex-col",
          user?.role !== 'USER' ? "lg:col-span-8" : "lg:col-span-12"
        )}>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              {(user?.role === 'PHARMACY' ? ['ALL', 'APPROVED', 'DISPENSED'] : ['ALL', 'PENDING', 'APPROVED']).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f as any)}
                  className={cn(
                    "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                    activeFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-xl bg-white">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Search Drug..." className="text-[10px] font-bold focus:outline-none w-24 uppercase" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredRequests.map((req) => (
              <div key={req.id} className="group border border-transparent hover:border-slate-100 rounded-2xl transition-all">
                <div 
                  className="p-4 flex flex-col gap-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === req.id ? null : req.id!)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 flex items-center justify-center rounded-2xl",
                        req.status === 'PENDING' ? "bg-amber-100/50 text-amber-600" : req.status === 'APPROVED' ? "bg-emerald-100/50 text-emerald-600" : "bg-rose-100/50 text-rose-600"
                      )}>
                        <FlaskConical className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-sm text-slate-800 uppercase tracking-tight">{req.antibiotic}</h4>
                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.unit}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight opacity-80">{req.type.replace('_', ' ')} • MISSION CRITICAL</p>
                           {req.dateTimeRequested && <p className="text-[9px] font-bold text-slate-400 uppercase">Requested: {req.dateTimeRequested}</p>}
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Prescribed by: {req.requestingPhysician || req.prescriberEmail}</p>
                           {req.isValidated && (
                              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                                 <CheckCircle2 className="w-2.5 h-2.5" />
                                 Validated by: {req.validatedBy}
                              </p>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expandedId === req.id && "rotate-180")} />
                      {req.isValidated && <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" />}
                      {req.status === 'PENDING' && isApprover ? (
                        <div className="flex flex-col gap-2 items-end" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAction(req.id!, 'APPROVED'); }}
                              className="p-2 bg-white rounded-lg text-emerald-600 hover:text-emerald-700 shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[9px] font-bold uppercase">Approve</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAction(req.id!, 'DENIED'); }}
                              className="p-2 bg-white rounded-lg text-rose-600 hover:text-rose-700 shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span className="text-[9px] font-bold uppercase">Deny</span>
                            </button>
                          </div>
                           <div className="flex flex-col gap-1 w-48">
                              <input 
                                type="text"
                                placeholder="Requesting Physician..."
                                className="text-[9px] font-bold uppercase tracking-tight bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full focus:ring-1 focus:ring-brand-primary outline-none"
                                value={reviewPhysicians[req.id!] || req.requestingPhysician || ''}
                                onChange={(e) => setReviewPhysicians(prev => ({ ...prev, [req.id!]: e.target.value }))}
                              />
                              <input 
                                type="text"
                                placeholder="Add review remarks..."
                                className="text-[9px] font-bold uppercase tracking-tight bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 w-full focus:ring-1 focus:ring-brand-primary outline-none"
                                value={reviewRemarks[req.id!] || ''}
                                onChange={(e) => setReviewRemarks(prev => ({ ...prev, [req.id!]: e.target.value }))}
                              />
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          {req.dateTimeApproved && <p className="text-[9px] font-black text-brand-primary uppercase">Approved: {req.dateTimeApproved}</p>}
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                              req.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : 
                              req.status === 'DISPENSED' ? "bg-sky-100 text-sky-700" :
                              req.status === 'DENIED' ? "bg-rose-100 text-rose-700" : 
                              "bg-amber-100 text-amber-700"
                            )}>
                              {req.status}
                            </div>
                            {isPharmacy && req.status === 'APPROVED' && (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await updateDoc(doc(db, 'ams_requests', req.id!), {
                                      status: 'DISPENSED',
                                      dispensedBy: user?.email || user?.name,
                                      dispensedAt: serverTimestamp()
                                    });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, `ams_requests/${req.id}`);
                                  }
                                }}
                                className="px-3 py-1.5 bg-sky-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-sky-500/20 active:scale-95 transition-all ml-2"
                              >
                                Dispense
                              </button>
                            )}
                            {(user?.role === 'IPCN' || user?.role === 'ADMIN') && !req.isValidated && (
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await updateDoc(doc(db, 'ams_requests', req.id!), {
                                      isValidated: true,
                                      validatedBy: user.email,
                                      validatedAt: serverTimestamp()
                                    });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, `ams_requests/${req.id}`);
                                  }
                                }}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {req.remarks && (
                            <p className="text-[9px] font-bold text-slate-500 italic">"{req.remarks}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-8 pl-16">
                     <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 opacity-50">Justification Summary</p>
                        <p className="text-xs text-slate-700 font-medium italic truncate max-w-md">"{req.justification || req.diagnosis}"</p>
                     </div>
                     <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 border-l border-slate-100 pl-8">
                        <div className="flex flex-col items-end">
                           <span className="uppercase">{req.patientName}</span>
                           <span className="font-mono text-[9px] opacity-60 tracking-tight">{req.hospNo}</span>
                        </div>
                     </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === req.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-slate-50 border-t border-slate-100"
                    >
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Patient Details</p>
                               <div className="space-y-1">
                                  <p className="text-xs font-bold text-slate-700">{req.sex}, {req.age} {req.ageUnit}</p>
                                  <p className="text-xs text-slate-600">DOB: {req.dob}</p>
                                  <p className="text-xs text-slate-600">Loc: {req.location}</p>
                               </div>
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Drug Allergy</p>
                               <p className="text-xs font-bold text-slate-700">{req.drugAllergy?.hasAllergy ? `YES: ${req.drugAllergy.specify}` : 'NONE'}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Vital Parameters</p>
                               <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  <p className="text-xs text-slate-500 uppercase">Weight: <span className="text-slate-900 font-bold">{req.weight}kg</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Height: <span className="text-slate-900 font-bold">{req.height}cm</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Creatinine: <span className="text-slate-900 font-bold">{req.serumCreatinine}</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Clearance: <span className="text-slate-900 font-bold">{req.creatinineClearance}</span></p>
                               </div>
                            </div>

                            {req.previousAntibiotics && req.previousAntibiotics.length > 0 && (
                               <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Previous Antibiotics</p>
                                  <div className="space-y-2">
                                     {req.previousAntibiotics.map((pa, idx) => (
                                       <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-[10px]">
                                          <div className="flex justify-between items-start mb-1">
                                             <span className="font-bold text-slate-800">{pa.name}</span>
                                             <span className="text-slate-500">{pa.startDate} - {pa.stopDate}</span>
                                          </div>
                                          <p className="text-slate-600">Dose: {pa.dose}</p>
                                          <p className="text-slate-500 italic">Indication: {pa.indication}</p>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}

                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Indication & Focus</p>
                               <p className="text-xs font-bold text-brand-primary uppercase underline">{req.indicationForUse}</p>
                               <p className="text-[10px] text-slate-600 mt-1">{req.focusOfInfection?.join(', ')}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Order Summary</p>
                               <div className="space-y-2">
                                  {req.type === 'EXTENSION_7D' && req.durationRequested && (
                                     <div className="mb-2 px-3 py-1.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                                        <p className="text-[10px] font-black text-brand-primary uppercase">Extension for {req.durationRequested} Days</p>
                                     </div>
                                  )}
                                  {req.antimicrobialsRequested?.map(drug => (
                                    <div key={drug} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100">
                                       <span className="text-xs font-bold text-slate-900">{drug}</span>
                                       <span className="text-[10px] font-mono bg-slate-50 px-2 py-0.5 rounded text-slate-600">{req.drugDoses?.[drug] || 'No dose info'}</span>
                                    </div>
                                  ))}
                               </div>
                               <p className="text-[10px] text-slate-500 mt-2 italic">Remarks: {req.dosingRegimen}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cultures & Conditions</p>
                               <p className="text-[10px] text-slate-600 font-bold uppercase">{req.cultureSent?.join(', ') || 'NONE SENT'} {req.cultureDateSent && `(${req.cultureDateSent})`}</p>
                               <div className="mt-1 flex flex-wrap gap-1">
                                  {req.immunocompromisingCondition?.map(c => (
                                    <span key={c} className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase">{c}</span>
                                  ))}
                               </div>
                            </div>
                         </div>

                         <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                            {req.criticallyIll && (req.criticallyIll.sepsisCriteria.length > 0 || req.criticallyIll.organDysfunctionCriteria.length > 0) && (
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Critical Illness Criteria</p>
                                <div className="space-y-3">
                                   {req.criticallyIll.sepsisCriteria.length > 0 && (
                                     <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mb-1">Sepsis</p>
                                        <div className="flex flex-wrap gap-1">
                                           {req.criticallyIll.sepsisCriteria.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 font-medium">{s}</span>)}
                                        </div>
                                     </div>
                                   )}
                                   {req.criticallyIll.organDysfunctionCriteria.length > 0 && (
                                     <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mb-1">Organ Dysfunction</p>
                                        <div className="flex flex-wrap gap-1">
                                           {req.criticallyIll.organDysfunctionCriteria.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100 font-medium">{s}</span>)}
                                        </div>
                                     </div>
                                   )}
                                </div>
                              </div>
                            )}

                            {req.indicationForUse === 'Definitive' && req.microbiology && (
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary mb-2">Microbiology Result (Definitive)</p>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <p className="text-xs font-black text-slate-900">{req.microbiology.organism}</p>
                                         <p className="text-[10px] text-slate-500 uppercase font-bold">{req.microbiology.specimen} • {req.microbiology.date}</p>
                                      </div>
                                      <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black rounded uppercase">
                                         {req.microbiology.resistancePattern}
                                      </span>
                                   </div>
                                </div>
                              </div>
                            )}
                         </div>

                         <div className="col-span-full pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Detailed Justification</p>
                               <p className="text-xs text-slate-700 leading-relaxed font-serif italic">"{req.justification || 'No detailed justification provided.'}"</p>
                            </div>
                            {req.requestingPhysician && (
                               <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Requesting Physician</p>
                                 <p className="text-sm font-bold text-slate-900">{req.requestingPhysician}</p>
                               </div>
                            )}
                            {req.prescriberContact && (
                               <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Physician Contact</p>
                                 <p className="text-sm font-bold text-slate-900">{req.prescriberContact}</p>
                               </div>
                            )}
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-brand-primary p-2 rounded-xl text-white">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">AMS Stewardship Request</h3>
                  </div>
                  
                  <div className="flex bg-slate-200 p-1 rounded-xl">
                    {[
                      { id: 'RESTRICTED_USE', label: 'Initial Request' },
                      { id: 'EXTENSION_7D', label: '7-Day Extension' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t.id as any })}
                        className={cn(
                          "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                          formData.type === t.id ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col h-[85vh]">
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Patient Identity */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Patient Information</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hospital Number</label>
                          <input 
                            required
                            className="text-input" 
                            placeholder="Hosp Number"
                            value={formData.hospNo}
                            onChange={e => setFormData({...formData, hospNo: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Location / Ward</label>
                          <input 
                            className="text-input" 
                            placeholder="Unit/Bed"
                            value={formData.location}
                            onChange={e => setFormData({...formData, location: e.target.value})}
                          />
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">First Name</label>
                             <input required className="text-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Name</label>
                             <input required className="text-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                          </div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Middle Name</label>
                          <input className="text-input" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                       </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sex</label>
                           <select className="text-input" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value as any})}>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                           </select>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Age</label>
                           <div className="flex gap-1">
                              <input className="text-input w-full" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                              <select className="text-input bg-slate-100" value={formData.ageUnit} onChange={e => setFormData({...formData, ageUnit: e.target.value as any})}>
                                <option value="Years">Y</option>
                                <option value="Months">M</option>
                                <option value="Days">D</option>
                              </select>
                           </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date of Birth</label>
                         <input type="date" className="text-input" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                      </div>
                    </div>

                    {/* Clinical Parameters */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Vital & Clinical Parameters</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Weight (kg)</label>
                             <input className="text-input" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Height (cm)</label>
                             <input className="text-input" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Serum Creatinine</label>
                             <input className="text-input" placeholder="mg/dL" value={formData.serumCreatinine} onChange={e => setFormData({...formData, serumCreatinine: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cr. Clearance</label>
                             <input className="text-input" placeholder="mL/min" value={formData.creatinineClearance} onChange={e => setFormData({...formData, creatinineClearance: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SGPT (IU/L)</label>
                             <input className="text-input" value={formData.sgpt} onChange={e => setFormData({...formData, sgpt: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SGOT (IU/L)</label>
                             <input className="text-input" value={formData.sgot} onChange={e => setFormData({...formData, sgot: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Previous Antibiotics Used</h4>
                    </div>

                    <div className="col-span-full space-y-4">
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="space-y-4">
                             {formData.previousAntibiotics?.map((ab, idx) => (
                               <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-white rounded-2xl border border-slate-100 relative group">
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const updated = [...(formData.previousAntibiotics || [])];
                                      updated.splice(idx, 1);
                                      setFormData({...formData, previousAntibiotics: updated});
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Antibiotic</label>
                                     <input className="text-input py-1.5" value={ab.name} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].name = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Dose</label>
                                     <input className="text-input py-1.5" value={ab.dose} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].dose = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Start Date</label>
                                     <input type="date" className="text-input py-1.5" value={ab.startDate} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].startDate = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Stop Date</label>
                                     <input type="date" className="text-input py-1.5" value={ab.stopDate} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].stopDate = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Indication</label>
                                     <input className="text-input py-1.5" value={ab.indication} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].indication = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                               </div>
                             ))}
                             <button
                               type="button"
                               onClick={() => setFormData({
                                 ...formData, 
                                 previousAntibiotics: [...(formData.previousAntibiotics || []), { name: '', dose: '', startDate: '', stopDate: '', indication: '' }]
                               })}
                               className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all flex items-center justify-center gap-2"
                             >
                               <Plus className="w-4 h-4" />
                               <span className="text-[10px] font-black uppercase tracking-widest">Add Previous Antibiotic Used</span>
                             </button>
                          </div>
                       </div>
                    </div>

                    {/* Order Details */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">
                        {formData.type === 'EXTENSION_7D' ? 'Extension Order Details' : 'Antimicrobial Order'}
                      </h4>
                      {formData.type === 'EXTENSION_7D' && (
                        <div className="flex items-center gap-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Duration (Days):</label>
                           <input 
                             className="w-16 text-center text-xs font-black bg-white border border-brand-primary/20 rounded-lg py-1 px-2 focus:ring-1 focus:ring-brand-primary outline-none"
                             value={formData.durationRequested}
                             onChange={e => setFormData({...formData, durationRequested: e.target.value})}
                           />
                        </div>
                      )}
                    </div>

                    <div className="col-span-full md:col-span-2 space-y-4">
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Antimicrobials Requested (Enter dose per drug)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                             {[
                               { id: 'micafungin', name: 'Micafungin' },
                               { id: 'aztreonam', name: 'Aztreonam' },
                               { id: 'cefepime_tazo', name: 'Cefepime + Tazobactam' },
                               { id: 'ceftaz_avi', name: 'Ceftazidime–Avibactam' },
                               { id: 'ertapenem', name: 'Ertapenem' },
                               { id: 'imipenem', name: 'Imipenem–Cilastatin' },
                               { id: 'meropenem', name: 'Meropenem' },
                               { id: 'colistin', name: 'Colistin / Polymyxin' },
                               { id: 'ampho_b', name: 'Amphotericin B' },
                               { id: 'linezolid', name: 'Linezolid' },
                               { id: 'vancomycin', name: 'Vancomycin' },
                               { id: 'voriconazole', name: 'Voriconazole' },
                               { id: 'others', name: 'Others' }
                             ].map(drug => (
                               <div key={drug.id} className="space-y-2">
                                 <label className="flex items-center gap-3 cursor-pointer group">
                                   <input 
                                     type="checkbox"
                                     className="w-5 h-5 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary"
                                     checked={formData.antimicrobialsRequested?.includes(drug.name)}
                                     onChange={e => {
                                        const current = formData.antimicrobialsRequested || [];
                                        const updated = e.target.checked ? [...current, drug.name] : current.filter(d => d !== drug.name);
                                        setFormData({...formData, antimicrobialsRequested: updated, antibiotic: updated.join(', ')});
                                     }}
                                   />
                                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 group-hover:text-slate-900">{drug.name}</span>
                                 </label>
                                 <AnimatePresence>
                                   {formData.antimicrobialsRequested?.includes(drug.name) && (
                                     <motion.div 
                                       initial={{ opacity: 0, x: -10 }} 
                                       animate={{ opacity: 1, x: 0 }}
                                       exit={{ opacity: 0, x: -10 }}
                                       className="pl-8"
                                     >
                                       <input 
                                         className="w-full text-[10px] font-bold uppercase tracking-tight bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
                                         placeholder={`Dose for ${drug.name}`}
                                         value={formData.drugDoses?.[drug.name] || ''}
                                         onChange={e => setFormData({
                                           ...formData, 
                                           drugDoses: { ...formData.drugDoses, [drug.name]: e.target.value }
                                         })}
                                       />
                                     </motion.div>
                                   )}
                                 </AnimatePresence>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Global Dosing Regimen / Remarks</label>
                          <textarea 
                            className="text-input h-24" 
                            placeholder="Additional dosing notes or instructions..."
                            value={formData.dosingRegimen}
                            onChange={e => setFormData({...formData, dosingRegimen: e.target.value, dose: e.target.value})}
                          />
                       </div>
                    </div>

                    {/* Clinical Context */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Clinical Context</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Indication</label>
                          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                             {['Prophylactic', 'Empiric', 'Definitive'].map(ind => (
                               <button
                                 key={ind}
                                 type="button"
                                 onClick={() => setFormData({...formData, indicationForUse: ind as any})}
                                 className={cn(
                                   "py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                   formData.indicationForUse === ind ? "bg-white text-brand-primary shadow-sm" : "text-slate-400 hover:text-slate-500"
                                 )}
                               >
                                 {ind}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Culture Type (select all that apply)</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'Blood', 'Respiratory', 'Urine', 'CSF', 'Wound', 
                               'Tissue', 'Catheter tip', 'Stool', 'Body fluid'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.cultureSent?.includes(c)}
                                    onChange={e => {
                                      const current = formData.cultureSent || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, cultureSent: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase">{c}</span>
                               </label>
                             ))}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Date Sent</label>
                                <input type="date" className="text-input py-2" value={formData.cultureDateSent} onChange={e => setFormData({...formData, cultureDateSent: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Others (Specify)</label>
                                <input className="text-input py-2" value={formData.cultureOthers} onChange={e => setFormData({...formData, cultureOthers: e.target.value})} />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="col-span-full md:col-span-2 space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Focus of Infection</label>
                          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'HENT', 'Ocular', 'Skin/Soft tissue', 'Bones/Joints', 
                               'Respiratory', 'Cardiovascular', 'GI / Intra‑abdominal', 
                               'Genito‑urinary', 'CNS'
                             ].map(f => (
                               <label key={f} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary"
                                    checked={formData.focusOfInfection?.includes(f)}
                                    onChange={e => {
                                      const current = formData.focusOfInfection || [];
                                      const updated = e.target.checked ? [...current, f] : current.filter(i => i !== f);
                                      setFormData({...formData, focusOfInfection: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{f}</span>
                               </label>
                             ))}
                          </div>
                          <div className="mt-2 space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400">Infectious Diagnosis</label>
                            <input className="text-input py-2" placeholder="Specific diagnosis..." value={formData.infectiousDiagnosis} onChange={e => setFormData({...formData, infectiousDiagnosis: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    {/* Inclusion Criteria for Critically Ill */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Inclusion Criteria for Critically Ill</h4>
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Select if applicable</span>
                    </div>

                    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sepsis Criteria (Any 2)</label>
                          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'HR >90/min',
                               'RR >20/min or pCO2 <32 mmHg',
                               'Temperature ≥38°C or ≤36°C',
                               'WBC >12,000 or <4,000 or >10% bands'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.criticallyIll?.sepsisCriteria.includes(c)}
                                    onChange={e => {
                                      const current = formData.criticallyIll?.sepsisCriteria || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, sepsisCriteria: updated }});
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-600">{c}</span>
                               </label>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Organ Dysfunction (At least 1)</label>
                          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'SBP <90 or dropped >40 mmHg',
                               'New onset jaundice',
                               'Platelet <100,000/uL or INR >1.5',
                               'Upper or Lower GI bleeding',
                               'Respiratory failure / saO2 <90%',
                               'Urine Output <0.5 mL/kg/hr'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.criticallyIll?.organDysfunctionCriteria.includes(c)}
                                    onChange={e => {
                                      const current = formData.criticallyIll?.organDysfunctionCriteria || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, organDysfunctionCriteria: updated }});
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-600">{c}</span>
                               </label>
                             ))}
                          </div>
                       </div>
                    </div>

                    {/* Microbiological Results (Only for Definitive indication) */}
                    <AnimatePresence>
                      {formData.indicationForUse === 'Definitive' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="col-span-full overflow-hidden"
                        >
                          <div className="border-b border-slate-100 pb-4 mt-8 mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Microbiological Results (Definitive)</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/10">
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Result Date</label>
                               <input 
                                 type="date"
                                 className="text-input border-brand-primary/20"
                                 value={formData.microbiology?.date}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, date: e.target.value }})}
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Specimen</label>
                               <input 
                                 className="text-input border-brand-primary/20"
                                 placeholder="e.g. Blood, Urine, CSF"
                                 value={formData.microbiology?.specimen}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, specimen: e.target.value }})}
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Organism</label>
                               <select 
                                 className="text-input border-brand-primary/20"
                                 value={formData.microbiology?.organism}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, organism: e.target.value }})}
                               >
                                 <option value="">Select Organism...</option>
                                 {[
                                   'Acinetobacter baumannii', 'Candida (specify species)', 'Clostridium difficile',
                                   'Enterococcus faecium/faecalis', 'Escherichia coli', 'Enterobacteriaceae (other)',
                                   'Haemophilus influenzae', 'Klebsiella pneumoniae', 'Neisseria gonorrhoeae',
                                   'Pseudomonas aeruginosa', 'Salmonella (non‑typhoidal)', 'Salmonella typhi',
                                   'Shigella spp.', 'Staphylococcus aureus', 'Streptococcus pneumoniae', 'Others (specify)'
                                 ].map(o => <option key={o} value={o}>{o}</option>)}
                               </select>
                            </div>
                            <div className="col-span-full space-y-1.5">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Resistance Pattern / Result</label>
                               <div className="flex flex-wrap gap-2">
                                  {[
                                    'MDR', 'XDR', 'PDR', 'ESBL', 'CRE', 
                                    'Ampicillin‑resistant', 'Ceftriaxone‑resistant', 'Penicillin‑resistant', 
                                    'Fluconazole‑resistant', 'Methicillin‑resistant (MRSA)', 'Vancomycin‑resistant (VRE)'
                                  ].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setFormData({...formData, microbiology: { ...formData.microbiology!, resistancePattern: p }})}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                                        formData.microbiology?.resistancePattern === p ? "bg-brand-primary text-white shadow-sm" : "bg-white text-slate-400 border border-slate-200 hover:border-brand-primary/30"
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                  <input 
                                    placeholder="Others..."
                                    className="text-[9px] font-bold uppercase tracking-widest bg-white border border-slate-200 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-brand-primary w-32"
                                    value={formData.microbiology?.otherResistance || ''}
                                    onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, otherResistance: e.target.value }})}
                                  />
                               </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Status & Justification</h4>
                    </div>

                    <div className="col-span-full space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Immunocompromising Conditions</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'Malignancy', 'Chronic liver disease', 'Connective tissue disease', 
                               'Chronic pulmonary disease', 'Immunocompromised state', 
                               'Chronic kidney disease', 'Chronic steroid use', 
                               'Diabetes mellitus (poorly controlled)', 'Others'
                             ].map(cond => (
                               <label key={cond} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary"
                                    checked={formData.immunocompromisingCondition?.includes(cond)}
                                    onChange={e => {
                                      const current = formData.immunocompromisingCondition || [];
                                      const updated = e.target.checked ? [...current, cond] : current.filter(i => i !== cond);
                                      setFormData({...formData, immunocompromisingCondition: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600">{cond}</span>
                               </label>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="col-span-full space-y-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Clinical Justification</label>
                       <textarea 
                         required
                         className="text-input h-32" 
                         placeholder="Document suspected pathogen, culture results, and failure of first-line therapies..."
                         value={formData.justification}
                         onChange={e => setFormData({...formData, justification: e.target.value, diagnosis: e.target.value})}
                       />
                    </div>
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Requesting Physician Info</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Requesting Physician Name</label>
                          <input 
                            className="text-input" 
                            placeholder="Full Name of Requesting Doctor"
                            value={formData.requestingPhysician}
                            onChange={e => setFormData({...formData, requestingPhysician: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number</label>
                          <input 
                            className="text-input" 
                            placeholder="Mobile or Local Number"
                            value={formData.prescriberContact}
                            onChange={e => setFormData({...formData, prescriberContact: e.target.value})}
                          />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                   <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged by</p>
                      <p className="text-xs font-bold text-slate-700">{user?.email}</p>
                   </div>
                   <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-8 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="btn-primary px-10 py-3 shadow-xl shadow-teal-900/10 font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-transform"
                    >
                      Process AMS Order
                    </button>
                   </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
