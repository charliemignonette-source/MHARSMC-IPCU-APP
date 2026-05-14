import React, { useState, useEffect } from 'react';
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
  Syringe,
  KeyRound,
  UserPlus,
  Edit3,
  UserMinus,
  Search,
  Lock,
  UserCheck
} from 'lucide-react';
import { collection, getDocs, writeBatch, setDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Role } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface MaintenanceProps {
  user: UserProfile | null;
}

export default function Maintenance({ user }: MaintenanceProps) {
  const [activeTab, setActiveTab] = useState<'DATA' | 'STAFF'>('DATA');
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [confirmText, setConfirmText] = useState('');
  const [staffConfirmText, setStaffConfirmText] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  // Staff States
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [newStaff, setNewStaff] = useState({
    staffCode: '',
    pin: '',
    role: 'USER' as Role,
    unit: 'General'
  });
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  const isAdmin = user?.role === 'IPCN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!isAdmin) return;
    
    const q = query(collection(db, 'user_roles'), orderBy('role'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStaffList(docs);
    });

    return () => unsubscribe();
  }, [isAdmin]);

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

  const handleResetStaff = async () => {
    if (staffConfirmText !== 'RESET') return;

    try {
      setResetStatus('PROCESSING');
      const q = query(collection(db, 'user_roles'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      let deleteCount = 0;
      snapshot.docs.forEach(docSnap => {
        const role = docSnap.data().role;
        // Keep ADMIN, IPCN, and PHARMACY roles as they are "system" roles the user wants to keep
        if (role !== 'ADMIN' && role !== 'IPCN' && role !== 'PHARMACY') {
          batch.delete(docSnap.ref);
          deleteCount++;
        }
      });
      
      if (deleteCount > 0) {
        await batch.commit();
      }
      
      setResetStatus('SUCCESS');
      setStaffConfirmText('');
      setTimeout(() => setResetStatus('IDLE'), 3000);
    } catch (err) {
      console.error("Staff wipe failed:", err);
      setResetStatus('ERROR');
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffRef = doc(db, 'user_roles', newStaff.staffCode);
    try {
      await setDoc(staffRef, {
        pin: newStaff.pin,
        role: newStaff.role,
        unit: newStaff.unit,
        updatedAt: new Date().toISOString()
      });
      setIsAddingStaff(false);
      setNewStaff({ staffCode: '', pin: '', role: 'USER', unit: 'General' });
    } catch (err) {
      console.error("Save staff failed:", err);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Delete this staff record?')) return;
    try {
      await deleteDoc(doc(db, 'user_roles', id));
    } catch (err) {
      console.error("Delete staff failed:", err);
    }
  };

  const handleEditStaff = (staff: any) => {
    setEditingStaff(staff);
    setNewStaff({
      staffCode: staff.id,
      pin: staff.pin,
      role: staff.role,
      unit: staff.unit || 'General'
    });
    setIsAddingStaff(true);
  };

  const filteredStaff = staffList.filter(s => 
    s.id.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
    (s.unit || '').toLowerCase().includes(staffSearch.toLowerCase())
  );

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

      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('DATA')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'DATA' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Data Management
        </button>
        <button 
          onClick={() => setActiveTab('STAFF')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'STAFF' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Staff Protocols
        </button>
      </nav>

      {activeTab === 'DATA' ? (
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
      ) : (
        <div className="space-y-6">
          <section className="bento-card p-6 bg-white space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search Staff Code, Role, or Unit..."
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl pl-11 pr-4 py-3 text-xs font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-rose-50 p-1 rounded-2xl border border-rose-100">
                  <input 
                    type="text"
                    value={staffConfirmText}
                    onChange={(e) => setStaffConfirmText(e.target.value.toUpperCase())}
                    placeholder="Type RESET"
                    className="bg-transparent border-none px-3 py-2 text-[10px] font-black uppercase tracking-widest placeholder:text-rose-300 focus:ring-0 w-24"
                  />
                  <button 
                    onClick={handleResetStaff}
                    disabled={staffConfirmText !== 'RESET'}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      staffConfirmText === 'RESET' 
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                        : "bg-rose-100 text-rose-300 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Wipe All
                  </button>
                </div>
                <button 
                  onClick={() => {
                    setEditingStaff(null);
                    setNewStaff({ staffCode: '', pin: '', role: 'USER', unit: 'General' });
                    setIsAddingStaff(true);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20"
                >
                  <UserPlus className="w-4 h-4" />
                  Register Staff
                </button>
              </div>
            </div>

            <div className="overflow-hidden bg-slate-50 rounded-3xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Code</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Security PIN</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Access Role</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unit / Ward</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-xs font-bold">No staff records found match your search criteria</td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-100/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100">
                              <KeyRound className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="text-xs font-black text-slate-700">{staff.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-slate-300" />
                            <span className="text-xs font-mono font-black text-slate-600 tracking-widest">••••</span>
                            <span className="text-[10px] font-bold text-slate-300 ml-1">({staff.pin})</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                            staff.role === 'ADMIN' ? "bg-rose-50 text-rose-600 border-rose-100" :
                            staff.role === 'IPCN' ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20" :
                            staff.role === 'PHARMACY' ? "bg-sky-50 text-sky-600 border-sky-100" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {staff.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-tight">
                          {staff.unit || 'General'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleEditStaff(staff)}
                              className="p-2 hover:bg-white hover:text-brand-primary rounded-xl transition-all text-slate-400"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="p-2 hover:bg-white hover:text-rose-500 rounded-xl transition-all text-slate-400"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Staff Modal */}
      <AnimatePresence>
        {isAddingStaff && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingStaff(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-800 tracking-tight">
                        {editingStaff ? 'Update Staff Protocol' : 'New Staff Registration'}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define access credentials</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveStaff} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Staff ID Code</label>
                    <input 
                      required
                      placeholder="e.g. S-1002"
                      disabled={!!editingStaff}
                      className="text-input disabled:bg-slate-50 disabled:text-slate-400"
                      value={newStaff.staffCode}
                      onChange={e => setNewStaff({...newStaff, staffCode: e.target.value.toUpperCase()})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Security PIN</label>
                      <input 
                        required
                        type="password"
                        placeholder="••••"
                        maxLength={4}
                        className="text-input"
                        value={newStaff.pin}
                        onChange={e => setNewStaff({...newStaff, pin: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Access Role</label>
                      <select 
                        className="text-input"
                        value={newStaff.role}
                        onChange={e => setNewStaff({...newStaff, role: e.target.value as Role})}
                      >
                        <option value="USER">User (Ward)</option>
                        <option value="APPROVER">Approver</option>
                        <option value="PHARMACY">Pharmacy</option>
                        <option value="IPCN">IPCN</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Assigned Unit</label>
                    <input 
                      required
                      placeholder="e.g. Medical Ward, ICU"
                      className="text-input"
                      value={newStaff.unit}
                      onChange={e => setNewStaff({...newStaff, unit: e.target.value})}
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAddingStaff(false)}
                      className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg"
                    >
                      {editingStaff ? 'Save Changes' : 'Register Protocol'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
