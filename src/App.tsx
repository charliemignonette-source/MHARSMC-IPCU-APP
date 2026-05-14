/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInAnonymously,
  User
} from 'firebase/auth';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Stethoscope, 
  ClipboardCheck, 
  Activity, 
  AlertTriangle,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ChevronRight,
  KeyRound,
  Hospital,
  FileBarChart,
  Microscope,
  Settings2,
  Download,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile, Role } from './types';
import { cn } from './lib/utils';

// Pages
import Dashboard from './components/Dashboard';
import Audits from './components/Audits';
import AMS from './components/AMS';
import HAI from './components/HAI';
import NSI from './components/NSI';
import Outbreak from './components/Outbreak';
import IPCUValidationConsole from './components/IPCUValidationConsole';
import Reports from './components/Reports';
import Antibiogram from './components/Antibiogram';
import Maintenance from './components/Maintenance';

const ADMIN_EMAILS = ['charliemignonette@gmail.com', 'beeohend@gmail.com', 'doc.julierose@gmail.com', 'ardeleon.mharsmc@gmail.com'];
const PHARMACY_EMAILS = ['salllydinesiso@gmail.com', 'pharmacy@mharsmc.doh.gov.ph'];
const IPCN_EMAILS = ['bjponz.22.bp@gmail.com', 'belzarinojrmacamay@gmail.com', 'maryjoy.jokjok13@gmail.com', 'noerensolitana@gmail.com', 'febemaecoronel@gmail.com', 'snmanugas@gmail.com', 'andreamaearcamo@gmail.com'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // PIN Login State
  const [loginMode, setLoginMode] = useState<'SELECT' | 'GOOGLE' | 'PIN'>('SELECT');
  const [staffCode, setStaffCode] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'IPCN'] },
    { id: 'validation', label: 'IPCU Validation', icon: ShieldAlert, roles: ['ADMIN', 'IPCN'] },
    { id: 'audits', label: 'IPC Audits', icon: ClipboardCheck, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'ams', label: 'Antimicrobial Stewardship', icon: Stethoscope, roles: ['ADMIN', 'IPCN', 'PHYSICIAN', 'PHARMACY', 'USER'] },
    { id: 'antibiogram', label: 'Cumulative Antibiogram', icon: Microscope, roles: ['ADMIN', 'IPCN', 'PHYSICIAN', 'USER'] },
    { id: 'hai', label: 'HAI & Bundles', icon: Activity, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'nsi', label: 'NSI Reporting', icon: AlertTriangle, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'outbreak', label: 'Outbreak Mgmt', icon: ShieldAlert, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'reports', label: 'System Reports', icon: FileBarChart, roles: ['ADMIN', 'IPCN', 'USER', 'PHYSICIAN', 'APPROVER'] },
    { id: 'maintenance', label: 'System Maintenance', icon: Settings2, roles: ['ADMIN', 'IPCN'] },
  ];

  const allowedTabs = profile ? allTabs.filter(tab => tab.roles.includes(profile.role)) : [];

  // If current active tab is not allowed after role change, switch to first allowed
  useEffect(() => {
    if (profile) {
      const isTabAllowed = allowedTabs.find(t => t.id === activeTab);
      if (!isTabAllowed) {
        // Guest users default to AMS to check their requests
        const defaultTab = profile.role === 'USER' ? 'ams' : (allowedTabs[0]?.id || 'audits');
        setActiveTab(defaultTab);
      }
    }
  }, [profile, allowedTabs, activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authStateUser) => {
      if (authStateUser) {
        setUser(authStateUser);
        // If Google user
        if (authStateUser.providerData.length > 0) {
          const docRef = doc(db, 'users', authStateUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            let updatedRole: typeof data.role | null = null;

            if (authStateUser.email && ADMIN_EMAILS.includes(authStateUser.email) && data.role !== 'ADMIN') {
              updatedRole = 'ADMIN';
            } else if (authStateUser.email && PHARMACY_EMAILS.includes(authStateUser.email) && data.role !== 'PHARMACY') {
              updatedRole = 'PHARMACY';
            } else if (authStateUser.email && IPCN_EMAILS.includes(authStateUser.email) && data.role !== 'IPCN') {
              updatedRole = 'IPCN';
            }

            if (updatedRole) {
              data.role = updatedRole;
              await setDoc(docRef, { role: updatedRole }, { merge: true });
            }
            setProfile(data);
          } else {
            const rolesQuery = query(collection(db, 'user_roles'), where('email', '==', authStateUser.email));
            const rolesSnap = await getDocs(rolesQuery);
            
            let role: Role = 'USER';
            let unit = 'ALL';
            
            if (authStateUser.email && ADMIN_EMAILS.includes(authStateUser.email)) {
              role = 'ADMIN';
            } else if (authStateUser.email && PHARMACY_EMAILS.includes(authStateUser.email)) {
              role = 'PHARMACY';
            } else if (authStateUser.email && IPCN_EMAILS.includes(authStateUser.email)) {
              role = 'IPCN';
            } else if (!rolesSnap.empty) {
              const roleData = rolesSnap.docs[0].data();
              role = roleData.role;
              unit = roleData.unit || 'ALL';
            }

            const newProfile: UserProfile = {
              uid: authStateUser.uid,
              email: authStateUser.email || '',
              name: authStateUser.displayName || 'Guardian Admin',
              role,
              unit,
              isVerified: true,
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } 
        // If Anonymous User
        else {
          const anonymousProfile: UserProfile = {
            uid: authStateUser.uid,
            name: 'Ward Staff',
            role: 'USER',
            unit: 'Medical Ward',
            isVerified: false,
            isAnonymous: true,
            createdAt: new Date().toISOString()
          };
          
          // Save anonymous profile to Firestore for persistence and rule evaluation
          const docRef = doc(db, 'users', authStateUser.uid);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            await setDoc(docRef, anonymousProfile);
            setProfile(anonymousProfile);
          } else {
            // Update existing if needed or just sync
            const existingData = docSnap.data() as UserProfile;
            setProfile(existingData);
          }
        }
      } else {
        // No user, sign in anonymously
        signInAnonymously(auth).catch(err => console.error("Auto-anon failed:", err));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (isLoggingIn) return;
    const provider = new GoogleAuthProvider();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('Login cancelled by user');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError('Login already in progress. Please check for an open popup window.');
      } else if (error.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        setLoginError(`DOMAIN UNAUTHORIZED: "${hostname}". 
        
To fix this:
1. Go to Firebase Console (https://console.firebase.google.com/)
2. Navigate to Authentication > Settings > Authorized domains
3. Click "Add domain" and paste the hostname shown above.
4. Wait a few seconds and try again.

Note: You must also add the domain from your "Shared App URL" if you intend to share this application.`);
      } else {
        setLoginError(error.message || 'Login failed');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginWithPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      // 1. Check if we already have an auth context
      let user;
      if (auth.currentUser) {
        user = auth.currentUser;
        console.log("Using existing auth user:", user.uid);
      } else {
        try {
          console.log("No user found, signing in anonymously...");
          const userCred = await signInAnonymously(auth);
          user = userCred.user;
          console.log("Anonymous login success:", user.uid);
        } catch (authError: any) {
          console.error("Anonymous auth failed:", authError);
          if (authError.code === 'auth/operation-not-allowed' || authError.code === 'auth/admin-restricted-operation') {
            throw new Error('ANONYMOUS LOGIN RESTRICTED: Please enable "Anonymous" in Firebase Console > Authentication > Sign-in method.');
          }
          throw authError;
        }
      }

      // 2. Search for the staff record
      console.log("Fetching staff record for ID:", staffCode);
      const docRef = doc(db, 'user_roles', staffCode);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (getDocError: any) {
        console.error("getDoc user_roles failed:", getDocError);
        throw new Error(`PERMISSIONS ERROR (user_roles): ${getDocError.message}`);
      }
      
      if (!docSnap.exists()) {
        console.log("Staff record not found for:", staffCode);
        setLoginError('Invalid Staff Code');
        if (!auth.currentUser?.email) await auth.signOut();
        setIsLoggingIn(false);
        return;
      }

      const userData = docSnap.data();
      console.log("Staff record found, verifying PIN...");
      
      if (userData.pin !== pin) {
        console.log("PIN mismatch for:", staffCode);
        setLoginError('Invalid PIN');
        if (!auth.currentUser?.email) await auth.signOut();
        setIsLoggingIn(false);
        return;
      }
      
      const pinProfile: UserProfile = {
        uid: user.uid,
        name: `Staff ${staffCode}`,
        role: userData.role || 'USER',
        unit: userData.unit || 'Unknown',
        staffCode: staffCode,
        isVerified: false,
        createdAt: new Date().toISOString()
      };

      // 3. Persist to users collection
      // We ensure the profile exists in the users collection.
      const isSystemAdmin = user.email && ADMIN_EMAILS.includes(user.email);
      if (isSystemAdmin) {
        pinProfile.role = 'ADMIN';
        pinProfile.isVerified = true;
      }

      console.log(`Persisting profile for ${user.email || 'Anonymous'} to users collection...`);
      try {
        await setDoc(doc(db, 'users', user.uid), pinProfile, { merge: true });
      } catch (setDocError: any) {
        console.error("setDoc users failed:", setDocError);
        throw new Error(`PERMISSIONS ERROR (users): ${setDocError.message}`);
      }

      localStorage.setItem('ipc_guard_pin_user', JSON.stringify(pinProfile));
      setProfile(pinProfile);
      setLoginMode('SELECT');
    } catch (error: any) {
      console.error("PIN Login failed - Detailed info:", {
        code: error.code,
        message: error.message,
        authStatus: auth.currentUser ? `Signed in as ${auth.currentUser.email || 'Anonymous'}` : 'Not signed in'
      });
      
      if (error.message?.includes('insufficient permissions')) {
        setLoginError('ACCESS DENIED: Your account does not have permission to log in with this PIN. (Firestore rules check failed)');
      } else {
        setLoginError(error.message || 'Authentication service error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInstall = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    });
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('ipc_guard_pin_user');
    setProfile(null);
    setActiveTab('dashboard');
  };

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-primary border-t-slate-200 rounded-2xl mb-4"
        />
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">Initializing Protocols...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] flex flex-col sm:flex-row bg-bg-main text-slate-800 overflow-hidden relative">
      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">Staff Authentication</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Access higher privilege protocols</p>
              </div>

              {loginError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-rose-700 leading-relaxed">{loginError}</p>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Enterprise Sign-In</label>
                  <button 
                    onClick={() => {
                        loginWithGoogle();
                        setIsLoginModalOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                    Login with Google
                  </button>
                </div>

                <div className="relative py-4 flex items-center gap-4">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OR USE STAFF ID</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <form onSubmit={loginWithPIN} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Staff Code</label>
                    <input 
                      required
                      className="text-input" 
                      placeholder="e.g. S-1001"
                      value={staffCode}
                      onChange={e => setStaffCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Personal PIN</label>
                    <input 
                      required
                      type="password"
                      className="text-input" 
                      placeholder="••••"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                    />
                  </div>
                  <button 
                    disabled={isLoggingIn}
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 active:scale-95 disabled:opacity-50"
                  >
                    {isLoggingIn ? 'Authenticating...' : 'Sign In via ID'}
                  </button>
                </form>
              </div>

              <button 
                onClick={() => setIsLoginModalOpen(false)}
                className="w-full mt-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                Continue as Guest (Ward Staff)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Sidebar - Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-[70] lg:hidden flex flex-col shadow-2xl border-r border-slate-200"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-primary p-2 rounded-lg text-white">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h1 className="text-sm font-black tracking-tight uppercase leading-tight">IPC Guard</h1>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
                {allowedTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-4 w-full px-4 py-3 text-sm font-bold rounded-2xl transition-all",
                        activeTab === tab.id 
                          ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", activeTab === tab.id ? "text-white" : "text-slate-400")} />
                      <span className="flex-1 text-left">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-100 mt-auto">
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                    {profile?.name?.[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{profile?.name}</p>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{profile?.role}</p>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-2xl transition-all uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4" />
                  Terminate Session
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0",
      )}>
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary p-2 rounded-lg text-white">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight uppercase leading-tight">IPC Guard</h1>
              <p className="text-[10px] text-slate-500 font-medium">Command Center</p>
            </div>
          </div>
        </div>

        <nav className="mt-4 flex-1 px-3 flex flex-col gap-1">
          {allowedTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-2.5 text-xs font-bold rounded-xl transition-all group",
                  activeTab === tab.id 
                    ? "bg-brand-primary text-white shadow-lg shadow-teal-900/20" 
                    : "text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm"
                )}
              >
                <Icon className={cn("w-4 h-4", activeTab === tab.id ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                <span className="flex-1 text-left">{tab.label}</span>
                {activeTab === tab.id && <div className="w-1.5 h-1.5 rounded-full bg-white/50" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
              {profile?.name?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{profile?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
               <div className={cn(
                 "flex items-center gap-2 px-2 py-1 rounded-full border text-[10px] font-bold",
                 profile?.role === 'USER' 
                   ? "bg-slate-50 text-slate-500 border-slate-200" 
                   : "bg-green-50 text-green-700 border-green-100"
               )}>
                 <div className={cn(
                   "w-1.5 h-1.5 rounded-full animate-pulse",
                   profile?.role === 'USER' ? "bg-slate-400" : "bg-green-500"
                 )}></div>
                 <span className="hidden xs:inline">{profile?.role === 'USER' ? 'GUEST ACCESS ACTIVE' : 'PROTECTION ACTIVE'}</span>
                 <span className="xs:hidden font-black">{profile?.role === 'USER' ? 'GUEST' : 'ACTIVE'}</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
             {installPrompt && (
                <button 
                  onClick={handleInstall}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 active:scale-95 transition-all shadow-md mr-1 sm:mr-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Install App</span>
                  <span className="sm:hidden">Install</span>
                </button>
             )}
             {profile?.role === 'USER' ? (
                <button 
                   onClick={() => setIsLoginModalOpen(true)}
                   className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                >
                   <KeyRound className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">Staff Authentication</span>
                   <span className="sm:hidden">Login</span>
                </button>
             ) : (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                   <ShieldAlert className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">Admin Mode</span>
                   <span className="sm:hidden">Admin</span>
                </div>
             )}
             <div className="h-4 w-px bg-slate-200 mx-1 lg:mx-2" />
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
               {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
             </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-8 sm:py-6 lg:p-8 pb-32 sm:pb-8 no-scrollbar relative min-h-0">
          <AnimatePresence mode="wait">
            <div key={activeTab}>
              {activeTab === 'dashboard' && <Dashboard user={profile} onNavigate={(tab) => setActiveTab(tab)} />}
              {activeTab === 'validation' && <IPCUValidationConsole user={profile} />}
              {activeTab === 'audits' && <Audits user={profile} />}
              {activeTab === 'ams' && <AMS user={profile} />}
              {activeTab === 'antibiogram' && <Antibiogram user={profile} />}
              {activeTab === 'hai' && <HAI user={profile} />}
              {activeTab === 'nsi' && <NSI user={profile} />}
              {activeTab === 'outbreak' && <Outbreak user={profile} />}
              {activeTab === 'reports' && <Reports user={profile} />}
              {activeTab === 'maintenance' && <Maintenance user={profile} />}
            </div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
