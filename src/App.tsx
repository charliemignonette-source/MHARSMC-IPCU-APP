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
  FileBarChart
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

const ADMIN_EMAILS = ['charliemignonette@gmail.com', 'beeohend@gmail.com'];

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

  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'IPCN'] },
    { id: 'validation', label: 'IPCU Validation', icon: ShieldAlert, roles: ['ADMIN', 'IPCN'] },
    { id: 'audits', label: 'IPC Audits', icon: ClipboardCheck, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'ams', label: 'AMS Stewardship', icon: Stethoscope, roles: ['ADMIN', 'IPCN', 'PHYSICIAN', 'PHARMACY', 'USER'] },
    { id: 'hai', label: 'HAI & Bundles', icon: Activity, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'nsi', label: 'NSI Reporting', icon: AlertTriangle, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'outbreak', label: 'Outbreak Mgmt', icon: ShieldAlert, roles: ['ADMIN', 'IPCN', 'USER'] },
    { id: 'reports', label: 'System Reports', icon: FileBarChart, roles: ['ADMIN', 'IPCN'] },
  ];

  const allowedTabs = profile ? allTabs.filter(tab => tab.roles.includes(profile.role)) : [];

  // If current active tab is not allowed after role change, switch to first allowed
  useEffect(() => {
    if (profile) {
      const isTabAllowed = allowedTabs.find(t => t.id === activeTab);
      if (!isTabAllowed) {
        setActiveTab(allowedTabs[0]?.id || 'audits');
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
            if (authStateUser.email && ADMIN_EMAILS.includes(authStateUser.email)) {
              data.role = 'ADMIN';
            }
            setProfile(data);
          } else {
            const rolesQuery = query(collection(db, 'user_roles'), where('email', '==', authStateUser.email));
            const rolesSnap = await getDocs(rolesQuery);
            
            let role: Role = 'USER';
            let unit = 'ALL';
            
            if (authStateUser.email && ADMIN_EMAILS.includes(authStateUser.email)) {
              role = 'ADMIN';
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
            unit: 'General',
            isVerified: false,
            createdAt: new Date().toISOString()
          };
          setProfile(anonymousProfile);
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

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('ipc_guard_pin_user');
    setProfile(null);
    setActiveTab('dashboard');
  };

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
    <div className="min-h-screen bg-bg-main text-slate-800 flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform duration-300 lg:translate-x-0 lg:static",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="hidden lg:flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 text-[10px] font-bold">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                 PROTECTION ACTIVE
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {profile?.role === 'USER' ? (
                <button 
                   onClick={loginWithGoogle}
                   className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                >
                   <KeyRound className="w-3.5 h-3.5" />
                   Admin Access
                </button>
             ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                   <ShieldAlert className="w-3.5 h-3.5" />
                   Admin Mode
                </div>
             )}
             <div className="h-4 w-px bg-slate-200 mx-2" />
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
               {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
             </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard user={profile} />}
              {activeTab === 'validation' && <IPCUValidationConsole user={profile} />}
              {activeTab === 'audits' && <Audits user={profile} />}
              {activeTab === 'ams' && <AMS user={profile} />}
              {activeTab === 'hai' && <HAI user={profile} />}
              {activeTab === 'nsi' && <NSI user={profile} />}
              {activeTab === 'outbreak' && <Outbreak user={profile} />}
              {activeTab === 'reports' && <Reports user={profile} />}
            </motion.div>
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
