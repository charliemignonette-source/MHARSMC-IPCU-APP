import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Search, 
  Filter, 
  HandMetal, 
  ShieldCheck, 
  Syringe, 
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AuditType, Audit } from '../types';
import { UNITS, STAFF_TYPES } from '../constants';
import { cn, formatDate } from '../lib/utils';

export default function Audits({ user }: { user: UserProfile | null }) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedType, setSelectedType] = useState<AuditType>('HH_COMPLIANCE');
  const [formData, setFormData] = useState({
    unit: UNITS[0],
    score: 0,
    total: 10,
    remarks: '',
    profession: '1',
    staffType: 'Nurse'
  });

  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!user) return;
    
    let q;
    const isIPCU = user.role === 'ADMIN' || user.role === 'IPCN';
    
    if (isIPCU) {
      q = query(collection(db, 'audits'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'audits'), where('auditorId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const auditData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Audit[];
      setAudits(auditData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audits');
    });
    return () => unsubscribe();
  }, [user]);

  const AUDIT_OPTIONS = [
    { id: 'HH_COMPLIANCE', label: 'Hand Hygiene', icon: HandMetal },
    { id: 'HH_AVAILABILITY', label: 'HH Infrastructure', icon: ClipboardCheck },
    { id: 'PPE_AVAILABILITY', label: 'PPE Availability', icon: ShieldCheck },
    { id: 'PPE_COMPLIANCE', label: 'PPE Behavior', icon: ShieldCheck },
    { id: 'SAFE_INJECTION', label: 'Safe Injection', icon: Syringe },
    { id: 'ENV_CLEANING', label: 'Environmental', icon: Trash2 },
  ];

  const [checklist, setChecklist] = useState<Record<string, any>>({
    abhr: { poc: false, notEmpty: false, expiry: '', notIndicated: false, functional: false, mounted: false },
    sink: { sink: false, water: false, soap: false, expiry: '', notIndicated: false, towels: false, notClogged: false },
    posters: { visible: false, clean: false },
    hhObs: {
      indications: {
        befPat: false,
        befAsept: false,
        aftBF: false,
        aftPat: false,
        aftSurr: false
      },
      action: 'missed', // 'hr', 'hw', 'missed'
      gloves: false
    },
    ppe: {
      gloves: { avail: false, sizes: false, expiry: '', notIndicated: false },
      masks: { avail: false, notEmpty: false, expiry: '', notIndicated: false },
      n95: { avail: false, sizes: false, expiry: '', notIndicated: false },
      gowns: { avail: false, appropriate: false, expiry: '', notIndicated: false },
      shields: { avail: false, notDamaged: false }
    },
    ppeCompliance: {
      staffType: 'Nurse',
      correctPPE: false,
      missingItems: '',
      incorrectPPE: false,
      properDonning: false,
      properDoffing: false,
      ppeIntact: false,
      ppeFits: false,
      nonComplianceReason: ''
    },
    safeInjection: {
      prepClean: false,
      alcoholAvail: false,
      alcoholExpiry: '',
      alcoholNotIndicated: false,
      hhBefore: false,
      skinDisinfected: false,
      allowedToDry: false,
      noTouchSite: false,
      singleDoseOnce: false,
      multiDoseCorrect: false,
      vialExpiry: '',
      vialNotIndicated: false,
      vialNotContaminated: false,
      sterileSyringe: false,
      sterileNeedle: false,
      noRecapping: false,
      needleNotReused: false,
      correctRoute: false,
      correctDose: false,
      noReuseBetween: false,
      disposedImmediately: false,
      sharpsDisposed: false,
      sharpsNotFull: false,
      sharpsMounted: false
    },
    envCleaning: {
      surfaces: {
        bedRails: 'cleaned',
        trayTable: 'cleaned',
        ivPole: 'cleaned',
        callButton: 'cleaned',
        telephone: 'cleaned',
        bedsideTable: 'cleaned',
        chair: 'cleaned',
        roomSink: 'cleaned',
        lightSwitch: 'cleaned',
        innerDoorKnob: 'cleaned',
        bathroomDoorKnob: 'cleaned',
        bathroomLightSwitch: 'cleaned',
        bathroomHandrails: 'cleaned',
        bathroomSink: 'cleaned',
        toiletSeat: 'cleaned',
        toiletFlush: 'cleaned',
        bedpanCleaner: 'cleaned',
        ivPump: 'cleaned',
        monitorControls: 'cleaned',
        monitorTouch: 'cleaned',
        monitorCables: 'cleaned',
        ventilatorPanel: 'cleaned'
      },
      monitoringMethod: 'direct'
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      let score = 0;
      let total = 1;

      if (selectedType === 'HH_AVAILABILITY') {
        const hhKeys = [
          checklist.abhr.poc, checklist.abhr.notEmpty, checklist.abhr.functional, checklist.abhr.mounted,
          checklist.sink.sink, checklist.sink.water, checklist.sink.soap, checklist.sink.towels, checklist.sink.notClogged,
          checklist.posters.visible, checklist.posters.clean
        ];
        score = hhKeys.filter(v => v === true).length;
        total = hhKeys.length;
      } else if (selectedType === 'HH_COMPLIANCE') {
        const hhKeys = [
          checklist.hhObs.indications.befPat, 
          checklist.hhObs.indications.befAsept,
          checklist.hhObs.indications.aftBF,
          checklist.hhObs.indications.aftPat,
          checklist.hhObs.indications.aftSurr
        ];
        // WHO 5 Moments: at least one indication must be checked to be an opportunity
        const isOpportunity = hhKeys.some(v => v === true);
        if (isOpportunity) {
          score = (checklist.hhObs.action === 'hr' || checklist.hhObs.action === 'hw') ? 1 : 0;
          total = 1;
        } else {
          // If no indication, it's not a valid observation for compliance
          score = 0;
          total = 0; 
        }
      } else if (selectedType === 'PPE_AVAILABILITY') {
        const ppeKeys = [
          checklist.ppe.gloves.avail, checklist.ppe.gloves.sizes,
          checklist.ppe.masks.avail, checklist.ppe.masks.notEmpty,
          checklist.ppe.n95.avail, checklist.ppe.n95.sizes,
          checklist.ppe.gowns.avail, checklist.ppe.gowns.appropriate,
          checklist.ppe.shields.avail, checklist.ppe.shields.notDamaged
        ];
        score = ppeKeys.filter(v => v === true).length;
        total = ppeKeys.length;
      } else if (selectedType === 'PPE_COMPLIANCE') {
        const ppeKeys = [
          checklist.ppeCompliance.correctPPE,
          checklist.ppeCompliance.properDonning,
          checklist.ppeCompliance.properDoffing,
          checklist.ppeCompliance.ppeIntact,
          checklist.ppeCompliance.ppeFits
        ];
        score = ppeKeys.filter(v => v === true).length;
        total = ppeKeys.length;
      } else if (selectedType === 'SAFE_INJECTION') {
        const siKeys = [
          checklist.safeInjection.prepClean, checklist.safeInjection.alcoholAvail, checklist.safeInjection.hhBefore,
          checklist.safeInjection.skinDisinfected, checklist.safeInjection.allowedToDry, checklist.safeInjection.noTouchSite,
          checklist.safeInjection.singleDoseOnce, checklist.safeInjection.multiDoseCorrect, checklist.safeInjection.vialNotContaminated,
          checklist.safeInjection.sterileSyringe, checklist.safeInjection.sterileNeedle, checklist.safeInjection.noRecapping, checklist.safeInjection.needleNotReused,
          checklist.safeInjection.correctRoute, checklist.safeInjection.correctDose, checklist.safeInjection.noReuseBetween,
          checklist.safeInjection.disposedImmediately, checklist.safeInjection.sharpsDisposed, checklist.safeInjection.sharpsNotFull, checklist.safeInjection.sharpsMounted
        ];
        score = siKeys.filter(v => v === true).length;
        total = siKeys.length;
      } else if (selectedType === 'ENV_CLEANING') {
        const surfaceValues = Object.values(checklist.envCleaning.surfaces);
        score = surfaceValues.filter(v => v === 'cleaned').length;
        total = surfaceValues.filter(v => v !== 'notPresent').length;
      } else {
        score = formData.score;
        total = formData.total;
      }

      await addDoc(collection(db, 'audits'), {
        type: selectedType,
        unit: formData.unit,
        auditorId: user.uid,
        auditorEmail: user.email,
        timestamp: new Date().toISOString(),
        score,
        total,
        remarks: formData.remarks,
        details: ['HH_AVAILABILITY', 'HH_COMPLIANCE', 'PPE_AVAILABILITY', 'PPE_COMPLIANCE', 'SAFE_INJECTION', 'ENV_CLEANING'].includes(selectedType) ? checklist : null,
        profession: selectedType === 'HH_COMPLIANCE' ? formData.profession : null,
        isValidated: false,
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setFormData({ unit: UNITS[0], score: 0, total: 10, remarks: '', profession: '1', staffType: 'Nurse' });
      setChecklist({
        abhr: { poc: false, notEmpty: false, expiry: '', notIndicated: false, functional: false, mounted: false },
        sink: { sink: false, water: false, soap: false, expiry: '', notIndicated: false, towels: false, notClogged: false },
        posters: { visible: false, clean: false },
        hhObs: {
          indications: { befPat: false, befAsept: false, aftBF: false, aftPat: false, aftSurr: false },
          action: 'missed',
          gloves: false
        },
        ppe: {
          gloves: { avail: false, sizes: false, expiry: '', notIndicated: false },
          masks: { avail: false, notEmpty: false, expiry: '', notIndicated: false },
          n95: { avail: false, sizes: false, expiry: '', notIndicated: false },
          gowns: { avail: false, appropriate: false, expiry: '', notIndicated: false },
          shields: { avail: false, notDamaged: false }
        },
        ppeCompliance: {
          staffType: 'Nurse',
          correctPPE: false,
          missingItems: '',
          incorrectPPE: false,
          properDonning: false,
          properDoffing: false,
          ppeIntact: false,
          ppeFits: false,
          nonComplianceReason: ''
        },
        safeInjection: {
          prepClean: false,
          alcoholAvail: false,
          alcoholExpiry: '',
          alcoholNotIndicated: false,
          hhBefore: false,
          skinDisinfected: false,
          allowedToDry: false,
          noTouchSite: false,
          singleDoseOnce: false,
          multiDoseCorrect: false,
          vialExpiry: '',
          vialNotIndicated: false,
          vialNotContaminated: false,
          sterileSyringe: false,
          sterileNeedle: false,
          noRecapping: false,
          needleNotReused: false,
          correctRoute: false,
          correctDose: false,
          noReuseBetween: false,
          disposedImmediately: false,
          sharpsDisposed: false,
          sharpsNotFull: false,
          sharpsMounted: false
        },
        envCleaning: {
          surfaces: {
            bedRails: 'cleaned',
            trayTable: 'cleaned',
            ivPole: 'cleaned',
            callButton: 'cleaned',
            telephone: 'cleaned',
            bedsideTable: 'cleaned',
            chair: 'cleaned',
            roomSink: 'cleaned',
            lightSwitch: 'cleaned',
            innerDoorKnob: 'cleaned',
            bathroomDoorKnob: 'cleaned',
            bathroomLightSwitch: 'cleaned',
            bathroomHandrails: 'cleaned',
            bathroomSink: 'cleaned',
            toiletSeat: 'cleaned',
            toiletFlush: 'cleaned',
            bedpanCleaner: 'cleaned',
            ivPump: 'cleaned',
            monitorControls: 'cleaned',
            monitorTouch: 'cleaned',
            monitorCables: 'cleaned',
            ventilatorPanel: 'cleaned'
          },
          monitoringMethod: 'direct'
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'audits');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 uppercase">Field Surveillance</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Systematic validation of clinical hygiene standards</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">New Inspection</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6 h-fit">
        {/* Quick Stats Bento Cards */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {AUDIT_OPTIONS.map((opt) => (
            <div key={opt.id} className="bento-card p-4 bg-white flex flex-col gap-2 group hover:border-brand-primary/20 transition-all">
              <div className="flex items-center justify-between">
                <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:text-brand-primary transition-colors">
                  <opt.icon className="w-4 h-4" />
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{opt.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-slate-800">88%</span>
                  <span className="text-[9px] font-bold text-emerald-600">Stable</span>
                </div>
              </div>
            </div>
          ))}

          {/* Large Feed Section */}
          <div className="col-span-full bento-card bg-white min-h-[400px] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-tight text-slate-400 flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                Audit Registry
              </h3>
              <div className="flex gap-2">
                <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                  <Filter className="w-3.5 h-3.5" />
                </button>
                <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
              {loading ? (
                <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing...</div>
              ) : audits.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No field data detected</div>
              ) : (
                audits.map(audit => (
                  <AuditEntry 
                    key={audit.id} 
                    {...audit} 
                    onValidate={async () => {
                      if (user?.role === 'IPCN' || user?.role === 'ADMIN') {
                        try {
                          await updateDoc(doc(db, 'audits', audit.id), {
                            isValidated: !audit.isValidated,
                            validatedBy: user.email,
                            validatedAt: serverTimestamp()
                          });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, 'audits');
                        }
                      }
                    }}
                    isAdmin={user?.role === 'IPCN' || user?.role === 'ADMIN'}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Info Section */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-brand-dark p-6 rounded-2xl text-white relative overflow-hidden h-fit">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
            <h3 className="text-sm font-bold uppercase tracking-tight mb-4 relative z-10">Surveillance Tip</h3>
            <p className="text-xs text-slate-400 leading-relaxed relative z-10 font-medium">
              Ensure Hand Hygiene moments are observed from a distance to minimize observer bias (Hawthorne Effect) during institutional audits.
            </p>
            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-bold text-slate-500 uppercase">Unit Coverage</span>
                 <span className="text-[10px] font-bold text-teal-400">82%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 w-[82%]" />
              </div>
            </div>
          </div>

          <div className="bento-card p-6 bg-white space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900">Unit Distribution</h3>
            <div className="space-y-3">
              {['ICU A', 'WARD D', 'NICU', 'OR 2'].map(unit => (
                <div key={unit} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-xs font-bold text-slate-700">{unit}</span>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400 opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tool */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary p-2 rounded-xl text-white">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Audit Protocol Entry</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Observation Vector</label>
                    <div className="space-y-2">
                      {AUDIT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedType(opt.id as AuditType)}
                          className={cn(
                            "w-full flex items-center gap-4 p-3.5 rounded-2xl border transition-all text-sm font-semibold",
                            selectedType === opt.id 
                              ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                          )}
                        >
                          <opt.icon className="w-5 h-5" />
                          <span className="flex-1 text-left">{opt.label}</span>
                          {selectedType === opt.id && <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Target Location</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-brand-primary outline-none appearance-none"
                        value={formData.unit}
                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>

                    {selectedType === 'HH_AVAILABILITY' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* A. ABHR */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ABHR</h4>
                          <div className="grid grid-cols-1 gap-2">
                            <CheckItem label="ABHR at point of care" checked={checklist.abhr.poc} onChange={v => setChecklist({...checklist, abhr: {...checklist.abhr, poc: v}})} />
                            <CheckItem label="Bottle not empty" checked={checklist.abhr.notEmpty} onChange={v => setChecklist({...checklist, abhr: {...checklist.abhr, notEmpty: v}})} />
                            <div className="flex gap-2">
                              <input 
                                placeholder="Expiry Date" 
                                className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary" 
                                value={checklist.abhr.expiry}
                                onChange={e => setChecklist({...checklist, abhr: {...checklist.abhr, expiry: e.target.value}})}
                              />
                              <CheckItem label="N/I" checked={checklist.abhr.notIndicated} onChange={v => setChecklist({...checklist, abhr: {...checklist.abhr, notIndicated: v}})} />
                            </div>
                            <CheckItem label="Pump functional" checked={checklist.abhr.functional} onChange={v => setChecklist({...checklist, abhr: {...checklist.abhr, functional: v}})} />
                            <CheckItem label="Properly mounted/placed" checked={checklist.abhr.mounted} onChange={v => setChecklist({...checklist, abhr: {...checklist.abhr, mounted: v}})} />
                          </div>
                        </div>

                        {/* B. Handwashing Station */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Handwashing Station</h4>
                          <div className="grid grid-cols-1 gap-2">
                            <CheckItem label="Functional sink" checked={checklist.sink.sink} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, sink: v}})} />
                            <CheckItem label="Running water" checked={checklist.sink.water} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, water: v}})} />
                            <CheckItem label="Soap available" checked={checklist.sink.soap} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, soap: v}})} />
                            <div className="flex gap-2">
                              <input 
                                placeholder="Expiry Date" 
                                className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary" 
                                value={checklist.sink.expiry}
                                onChange={e => setChecklist({...checklist, sink: {...checklist.sink, expiry: e.target.value}})}
                              />
                              <CheckItem label="N/I" checked={checklist.sink.notIndicated} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, notIndicated: v}})} />
                            </div>
                            <CheckItem label="Paper towels available" checked={checklist.sink.towels} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, towels: v}})} />
                            <CheckItem label="Sink not clogged" checked={checklist.sink.notClogged} onChange={v => setChecklist({...checklist, sink: {...checklist.sink, notClogged: v}})} />
                          </div>
                        </div>

                        {/* C. Visual Reminders */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visual Reminders</h4>
                          <div className="grid grid-cols-1 gap-2">
                            <CheckItem label="Posters visible" checked={checklist.posters.visible} onChange={v => setChecklist({...checklist, posters: {...checklist.posters, visible: v}})} />
                            <CheckItem label="Posters clean/readable" checked={checklist.posters.clean} onChange={v => setChecklist({...checklist, posters: {...checklist.posters, clean: v}})} />
                          </div>
                        </div>
                      </div>
                    ) : selectedType === 'ENV_CLEANING' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-4">
                          <div className="grid grid-cols-[1fr,auto] gap-4 bg-slate-100/50 p-3 rounded-xl mb-2">
                             <span className="text-[10px] font-bold uppercase text-slate-500">Surface / Site</span>
                             <div className="flex gap-4">
                                <span className="w-12 text-center text-[10px] font-bold uppercase text-slate-500">Clean</span>
                                <span className="w-12 text-center text-[10px] font-bold uppercase text-slate-500">Not Cl.</span>
                                <span className="w-12 text-center text-[10px] font-bold uppercase text-slate-500">N/P</span>
                             </div>
                          </div>

                          {[
                            { id: 'bedRails', label: 'Bed rails / controls' },
                            { id: 'trayTable', label: 'Tray table' },
                            { id: 'ivPole', label: 'IV pole (grab area)' },
                            { id: 'callButton', label: 'Call box / button' },
                            { id: 'telephone', label: 'Telephone' },
                            { id: 'bedsideTable', label: 'Bedside table handle' },
                            { id: 'chair', label: 'Chair' },
                            { id: 'roomSink', label: 'Room sink' },
                            { id: 'lightSwitch', label: 'Room light switch' },
                            { id: 'innerDoorKnob', label: 'Room inner door knob' },
                            { id: 'bathroomDoorKnob', label: 'Bathroom inner door knob' },
                            { id: 'bathroomLightSwitch', label: 'Bathroom light switch' },
                            { id: 'bathroomHandrails', label: 'Bathroom handrails by toilet' },
                            { id: 'bathroomSink', label: 'Bathroom sink' },
                            { id: 'toiletSeat', label: 'Toilet seat' },
                            { id: 'toiletFlush', label: 'Toilet flush handle' },
                            { id: 'bedpanCleaner', label: 'Toilet bedpan cleaner' }
                          ].map(surf => (
                            <div key={surf.id} className="grid grid-cols-[1fr,auto] gap-4 items-center px-2 py-1 hover:bg-slate-50 rounded-lg transition-colors">
                               <span className="text-xs font-semibold text-slate-700">{surf.label}</span>
                               <div className="flex gap-4">
                                  {['cleaned', 'notCleaned', 'notPresent'].map(val => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setChecklist({...checklist, envCleaning: {...checklist.envCleaning, surfaces: {...checklist.envCleaning.surfaces, [surf.id]: val}}})}
                                      className={cn(
                                        "w-12 h-8 rounded-lg border transition-all flex items-center justify-center",
                                        checklist.envCleaning.surfaces[surf.id] === val 
                                          ? "bg-slate-900 border-slate-900 text-teal-400" 
                                          : "bg-white border-slate-200 text-slate-300 hover:border-slate-300"
                                      )}
                                    >
                                      {val === 'cleaned' && <CheckCircle2 className="w-4 h-4" />}
                                      {val === 'notCleaned' && <XCircle className="w-4 h-4" />}
                                      {val === 'notPresent' && <span className="text-[10px] font-bold">N/P</span>}
                                    </button>
                                  ))}
                               </div>
                            </div>
                          ))}

                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-6 mb-2">Additional Equipment</h4>
                          {[
                            { id: 'ivPump', label: 'IV pump control' },
                            { id: 'monitorControls', label: 'Monitor controls' },
                            { id: 'monitorTouch', label: 'Monitor touch screen' },
                            { id: 'monitorCables', label: 'Monitor cables' },
                            { id: 'ventilatorPanel', label: 'Ventilator control panel' }
                          ].map(surf => (
                             <div key={surf.id} className="grid grid-cols-[1fr,auto] gap-4 items-center px-2 py-1 hover:bg-slate-50 rounded-lg transition-colors">
                               <span className="text-xs font-semibold text-slate-700">{surf.label}</span>
                               <div className="flex gap-4">
                                  {['cleaned', 'notCleaned', 'notPresent'].map(val => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => setChecklist({...checklist, envCleaning: {...checklist.envCleaning, surfaces: {...checklist.envCleaning.surfaces, [surf.id]: val}}})}
                                      className={cn(
                                        "w-12 h-8 rounded-lg border transition-all flex items-center justify-center",
                                        checklist.envCleaning.surfaces[surf.id] === val 
                                          ? "bg-slate-900 border-slate-900 text-teal-400" 
                                          : "bg-white border-slate-200 text-slate-300 hover:border-slate-300"
                                      )}
                                    >
                                      {val === 'cleaned' && <CheckCircle2 className="w-4 h-4" />}
                                      {val === 'notCleaned' && <XCircle className="w-4 h-4" />}
                                      {val === 'notPresent' && <span className="text-[10px] font-bold">N/P</span>}
                                    </button>
                                  ))}
                               </div>
                            </div>
                          ))}

                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-6 mb-2">Monitoring Method</h4>
                          <div className="flex flex-wrap gap-2">
                             {[
                               { id: 'direct', label: 'Direct observation' },
                               { id: 'fluorescent', label: 'Fluorescent gel' },
                               { id: 'swab', label: 'Swab cultures' },
                               { id: 'atp', label: 'ATP system' },
                               { id: 'agar', label: 'Agar slide cultures' }
                             ].map(method => (
                               <button
                                 key={method.id}
                                 type="button"
                                 onClick={() => setChecklist({...checklist, envCleaning: {...checklist.envCleaning, monitoringMethod: method.id}})}
                                 className={cn(
                                   "px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                                   checklist.envCleaning.monitoringMethod === method.id 
                                     ? "bg-slate-900 text-teal-400 border-slate-900" 
                                     : "bg-slate-100 text-slate-400 border-transparent hover:border-slate-300"
                                 )}
                               >
                                 {method.label}
                               </button>
                             ))}
                          </div>
                        </div>
                      </div>
                    ) : selectedType === 'SAFE_INJECTION' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preparation Area</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Injection prepared in clean area" checked={checklist.safeInjection.prepClean} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, prepClean: v}})} />
                             <CheckItem label="Alcohol pad available" checked={checklist.safeInjection.alcoholAvail} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, alcoholAvail: v}})} />
                             <div className="flex gap-2">
                               <input placeholder="Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.safeInjection.alcoholExpiry} onChange={e => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, alcoholExpiry: e.target.value}})} />
                               <CheckItem label="N/I" checked={checklist.safeInjection.alcoholNotIndicated} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, alcoholNotIndicated: v}})} />
                             </div>
                             <CheckItem label="Hand hygiene performed" checked={checklist.safeInjection.hhBefore} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, hhBefore: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aseptic Technique</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Skin disinfected" checked={checklist.safeInjection.skinDisinfected} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, skinDisinfected: v}})} />
                             <CheckItem label="Allowed to dry completely" checked={checklist.safeInjection.allowedToDry} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, allowedToDry: v}})} />
                             <CheckItem label="No touching of site" checked={checklist.safeInjection.noTouchSite} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, noTouchSite: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vials & Solutions</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Single-dose vial used once" checked={checklist.safeInjection.singleDoseOnce} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, singleDoseOnce: v}})} />
                             <CheckItem label="Multi-dose vial correct" checked={checklist.safeInjection.multiDoseCorrect} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, multiDoseCorrect: v}})} />
                             <div className="flex gap-2">
                               <input placeholder="Vial Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.safeInjection.vialExpiry} onChange={e => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, vialExpiry: e.target.value}})} />
                               <CheckItem label="N/I" checked={checklist.safeInjection.vialNotIndicated} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, vialNotIndicated: v}})} />
                             </div>
                             <CheckItem label="Vial not contaminated" checked={checklist.safeInjection.vialNotContaminated} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, vialNotContaminated: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Syringes & Needles</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Sterile syringe used" checked={checklist.safeInjection.sterileSyringe} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, sterileSyringe: v}})} />
                             <CheckItem label="Sterile needle used" checked={checklist.safeInjection.sterileNeedle} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, sterileNeedle: v}})} />
                             <CheckItem label="No recapping after use" checked={checklist.safeInjection.noRecapping} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, noRecapping: v}})} />
                             <CheckItem label="Needle not reused" checked={checklist.safeInjection.needleNotReused} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, needleNotReused: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Injection Safety</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Correct route followed" checked={checklist.safeInjection.correctRoute} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, correctRoute: v}})} />
                             <CheckItem label="Correct dose administered" checked={checklist.safeInjection.correctDose} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, correctDose: v}})} />
                             <CheckItem label="No reuse between patients" checked={checklist.safeInjection.noReuseBetween} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, noReuseBetween: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Post-Injection</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Used syringe disposed immediately" checked={checklist.safeInjection.disposedImmediately} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, disposedImmediately: v}})} />
                             <CheckItem label="Disposed into sharps container" checked={checklist.safeInjection.sharpsDisposed} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, sharpsDisposed: v}})} />
                             <CheckItem label="Sharps container ≤ 3/4 full" checked={checklist.safeInjection.sharpsNotFull} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, sharpsNotFull: v}})} />
                             <CheckItem label="Sharps container properly mounted" checked={checklist.safeInjection.sharpsMounted} onChange={v => setChecklist({...checklist, safeInjection: {...checklist.safeInjection, sharpsMounted: v}})} />
                          </div>
                        </div>
                      </div>
                    ) : selectedType === 'PPE_AVAILABILITY' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gloves</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Gloves available" checked={checklist.ppe.gloves.avail} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gloves: {...checklist.ppe.gloves, avail: v}}})} />
                             <CheckItem label="Correct sizes available" checked={checklist.ppe.gloves.sizes} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gloves: {...checklist.ppe.gloves, sizes: v}}})} />
                             <div className="flex gap-2">
                               <input placeholder="Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.ppe.gloves.expiry} onChange={e => setChecklist({...checklist, ppe: {...checklist.ppe, gloves: {...checklist.ppe.gloves, expiry: e.target.value}}})} />
                               <CheckItem label="N/I" checked={checklist.ppe.gloves.notIndicated} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gloves: {...checklist.ppe.gloves, notIndicated: v}}})} />
                             </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Surgical Masks</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Surgical masks available" checked={checklist.ppe.masks.avail} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, masks: {...checklist.ppe.masks, avail: v}}})} />
                             <CheckItem label="Box not empty" checked={checklist.ppe.masks.notEmpty} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, masks: {...checklist.ppe.masks, notEmpty: v}}})} />
                             <div className="flex gap-2">
                               <input placeholder="Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.ppe.masks.expiry} onChange={e => setChecklist({...checklist, ppe: {...checklist.ppe, masks: {...checklist.ppe.masks, expiry: e.target.value}}})} />
                               <CheckItem label="N/I" checked={checklist.ppe.masks.notIndicated} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, masks: {...checklist.ppe.masks, notIndicated: v}}})} />
                             </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">N95 Respirators</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="N95 available" checked={checklist.ppe.n95.avail} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, n95: {...checklist.ppe.n95, avail: v}}})} />
                             <CheckItem label="Correct sizes available" checked={checklist.ppe.n95.sizes} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, n95: {...checklist.ppe.n95, sizes: v}}})} />
                             <div className="flex gap-2">
                               <input placeholder="Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.ppe.n95.expiry} onChange={e => setChecklist({...checklist, ppe: {...checklist.ppe, n95: {...checklist.ppe.n95, expiry: e.target.value}}})} />
                               <CheckItem label="N/I" checked={checklist.ppe.n95.notIndicated} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, n95: {...checklist.ppe.n95, notIndicated: v}}})} />
                             </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Isolation Gowns</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Gowns available" checked={checklist.ppe.gowns.avail} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gowns: {...checklist.ppe.gowns, avail: v}}})} />
                             <CheckItem label="Sizes appropriate for staff" checked={checklist.ppe.gowns.appropriate} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gowns: {...checklist.ppe.gowns, appropriate: v}}})} />
                             <div className="flex gap-2">
                               <input placeholder="Expiry" className="flex-1 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" value={checklist.ppe.gowns.expiry} onChange={e => setChecklist({...checklist, ppe: {...checklist.ppe, gowns: {...checklist.ppe.gowns, expiry: e.target.value}}})} />
                               <CheckItem label="N/I" checked={checklist.ppe.gowns.notIndicated} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, gowns: {...checklist.ppe.gowns, notIndicated: v}}})} />
                             </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Face Shields</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Face shields available" checked={checklist.ppe.shields.avail} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, shields: {...checklist.ppe.shields, avail: v}}})} />
                             <CheckItem label="Not cracked/damaged" checked={checklist.ppe.shields.notDamaged} onChange={v => setChecklist({...checklist, ppe: {...checklist.ppe, shields: {...checklist.ppe.shields, notDamaged: v}}})} />
                          </div>
                        </div>
                      </div>
                    ) : selectedType === 'PPE_COMPLIANCE' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Staff Information</label>
                          <div className="flex flex-wrap gap-2">
                             {STAFF_TYPES.map(type => (
                               <button
                                 key={type}
                                 type="button"
                                 onClick={() => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, staffType: type}})}
                                 className={cn(
                                   "px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                                   checklist.ppeCompliance.staffType === type 
                                     ? "bg-slate-900 text-teal-400 border-slate-900" 
                                     : "bg-slate-100 text-slate-400 border-transparent hover:border-slate-300"
                                 )}
                               >
                                 {type}
                               </button>
                             ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Correct PPE for Zone</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Wearing correct PPE" checked={checklist.ppeCompliance.correctPPE} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, correctPPE: v}})} />
                             <input 
                               placeholder="Specify missing items..." 
                               className="text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" 
                               value={checklist.ppeCompliance.missingItems}
                               onChange={e => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, missingItems: e.target.value}})}
                             />
                             <CheckItem label="Wearing incorrect PPE" checked={checklist.ppeCompliance.incorrectPPE} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, incorrectPPE: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Techniques</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Proper donning observed" checked={checklist.ppeCompliance.properDonning} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, properDonning: v}})} />
                             <CheckItem label="Proper doffing observed" checked={checklist.ppeCompliance.properDoffing} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, properDoffing: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Condition & Fit</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="PPE intact" checked={checklist.ppeCompliance.ppeIntact} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, ppeIntact: v}})} />
                             <CheckItem label="PPE fits properly" checked={checklist.ppeCompliance.ppeFits} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, ppeFits: v}})} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Compliance Notes</h4>
                          <textarea 
                            placeholder="Reason for non-compliance..." 
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-h-[80px]" 
                            value={checklist.ppeCompliance.nonComplianceReason}
                            onChange={e => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, nonComplianceReason: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : selectedType === 'HH_COMPLIANCE' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">HCW Profession</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-primary"
                            value={formData.profession}
                            onChange={(e) => setFormData({...formData, profession: e.target.value})}
                          >
                            <option value="1">Nurse / Midwife</option>
                            <option value="2">Auxiliary</option>
                            <option value="3">Medical Doctor</option>
                            <option value="4">Other HCW</option>
                          </select>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Indications</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="bef-pat. (Before touching patient)" checked={checklist.hhObs.indications.befPat} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, indications: {...checklist.hhObs.indications, befPat: v}}})} />
                             <CheckItem label="bef-asept. (Before clean/aseptic)" checked={checklist.hhObs.indications.befAsept} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, indications: {...checklist.hhObs.indications, befAsept: v}}})} />
                             <CheckItem label="aft-b.f. (After body fluid risk)" checked={checklist.hhObs.indications.aftBF} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, indications: {...checklist.hhObs.indications, aftBF: v}}})} />
                             <CheckItem label="aft-pat. (After touching patient)" checked={checklist.hhObs.indications.aftPat} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, indications: {...checklist.hhObs.indications, aftPat: v}}})} />
                             <CheckItem label="aft.p.surr. (After surroundings)" checked={checklist.hhObs.indications.aftSurr} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, indications: {...checklist.hhObs.indications, aftSurr: v}}})} />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">HH Action</h4>
                          <div className="flex flex-wrap gap-2">
                             {['HR', 'HW', 'Missed'].map(act => (
                               <button
                                 key={act}
                                 type="button"
                                 onClick={() => setChecklist({...checklist, hhObs: {...checklist.hhObs, action: act.toLowerCase()}})}
                                 className={cn(
                                   "px-6 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                                   checklist.hhObs.action === act.toLowerCase() 
                                     ? "bg-slate-900 text-teal-400 border-slate-900" 
                                     : "bg-slate-100 text-slate-400 border-transparent hover:border-slate-300"
                                 )}
                               >
                                 {act}
                               </button>
                             ))}
                          </div>
                        </div>

                        <div className="pt-2">
                           <CheckItem label="Gloves" checked={checklist.hhObs.gloves} onChange={v => setChecklist({...checklist, hhObs: {...checklist.hhObs, gloves: v}})} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Successes</label>
                            <input 
                              type="number" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                              value={formData.score}
                              onChange={(e) => setFormData({...formData, score: parseInt(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Total Obs.</label>
                            <input 
                              type="number" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                              value={formData.total}
                              onChange={(e) => setFormData({...formData, total: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Field Summary</label>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium h-28 resize-none focus:ring-2 focus:ring-brand-primary outline-none"
                            placeholder="Note any specific deviations..."
                            value={formData.remarks}
                            onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                          ></textarea>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit"
                    className="btn-primary flex-1 py-4 shadow-xl shadow-teal-900/10 active:scale-[0.98] transition-transform font-bold uppercase tracking-widest text-[10px]"
                  >
                    Validate & Transmit Audit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuditEntry({ id, type, unit, score, total, timestamp, auditorEmail, isValidated, validatedBy, onValidate, isAdmin }: any) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const colorClass = percentage >= 90 ? 'text-emerald-600' : percentage >= 80 ? 'text-amber-600' : 'text-rose-600';
  const barClass = percentage >= 90 ? 'bg-emerald-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="p-4 flex items-center gap-5 hover:bg-slate-50/80 transition-all rounded-2xl group relative">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all text-xs font-bold">
        {type === 'HH_COMPLIANCE' && <HandMetal className="w-5 h-5" />}
        {type === 'HH_AVAILABILITY' && <ClipboardCheck className="w-5 h-5" />}
        {type === 'PPE_AVAILABILITY' && <ShieldCheck className="w-5 h-5" />}
        {type === 'PPE_COMPLIANCE' && <ShieldCheck className="w-5 h-5" />}
        {type === 'ENV_CLEANING' && <Trash2 className="w-5 h-5" />}
        {type === 'SAFE_INJECTION' && <Syringe className="w-5 h-5" />}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{type.replace('_', ' ')}</span>
            {isValidated && <CheckCircle2 className="w-3 h-3 text-brand-primary" />}
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-200" />
          <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">{unit}</span>
        </div>
        <div className="flex flex-col gap-0.5">
           <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{auditorEmail || 'System'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{formatDate(timestamp)}</span>
           </div>
           {isValidated && (
             <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-tight">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Validated by: {validatedBy}</span>
             </div>
           )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end gap-1.5 w-24">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-bold text-slate-400">{score}/{total}</span>
            <span className={cn("text-lg font-black tracking-tighter", colorClass)}>{percentage}%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              className={cn("h-full", barClass)}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm('Are you sure you want to delete this audit record?')) return;
                try {
                  await deleteDoc(doc(db, 'audits', id));
                } catch (error) {
                  handleFirestoreError(error, OperationType.DELETE, `audits/${id}`);
                }
              }}
              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Audit"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {!isValidated && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onValidate();
                }}
                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                title="IPCN Validation"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <label className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer",
      checked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200"
    )}>
      <input 
        type="checkbox" 
        className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        checked={checked} 
        onChange={e => onChange(e.target.checked)} 
      />
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </label>
  );
}
