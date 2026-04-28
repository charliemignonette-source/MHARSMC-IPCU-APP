import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  Minus,
  Search, 
  Filter, 
  HandMetal, 
  ShieldCheck, 
  Syringe, 
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Check,
  ShieldAlert,
  Droplets,
  Info,
  Zap
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

  const [pendingHHObservations, setPendingHHObservations] = useState<any[]>([]);
  const [currentHHEntry, setCurrentHHEntry] = useState({
    indications: [] as string[],
    action: '' as 'rub' | 'wash' | 'missed' | '',
    gloves: false
  });

  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatsForType = (type: string) => {
    const typeAudits = audits.filter(a => a.type === type);
    if (typeAudits.length === 0) return { percentage: 0, status: 'No Data', color: 'text-slate-400' };
    
    const totalScore = typeAudits.reduce((acc, curr) => acc + (curr.score || 0), 0);
    const totalPossible = typeAudits.reduce((acc, curr) => acc + (curr.total || 0), 0);
    
    const percentage = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
    
    let status = 'Stable';
    let color = 'text-emerald-500';
    
    if (percentage < 70) {
      status = 'Critical';
      color = 'text-rose-500';
    } else if (percentage < 85) {
      status = 'Warning';
      color = 'text-amber-500';
    }
    
    return { percentage, status, color };
  };

  const unitCoverage = audits.length > 0 
    ? Math.round((new Set(audits.map(a => a.unit)).size / UNITS.length) * 100) 
    : 0;

  const unitDistribution = React.useMemo(() => {
    const unitsMap: Record<string, { count: number, score: number, total: number }> = {};
    
    // Initialize all units with 0 stats
    UNITS.forEach(unit => {
      unitsMap[unit] = { count: 0, score: 0, total: 0 };
    });

    audits.forEach(a => {
      const unit = a.unit || 'Unknown';
      if (!unitsMap[unit]) {
        unitsMap[unit] = { count: 0, score: 0, total: 0 };
      }
      unitsMap[unit].count++;
      unitsMap[unit].score += (a.score || 0);
      unitsMap[unit].total += (a.total || 0);
    });

    return Object.entries(unitsMap)
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        compliance: stats.total > 0 ? Math.round((stats.score / stats.total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [audits]);

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

  const AUDIT_GROUPS = [
    {
      title: 'HCW Performance',
      options: [
        { id: 'HH_COMPLIANCE', label: 'HH Compliance (Staff)', icon: HandMetal },
        { id: 'PPE_COMPLIANCE', label: 'PPE Compliance (Staff)', icon: ShieldCheck },
      ]
    },
    {
      title: 'Unit & Practice Standards',
      options: [
        { id: 'HH_AVAILABILITY', label: 'HH Facilities (Unit)', icon: ClipboardCheck },
        { id: 'PPE_AVAILABILITY', label: 'PPE Supply (Unit)', icon: ShieldCheck },
        { id: 'ENV_CLEANING', label: 'Environmental (Unit)', icon: Trash2 },
        { id: 'SAFE_INJECTION', label: 'Safe Injection (Unit + Staff)', icon: Syringe },
      ]
    }
  ];

  const AUDIT_OPTIONS = AUDIT_GROUPS.flatMap(g => g.options);

  const [selectedAuditForValidation, setSelectedAuditForValidation] = useState<Audit | null>(null);
  const [validationForm, setValidationForm] = useState({
    validatorName: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    remarks: '',
    monitoringMethod: '',
    monitoringStatus: '' as 'PASS' | 'FAIL' | ''
  });

  const handleValidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditForValidation || !user) return;

    try {
      await updateDoc(doc(db, 'audits', selectedAuditForValidation.id), {
        isValidated: true,
        validatedBy: user.email,
        validatorName: validationForm.validatorName || user.name || 'IPCN Validator',
        validatedAt: `${validationForm.date}T${validationForm.time}`,
        validationRemarks: validationForm.remarks,
        monitoringMethod: validationForm.monitoringMethod,
        monitoringStatus: validationForm.monitoringStatus,
        updatedAt: serverTimestamp()
      });
      setSelectedAuditForValidation(null);
      setValidationForm({
        validatorName: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        remarks: '',
        monitoringMethod: '',
        monitoringStatus: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'audits');
    }
  };

  const [checklist, setChecklist] = useState<Record<string, any>>({
    abhr: { poc: false, notEmpty: false, expiry: '', notIndicated: false, functional: false, mounted: false },
    sink: { sink: false, water: false, soap: false, expiry: '', notIndicated: false, towels: false, notClogged: false },
    posters: { visible: false, clean: false },
    hhObs: {
      entries: [],
      staffIdentifier: '',
      role: 'Registered Nurse'
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
      staffIdentifier: '',
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
      }
    }
  });

  const calculateHHScore = (obs: any) => {
    if (obs.entries && Array.isArray(obs.entries)) {
      const totalOpp = obs.entries.length;
      const totalPerf = obs.entries.filter((e: any) => e.action === 'rub' || e.action === 'wash').length;
      return { score: totalPerf, total: totalOpp };
    }

    let totalOpp = 0;
    let totalPerf = 0;

    Object.values(obs.moments || {}).forEach((m: any) => {
      totalOpp += (m.opp || 0);
      totalPerf += (m.perf || 0);
    });
    
    return { score: totalPerf, total: totalOpp };
  };

  const handleAddHHObservation = () => {
    const calculation = calculateHHScore(checklist.hhObs);
    if (calculation.total === 0) {
      showToast("Please record at least one opportunity.", "error");
      return;
    }
    
    setPendingHHObservations(prev => [...prev, {
      id: Date.now(),
      profession: formData.profession,
      staffIdentifier: checklist.hhObs.staffIdentifier,
      entries: [...(checklist.hhObs.entries || [])],
      ...calculation
    }]);

    // Reset HH observation fields for next one
    setChecklist(prev => ({
      ...prev,
      hhObs: {
        entries: [],
        staffIdentifier: '',
        role: 'Registered Nurse'
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedType === 'HH_COMPLIANCE' && pendingHHObservations.length === 0 && calculateHHScore(checklist.hhObs).total === 0) {
      showToast('Please log at least one opportunity or add a HCW audit to the batch.', 'error');
      return;
    }

    try {
      if (selectedType === 'HH_COMPLIANCE') {
        const finalBatch = [...pendingHHObservations];
        const currentCalc = calculateHHScore(checklist.hhObs);
        
        if (currentCalc.total > 0) {
          finalBatch.push({
            id: Date.now() + 1,
            profession: formData.profession,
            staffIdentifier: checklist.hhObs.staffIdentifier,
            entries: [...(checklist.hhObs.entries || [])],
            ...currentCalc
          });
        }

        if (finalBatch.length === 0) {
          showToast('Please log at least one opportunity.', 'error');
          return;
        }

        const now = new Date().toISOString();
        const serverNow = serverTimestamp();
        
        console.log('Finalizing HH batch save:', finalBatch.length, 'audits');
        for (const obs of finalBatch) {
          console.log('Adding HH audit for staff:', obs.staffIdentifier);
          await addDoc(collection(db, 'audits'), {
            type: selectedType,
            unit: formData.unit,
            auditorId: user.uid,
            auditorEmail: user.email,
            auditorName: user.name,
            timestamp: now,
            score: obs.score,
            total: obs.total,
            staffIdentifier: obs.staffIdentifier,
            profession: obs.profession,
            details: { ...checklist, hhObs: obs },
            isValidated: false,
            createdAt: serverNow
          });
        }
        showToast(`Successfully transmitted ${finalBatch.length} HCW audit(s)`);
      } else {
        // Single observation
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
        console.log('Transmitting singular audit payload:', selectedType);
        await addDoc(collection(db, 'audits'), {
          type: selectedType,
          unit: formData.unit,
          auditorId: user.uid,
          auditorEmail: user.email,
          auditorName: user.name, // person reporting
          timestamp: new Date().toISOString(),
          score,
          total,
          staffIdentifier: selectedType === 'PPE_COMPLIANCE' 
            ? checklist.ppeCompliance.staffIdentifier 
            : null,
          remarks: formData.remarks,
          details: ['HH_AVAILABILITY', 'PPE_AVAILABILITY', 'PPE_COMPLIANCE', 'SAFE_INJECTION', 'ENV_CLEANING'].includes(selectedType) ? checklist : null,
          profession: selectedType === 'PPE_COMPLIANCE' 
            ? checklist.ppeCompliance.staffType 
            : null,
          isValidated: false,
          createdAt: serverTimestamp()
        });
        showToast('Audit report submitted successfully');
      }

      setIsAdding(false);
      setPendingHHObservations([]);
      setFormData({ unit: UNITS[0], score: 0, total: 10, remarks: '', profession: '1', staffType: 'Nurse' });
      setChecklist({
        abhr: { poc: false, notEmpty: false, expiry: '', notIndicated: false, functional: false, mounted: false },
        sink: { sink: false, water: false, soap: false, expiry: '', notIndicated: false, towels: false, notClogged: false },
        posters: { visible: false, clean: false },
        hhObs: {
          entries: [],
          staffIdentifier: '',
          role: 'Registered Nurse'
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
          staffIdentifier: '',
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
          prepClean: false, alcoholAvail: false, alcoholExpiry: '', alcoholNotIndicated: false,
          hhBefore: false, skinDisinfected: false, allowedToDry: false, noTouchSite: false,
          singleDoseOnce: false, multiDoseCorrect: false, vialExpiry: '', vialNotIndicated: false, vialNotContaminated: false,
          sterileSyringe: false, sterileNeedle: false, noRecapping: false, needleNotReused: false,
          correctRoute: false, correctDose: false, noReuseBetween: false,
          disposedImmediately: false, sharpsDisposed: false, sharpsNotFull: false, sharpsMounted: false
        },
        envCleaning: {
          surfaces: {
            bedRails: 'cleaned', trayTable: 'cleaned', ivPole: 'cleaned', callButton: 'cleaned', telephone: 'cleaned',
            bedsideTable: 'cleaned', chair: 'cleaned', roomSink: 'cleaned', lightSwitch: 'cleaned', innerDoorKnob: 'cleaned',
            bathroomDoorKnob: 'cleaned', bathroomLightSwitch: 'cleaned', bathroomHandrails: 'cleaned', bathroomSink: 'cleaned',
            toiletSeat: 'cleaned', toiletFlush: 'cleaned', bedpanCleaner: 'cleaned', ivPump: 'cleaned',
            monitorControls: 'cleaned', monitorTouch: 'cleaned', monitorCables: 'cleaned', ventilatorPanel: 'cleaned'
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'audits');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">Field Surveillance</h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">Systematic validation of clinical hygiene standards</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto btn-primary px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">New Inspection</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6 h-fit">
        {/* Quick Stats Bento Cards */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {AUDIT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{group.title}</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {group.options.map((opt) => {
                  const stats = getStatsForType(opt.id);
                  return (
                    <div key={opt.id} className="bento-card p-4 bg-white flex flex-col gap-2 group hover:border-brand-primary/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:text-brand-primary transition-colors">
                          <opt.icon className="w-4 h-4" />
                        </div>
                        <div className={cn("w-1.5 h-1.5 rounded-full", stats.percentage === 0 ? "bg-slate-300" : stats.color.replace('text', 'bg'))} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{opt.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-slate-800">{stats.percentage}%</span>
                          <span className={cn("text-[9px] font-bold uppercase", stats.color)}>{stats.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Large Feed Section */}
          <div className="col-span-full bento-card bg-white min-h-[400px] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-tight text-slate-400 flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                Audit Registry
              </h3>
              <div className="flex gap-2">
                <button className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                  <Filter className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
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
                    onValidate={() => {
                      setSelectedAuditForValidation(audit);
                      setValidationForm({
                         ...validationForm,
                         validatorName: user?.name || ''
                      });
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
                 <span className="text-[10px] font-bold text-teal-400">{unitCoverage}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-teal-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${unitCoverage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bento-card p-6 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-tight text-slate-900">Unit Distribution</h3>
              <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">Top Performing</span>
            </div>
            <div className="space-y-3">
              {unitDistribution.slice(0, 6).map(unit => (
                <div key={unit.name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700">{unit.name}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{unit.count} audits recorded</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-black",
                      unit.compliance >= 85 ? "text-emerald-500" : unit.compliance >= 70 ? "text-amber-500" : "text-rose-500"
                    )}>
                      {unit.compliance}%
                    </span>
                    <div className="flex gap-1.5">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        unit.compliance >= 70 ? "bg-emerald-400" : "bg-rose-400 shadow-sm shadow-rose-200"
                      )} />
                      <div className={cn(
                        "w-2 h-2 rounded-full opacity-50",
                        unit.compliance >= 85 ? "bg-emerald-400" : "bg-rose-400"
                      )} />
                    </div>
                  </div>
                </div>
              ))}
              {unitDistribution.length === 0 && (
                <div className="py-8 text-center space-y-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No Unit Data Synced</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary p-2 rounded-xl text-white">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-lg font-bold text-slate-900 uppercase tracking-tight">Audit Protocol Entry</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Observation Vector</label>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                      {AUDIT_GROUPS.map((group) => (
                        <div key={group.title} className="space-y-2 mt-2 first:mt-0">
                          <label className="text-[8px] font-black uppercase text-slate-300 ml-1">{group.title}</label>
                          {group.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSelectedType(opt.id as AuditType)}
                              className={cn(
                                "w-full flex items-center gap-3 sm:gap-4 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all text-[11px] sm:text-sm font-bold sm:font-semibold",
                                selectedType === opt.id 
                                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10" 
                                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                              )}
                            >
                              <opt.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span className="flex-1 text-left truncate">{opt.label}</span>
                              {selectedType === opt.id && <div className="w-1.5 h-1.5 bg-teal-400 rounded-full shrink-0" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Target Location</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-brand-primary outline-none appearance-none"
                        value={formData.unit || ''}
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
                                value={checklist.abhr?.expiry || ''}
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
                                value={checklist.sink?.expiry || ''}
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


                        </div>
                      </div>
                    ) : selectedType === 'SAFE_INJECTION' ? (
                      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 mb-4">HCW Verification</h4>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black uppercase text-slate-400">HCW Category</label>
                                 <select 
                                   value={formData.profession} 
                                   onChange={e => setFormData({...formData, profession: e.target.value})}
                                   className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-primary"
                                 >
                                   <option value="1">Nurse / Midwife</option>
                                   <option value="2">Auxiliary</option>
                                   <option value="3">Medical Doctor</option>
                                   <option value="4">Other HCW</option>
                                 </select>
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black uppercase text-slate-400">Staff Name (Optional)</label>
                                 <input 
                                   type="text"
                                   placeholder="e.g. Dr. Charlie Mignonette Bala"
                                   value={checklist.hhObs.staffIdentifier}
                                   onChange={e => setChecklist({...checklist, hhObs: {...checklist.hhObs, staffIdentifier: e.target.value}})}
                                   className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-brand-primary"
                                 />
                              </div>
                           </div>
                        </div>

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
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-400">Staff Name (Optional)</label>
                              <input 
                                type="text"
                                placeholder="e.g. Dr. Charlie Mignonette Bala"
                               value={checklist.ppeCompliance?.staffIdentifier || ''}
                                onChange={e => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, staffIdentifier: e.target.value}})}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-brand-primary"
                              />
                            </div>
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
                             {checklist.ppeCompliance.staffType === 'Other' && (
                               <input 
                                 placeholder="Specify other staff type..." 
                                 className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-2 font-semibold" 
                                 value={checklist.ppeCompliance.staffTypeOther || ''}
                                 onChange={e => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, staffTypeOther: e.target.value}})}
                               />
                             )}
                          </div>
                        </div>
                      </div>

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Correct PPE for Zone</h4>
                          <div className="grid grid-cols-1 gap-2">
                             <CheckItem label="Wearing correct PPE" checked={checklist.ppeCompliance.correctPPE} onChange={v => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, correctPPE: v}})} />
                             <input 
                               placeholder="Specify missing items..." 
                               className="text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" 
                               value={checklist.ppeCompliance?.missingItems || ''}
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
                            value={checklist.ppeCompliance?.nonComplianceReason || ''}
                            onChange={e => setChecklist({...checklist, ppeCompliance: {...checklist.ppeCompliance, nonComplianceReason: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : selectedType === 'HH_COMPLIANCE' ? (
                      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* WHO Header Card */}
                        <div className="bg-orange-500 rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-20">
                            <HandMetal className="w-20 h-20" />
                          </div>
                          <div className="relative z-10 space-y-2">
                             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                               <Droplets className="w-6 h-6 text-white" />
                             </div>
                             <h4 className="text-sm sm:text-lg font-black uppercase tracking-tight">HAND HYGIENE OPPORTUNITY LOG</h4>
                             <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest leading-none text-orange-100">Record each opportunity individually as per WHO Standards</p>
                          </div>
                        </div>

                        {/* Observer Information */}
                        <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <Search className="w-3 h-3" /> Subject & Observer
                           </h5>
                           <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1.5">
                                 <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Healthcare Worker Name / ID</label>
                                 <input 
                                   type="text"
                                   placeholder="e.g. Dr. Charlie Mignonette Bala"
                                   value={checklist.hhObs.staffIdentifier}
                                   onChange={e => setChecklist({...checklist, hhObs: {...checklist.hhObs, staffIdentifier: e.target.value}})}
                                   className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                 />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">HCW Category</label>
                                  <select 
                                    value={formData.profession || ''} 
                                    onChange={e => setFormData({...formData, profession: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    <option value="1">Nurse / Midwife</option>
                                    <option value="2">Auxiliary</option>
                                    <option value="3">Medical Doctor</option>
                                    <option value="4">Other HCW</option>
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Staff Role</label>
                                  <select 
                                    value={checklist.hhObs?.role || ''} 
                                    onChange={e => setChecklist({...checklist, hhObs: {...checklist.hhObs, role: e.target.value}})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                                  >
                                    {STAFF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                              </div>
                           </div>
                        </div>

                        {/* Opportunity Entry Form */}
                        <div className="p-5 bg-emerald-50/30 border border-emerald-100 rounded-3xl space-y-6">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                              <Plus className="w-3 h-3" /> New Opportunity
                           </h5>

                           <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Indications (WHO Moments)</label>
                                <div className="grid grid-cols-5 gap-2">
                                  {[
                                    { id: 'M1', label: 'M1', title: 'Before Patient' },
                                    { id: 'M2', label: 'M2', title: 'Before Aseptic' },
                                    { id: 'M3', label: 'M3', title: 'After Fluid' },
                                    { id: 'M4', label: 'M4', title: 'After Patient' },
                                    { id: 'M5', label: 'M5', title: 'After Surround' }
                                  ].map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      title={m.title}
                                      onClick={() => {
                                        const newIndications = currentHHEntry.indications.includes(m.id)
                                          ? currentHHEntry.indications.filter(i => i !== m.id)
                                          : [...currentHHEntry.indications, m.id];
                                        setCurrentHHEntry({...currentHHEntry, indications: newIndications});
                                      }}
                                      className={cn(
                                        "h-10 rounded-xl border text-[10px] font-black transition-all",
                                        currentHHEntry.indications.includes(m.id)
                                          ? "bg-slate-900 border-slate-900 text-teal-400 shadow-md"
                                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                      )}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Action Performed</label>
                                  <div className="grid grid-cols-1 gap-2">
                                    {[
                                      { id: 'rub', label: 'Hand Rub', color: 'bg-blue-500' },
                                      { id: 'wash', label: 'Hand Wash', color: 'bg-emerald-500' },
                                      { id: 'missed', label: 'Missed', color: 'bg-rose-500' }
                                    ].map((a) => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => setCurrentHHEntry({...currentHHEntry, action: a.id as any})}
                                        className={cn(
                                          "w-full py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all",
                                          currentHHEntry.action === a.id
                                            ? `${a.color} border-transparent text-white shadow-md`
                                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                        )}
                                      >
                                        {a.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Glove Use</label>
                                  <div className="grid grid-cols-1 gap-2">
                                    {[
                                      { id: 'worn', label: 'Worn', val: true },
                                      { id: 'not_worn', label: 'Not Worn', val: false }
                                    ].map((g) => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => setCurrentHHEntry({...currentHHEntry, gloves: g.val})}
                                        className={cn(
                                          "w-full py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all",
                                          currentHHEntry.gloves === g.val
                                            ? "bg-amber-500 border-transparent text-white shadow-md"
                                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                        )}
                                      >
                                        {g.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (currentHHEntry.indications.length === 0 || !currentHHEntry.action) {
                                    showToast("Please select indications and an action.", "error");
                                    return;
                                  }
                                  const newEntry = {
                                    ...currentHHEntry,
                                    id: Date.now().toString(),
                                    timestamp: new Date().toISOString()
                                  };
                                  setChecklist({
                                    ...checklist,
                                    hhObs: {
                                      ...checklist.hhObs,
                                      entries: [...(checklist.hhObs.entries || []), newEntry]
                                    }
                                  });
                                  // Reset draft entry
                                  setCurrentHHEntry({ indications: [], action: '', gloves: false });
                                }}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition-all"
                              >
                                Log Opportunity
                              </button>
                           </div>
                        </div>

                        {/* Entered Opportunities List */}
                        {checklist.hhObs.entries && checklist.hhObs.entries.length > 0 && (
                          <div className="space-y-3">
                             <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <ClipboardCheck className="w-3 h-3" /> Logged Opportunities ({checklist.hhObs.entries.length})
                             </h5>
                             <div className="space-y-2">
                                {checklist.hhObs.entries.map((entry: any, idx: number) => (
                                  <div key={entry.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl group">
                                     <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                                          {idx + 1}
                                        </div>
                                        <div>
                                          <div className="flex gap-1 mb-0.5">
                                            {entry.indications.map((ind: string) => (
                                              <span key={ind} className="px-1.5 py-0.5 bg-slate-900 text-teal-400 rounded text-[8px] font-black uppercase">{ind}</span>
                                            ))}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className={cn(
                                              "text-[9px] font-black uppercase tracking-tight",
                                              entry.action === 'missed' ? "text-rose-500" : "text-emerald-500"
                                            )}>
                                              {entry.action === 'rub' ? 'Hand Rub' : entry.action === 'wash' ? 'Hand Wash' : 'Missed'}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                                              Gloves: {entry.gloves ? 'Worn' : 'Not Worn'}
                                            </span>
                                          </div>
                                        </div>
                                     </div>
                                     <button 
                                       type="button" 
                                       onClick={() => {
                                         setChecklist({
                                           ...checklist,
                                           hhObs: {
                                             ...checklist.hhObs,
                                             entries: checklist.hhObs.entries.filter((e: any) => e.id !== entry.id)
                                           }
                                         });
                                       }}
                                       className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}

                        {/* Summary Footer */}
                        <div className="p-4 bg-slate-900 rounded-3xl grid grid-cols-4 gap-4 shadow-xl shadow-slate-900/20">
                           <div className="flex flex-col items-center gap-1 border-r border-slate-800">
                             <span className="text-lg font-black text-blue-400">
                               {calculateHHScore(checklist.hhObs).total}
                             </span>
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center">Total Opp.</span>
                           </div>
                           <div className="flex flex-col items-center gap-1 border-r border-slate-800">
                             <span className="text-lg font-black text-emerald-400">
                               {calculateHHScore(checklist.hhObs).score}
                             </span>
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center">Total Perf.</span>
                           </div>
                           <div className="flex flex-col items-center gap-1 border-r border-slate-800">
                             <span className="text-lg font-black text-rose-400">
                               {calculateHHScore(checklist.hhObs).total - calculateHHScore(checklist.hhObs).score}
                             </span>
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center">Total Missed</span>
                           </div>
                           <div className="flex flex-col items-center gap-1">
                             <span className="text-lg font-black text-amber-400">
                               {checklist.hhObs.entries?.filter((e: any) => e.gloves).length || 0}
                             </span>
                             <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-center">Glove Use</span>
                           </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddHHObservation()}
                          className="w-full py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Complete HCW Audit & Add to Batch
                        </button>

                        {pendingHHObservations.length > 0 && (
                          <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                              <ClipboardCheck className="w-3 h-3" /> Audit Payload Buffer ({pendingHHObservations.length} HCWs)
                            </h4>
                            <div className="space-y-2">
                              {pendingHHObservations.map((obs) => (
                                <div key={obs.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{obs.staffIdentifier || 'Anonymous HCW'}</span>
                                    <div className="flex items-center gap-2">
                                       <span className="text-[8px] font-bold text-slate-500 uppercase">{obs.role}</span>
                                       <span className="text-[8px] font-black text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded leading-none">
                                          {Math.round((obs.score / (obs.total || 1)) * 100)}% Compliance
                                       </span>
                                    </div>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => setPendingHHObservations(prev => prev.filter(p => p.id !== obs.id))}
                                    className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Successes</label>
                            <input 
                              type="number" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                              value={formData.score || 0}
                              onChange={(e) => setFormData({...formData, score: parseInt(e.target.value)})}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Total Obs.</label>
                            <input 
                              type="number" 
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand-primary outline-none"
                              value={formData.total || 0}
                              onChange={(e) => setFormData({...formData, total: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Field Summary</label>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium h-28 resize-none focus:ring-2 focus:ring-brand-primary outline-none"
                            placeholder="Note any specific deviations..."
                            value={formData.remarks || ''}
                            onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                          ></textarea>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors border border-slate-200 sm:border-none rounded-2xl sm:rounded-none"
                >
                  Discard Changes
                </button>
                <button 
                  type="submit"
                  className="btn-primary flex-[2] sm:flex-1 py-4 shadow-xl shadow-teal-900/10 active:scale-[0.98] transition-transform font-bold uppercase tracking-widest text-[10px]"
                >
                  Validate & Transmit Audit
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
        {selectedAuditForValidation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
              <div className="p-4 sm:p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                   <ShieldCheck className="w-5 h-5 text-brand-primary" />
                   <h3 className="text-sm font-bold text-white uppercase tracking-tight">Audit Validation</h3>
                </div>
                <button onClick={() => setSelectedAuditForValidation(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleValidateSubmit} className="p-6 space-y-6">
                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date</label>
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={validationForm.date} onChange={e => setValidationForm({...validationForm, date: e.target.value})} />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time</label>
                          <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none" value={validationForm.time} onChange={e => setValidationForm({...validationForm, time: e.target.value})} />
                       </div>
                    </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validator Name</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none" value={validationForm.validatorName} onChange={e => setValidationForm({...validationForm, validatorName: e.target.value})} placeholder="Enter your full name" />
                   </div>

                   {selectedAuditForValidation.type === 'ENV_CLEANING' && (
                     <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Monitoring Method</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                            value={validationForm.monitoringMethod}
                            onChange={e => setValidationForm({...validationForm, monitoringMethod: e.target.value})}
                          >
                             <option value="">Select Method</option>
                             <option value="Visual Observation">Visual Observation</option>
                             <option value="Fluorescent Marker">Fluorescent Marker</option>
                             <option value="ATP Bioluminescence">ATP Bioluminescence</option>
                             <option value="Culturing">Culturing</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Result</label>
                           <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => setValidationForm({...validationForm, monitoringStatus: 'PASS'})}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                  validationForm.monitoringStatus === 'PASS' ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-50 border-slate-200 text-slate-400"
                                )}
                              >
                                Passed
                              </button>
                              <button 
                                type="button"
                                onClick={() => setValidationForm({...validationForm, monitoringStatus: 'FAIL'})}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                  validationForm.monitoringStatus === 'FAIL' ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-slate-50 border-slate-200 text-slate-400"
                                )}
                              >
                                Failed
                              </button>
                           </div>
                        </div>
                     </div>
                   )}

                   <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Remarks</label>
                       <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs h-24 resize-none outline-none" value={validationForm.remarks} onChange={e => setValidationForm({...validationForm, remarks: e.target.value})} placeholder="Validation notes..." />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Submit IPCN Validation</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"
          >
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              toast.type === 'success' ? "bg-emerald-400" : "bg-rose-400"
            )} />
            <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuditEntry({ id, type, unit, score, total, timestamp, auditorEmail, auditorName, isValidated, validatedBy, validatorName, onValidate, isAdmin }: any) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const colorClass = percentage >= 90 ? 'text-emerald-600' : percentage >= 80 ? 'text-amber-600' : 'text-rose-600';
  const barClass = percentage >= 90 ? 'bg-emerald-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 hover:bg-slate-50/80 transition-all rounded-2xl group relative">
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all text-xs font-bold">
          {type === 'HH_COMPLIANCE' && <HandMetal className="w-5 h-5" />}
          {type === 'HH_AVAILABILITY' && <ClipboardCheck className="w-5 h-5" />}
          {type === 'PPE_AVAILABILITY' && <ShieldCheck className="w-5 h-5" />}
          {type === 'PPE_COMPLIANCE' && <ShieldCheck className="w-5 h-5" />}
          {type === 'ENV_CLEANING' && <Trash2 className="w-5 h-5" />}
          {type === 'SAFE_INJECTION' && <Syringe className="w-5 h-5" />}
        </div>
        <div className="flex-1 sm:hidden">
           <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{type.replace('_', ' ')}</span>
            {isValidated && <CheckCircle2 className="w-3 h-3 text-brand-primary" />}
          </div>
          <p className="text-xs font-bold text-slate-900">{unit}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden hidden sm:block">
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
              <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{auditorName || auditorEmail || 'System'}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{formatDate(timestamp)}</span>
           </div>
           {isValidated && (
             <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 uppercase tracking-tight">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Validated by: {validatorName || validatedBy}</span>
             </div>
           )}
        </div>
      </div>

      <div className="sm:hidden w-full flex items-center justify-between border-t border-slate-50 pt-2">
         <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{formatDate(timestamp)}</span>
            <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px]">{auditorName || auditorEmail || 'System'}</span>
         </div>
         {isValidated && (
             <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase tracking-tight">
                <CheckCircle2 className="w-2 h-2" />
                <span>Validated</span>
             </div>
           )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
        <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-24">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-bold text-slate-400">{score}/{total}</span>
            <span className={cn("text-base sm:text-lg font-black tracking-tighter", colorClass)}>{percentage}%</span>
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
          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                if (!window.confirm('Are you sure you want to delete this audit record?')) return;
                try {
                  await deleteDoc(doc(db, 'audits', id));
                } catch (error) {
                  console.error("Delete error:", error);
                  handleFirestoreError(error, OperationType.DELETE, `audits/${id}`);
                }
              }}
              className="p-1.5 sm:p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Audit"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            {!isValidated && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onValidate();
                }}
                className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                title="IPCN Validation"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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



