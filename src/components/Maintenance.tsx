import React, { useState } from 'react';
import { 
  Database, 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HardDrive,
  ClipboardCheck,
  ShieldCheck,
  Activity,
  Syringe
} from 'lucide-react';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface MaintenanceProps {
  user: UserProfile | null;
}

export default function Maintenance({ user }: MaintenanceProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [confirmText, setConfirmText] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const isAdmin = user?.role === 'IPCU' || user?.role === 'ADMIN';

  const dataCategories = [
    { id: 'audits', label: 'IPC Audits', icon: ClipboardCheck, collections: ['audits'] },
    { id: 'ams', label: 'AMS Requests', icon: ShieldCheck, collections: ['ams_requests'] },
    { id: 'hai', label: 'HAI & Bundles', icon: Activity, collections: ['hai_cases', 'boc_logs'] },
    { id: 'nsi', label: 'NSI Reports', icon: Syringe, collections: ['nsi_reports'] },
    { id: 'outbreak', label: 'Outbreak Mgmt', icon: ShieldAlert, collections: ['outbreaks'] },
    { id: 'logs', label: 'Validation Logs', icon: Database, collections: ['validation_logs'] },
  ];

  const handleToggleCollection = (id: string) => {
    setSelectedCollections(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET' || selectedCollections.length === 0) return;

    setIsResetting(true);
    setResetStatus('PROCESSING');

    try {
      const collectionsToClear = dataCategories
        .filter(cat => selectedCollections.includes(cat.id))
        .flatMap(cat => cat.collections);

      for (const collName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        
        querySnapshot.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        
        await batch.commit();
      }

      setResetStatus('SUCCESS');
      setConfirmText('');
      setSelectedCollections([]);
      setTimeout(() => setResetStatus('IDLE'), 3000);
    } catch (error) {
      console.error('Reset error:', error);
      setResetStatus('ERROR');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Unauthorized Access</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 pb-20">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 rounded-xl">
            <HardDrive className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">System Maintenance</h1>
        </div>
        <p className="text-sm text-slate-500 font-medium ml-1">Manage database integrity and beta testing cycles</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="bento-card p-6 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Data Disposal</h2>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold uppercase">Beta Support Enabled</span>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Select the modules you wish to clear. This will permanently delete all records within the selected categories. This action cannot be undone.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {dataCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleToggleCollection(cat.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                    selectedCollections.includes(cat.id)
                      ? "border-rose-500 bg-rose-50/30 text-rose-700"
                      : "border-slate-100 hover:border-slate-200 text-slate-600"
                  )}
                >
                  <cat.icon className={cn("w-4 h-4", selectedCollections.includes(cat.id) ? "text-rose-500" : "text-slate-400")} />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bento-card p-6 bg-slate-900 text-white space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold uppercase tracking-tight">Destructive Action Confirmation</h3>
              </div>
              
              <div className="space-y-4">
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                  To proceed with the deletion of <span className="text-white font-bold">{selectedCollections.length}</span> categories, please type <span className="text-rose-400 font-black tracking-widest">RESET</span> below.
                </p>

                <div className="relative">
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type RESET to confirm"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-black tracking-widest placeholder:text-white/20 focus:outline-none focus:border-rose-500/50 transition-all"
                  />
                  {confirmText === 'RESET' && (
                    <div className="absolute right-3 top-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  disabled={confirmText !== 'RESET' || selectedCollections.length === 0 || isResetting}
                  className={cn(
                    "w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                    confirmText === 'RESET' && selectedCollections.length > 0
                      ? "bg-rose-500 hover:bg-rose-600 shadow-xl shadow-rose-500/20"
                      : "bg-white/5 text-slate-500 cursor-not-allowed"
                  )}
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Wiping Database...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Wipe Selected Data
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bento-card p-6 bg-white space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Wipe Stats</h4>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xl font-black text-slate-800">{selectedCollections.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">Categories Target</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xl font-black text-slate-800">0</p>
                <p className="text-[10px] font-black text-slate-400 uppercase">Profiles Impacted</p>
                <p className="text-[8px] font-bold text-emerald-600 mt-1 uppercase">User database protected</p>
              </div>
            </div>
          </div>

          <div className="bento-card p-6 bg-slate-50 border-dashed border-2 border-slate-200">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Maintenance Status</h4>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse",
                resetStatus === 'PROCESSING' ? "bg-amber-500" : "bg-emerald-500"
              )} />
              <p className="text-[10px] font-bold text-slate-600 uppercase">
                {resetStatus === 'PROCESSING' ? 'Transaction in progress' : 'Systems Operational'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {resetStatus === 'SUCCESS' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-xs font-black uppercase tracking-widest">Database wipes successfully</p>
          </motion.div>
        )}
        {resetStatus === 'ERROR' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3"
          >
            <XCircle className="w-5 h-5" />
            <p className="text-xs font-black uppercase tracking-widest">System error during wipe</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
