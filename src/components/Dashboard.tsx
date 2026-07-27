import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { 
  TrendingUp, Activity, ClipboardCheck, AlertTriangle, ShieldAlert, 
  Users, Calendar, ArrowDownRight, Download, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, limit, orderBy, where, doc } from 'firebase/firestore';
import { db, safeGetDocs, safeDeleteDoc } from '../lib/firebase';
const getDocs = safeGetDocs;
const deleteDoc = safeDeleteDoc;
import { UserProfile, BOCLog } from '../types';
import { cn, getComplianceColor, formatDate , mapLegacyData } from '../lib/utils';
import { 
  ShieldCheck, Crosshair, Thermometer, Droplets, Wind, Scissors,
  Database, FlaskConical, ArrowUpRight
} from 'lucide-react';





export default function Dashboard({ user, onNavigate }: { user: UserProfile | null, onNavigate?: (tab: string) => void }) {

  const [rawLogs, setRawLogs] = useState<{
    boc: BOCLog[];
    ams: any[];
    nsi: any[];
    audits: any[];
    outbreaks: any[];
    hais: any[];
  }>({ boc: [], ams: [], nsi: [], audits: [], outbreaks: [], hais: [] });
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [stats, setStats] = useState({
    hhCompliance: 91.2,
    ppeCompliance: 88.5,
    envCompliance: 89.0,
    complianceTrends: [] as any[],
    amsTrends: [] as any[],
    activeAMS: 0,
    recentHAIs: 0,
    nsiToday: 0,
    validatedCount: 0,
    pendingVerificationCount: 0,
    pendingReports: [] as any[],
    totalCount: 0,
    auditsCount: 0,
    amsCount: 0,
    bundles: {
      today: { 
        CLABSI: 0, CAUTI: 0, VENTILATOR: 0, SURGICAL_SITE: 0, overall: 0,
        counts: { CLABSI: 0, CAUTI: 0, VENTILATOR: 0, SURGICAL_SITE: 0 }
      },
      mtd: { 
        CLABSI: 0, CAUTI: 0, VENTILATOR: 0, SURGICAL_SITE: 0, overall: 0,
        topVariances: { CLABSI: [], CAUTI: [], VENTILATOR: [], SURGICAL_SITE: [] }
      },
      units: [] as any[],
      flags: { red: 0, yellow: 0, blue: 0, black: 0 },
      trends: [] as any[]
    },
    safety: {
      nsiMTD: 0,
      exposedStaff: 0
    }
  });

  useEffect(() => {
    async function fetchStats() {
      // Role Guard: Regular users should not trigger these full collection scans
      if (!user || (user.role !== 'ADMIN' && user.role !== 'IPCN')) {
        return;
      }
      try {
        // Fetch only the most recent records to prevent quota exhaustion
        const audits = await getDocs(query(collection(db, 'audits'), limit(50)));
        const hais = await getDocs(query(collection(db, 'hai_cases'), limit(50)));
        const boc = await getDocs(query(collection(db, 'boc_logs'), limit(50)));
        const ams = await getDocs(query(collection(db, 'ams_requests'), limit(50)));
        const nsi = await getDocs(query(collection(db, 'nsi_reports'), limit(50)));
        const outbreaks = await getDocs(query(collection(db, 'outbreaks'), limit(50)));
        const monitorings = await getDocs(query(collection(db, 'bundle_monitorings'), limit(50)));

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA'); 
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const bocData = boc.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as BOCLog));
        const amsData = ams.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as any));
        const nsiData = nsi.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as any));
        const auditData = audits.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as any));
        const outbreakData = outbreaks.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as any));
        const haiData = hais.docs.map(d => ({ ...mapLegacyData(d.data()), id: d.id } as any));
        
        // Merge daily monitorings into bocData
        monitorings.docs.forEach(docSnap => {
          const data = mapLegacyData(docSnap.data());
          const days = data.monitoringDays || [];
          days.forEach((day: any, index: number) => {
             const devMap: Record<string, string> = {
               'CLABSI': 'CENTRAL_LINE',
               'CAUTI': 'FOLEY',
               'VAP': 'VENTILATOR',
               'SSI': 'SURGICAL_SITE'
             };
             const dev = devMap[day.bundleType] || day.bundleType;
             
             // Create mock BOCLog
             const mockBoc: BOCLog = {
               id: `${docSnap.id}-${index}`,
               date: day.date,
               time: '00:00',
               unit: data.unit,
               patientName: data.patientName,
               hospNo: data.hospitalNo || '',
               age: data.age || '',
               sex: data.sex || 'Male',
               devicesPresent: [dev],
               bundles: {
                 [dev]: {
                   isCompliant: day.complianceScores?.bundle === 100 || day.compliancePercentage === 100,
                   elements: day.elementScores || {} // we might not have exact element breakdown here, but we can try
                 } as any
               },
               bundleType: day.bundleType,
               totalApplicable: 1,
               totalCompliant: (day.complianceScores?.bundle === 100 || day.compliancePercentage === 100) ? 1 : 0,
               compliancePercentage: day.complianceScores?.overall || day.compliancePercentage || 0,
               staffName: data.staffName || '',
               staffDesignation: '',
               staffId: data.staffId || '',
               isValidated: day.isVerifiedByIPCU === true,
               status: day.isVerifiedByIPCU ? "VALIDATED" : "PENDING"

             };
             bocData.push(mockBoc);
          });
        });

        setRawLogs({ 
          boc: bocData, 
          ams: amsData, 
          nsi: nsiData, 
          audits: auditData, 
          outbreaks: outbreakData,
          hais: haiData
        });

        // 1. Calculate Monthly Compliance Data (Last 4 Months)
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const last4Months = [];
        for (let i = 3; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const m = d.getMonth();
          const y = d.getFullYear();
          
          const monthAudits = auditData.filter(a => {
            const date = a.createdAt?.toDate?.() || new Date(a.timestamp);
            return date.getMonth() === m && date.getFullYear() === y;
          });

          const hh = monthAudits.filter(a => a.type === 'HH_COMPLIANCE');
          const ppe = monthAudits.filter(a => a.type === 'PPE_COMPLIANCE');
          const env = monthAudits.filter(a => a.type === 'ENV_CLEANING');
          
          const calcMonthAvg = (list: any[]) => {
            if (list.length === 0) return 0;
            const score = list.reduce((acc, a) => acc + (a.score || 0), 0);
            const total = list.reduce((acc, a) => acc + (a.total || 1), 0);
            return (score / total) * 100;
          };

          last4Months.push({
            month: months[m],
            hh: calcMonthAvg(hh),
            ppe: calcMonthAvg(ppe),
            env: calcMonthAvg(env),
            ams: amsData.filter(a => {
              const date = a.createdAt?.toDate?.() || (a.dateTimeRequested ? new Date(a.dateTimeRequested) : null);
              return date && !isNaN(date.getTime()) && date.getMonth() === m && date.getFullYear() === y;
            }).length * 10 // scale for visualization
          });
        }

        // Process Domain Metrics
        const activeAMS = amsData.filter(d => d.status === 'PENDING').length;
        const nsiMTD = nsiData.filter(d => {
          const date = d.createdAt?.toDate?.() || new Date(d.createdAt);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }).length;

        const hhAudits = auditData.filter(a => a.type === 'HH_COMPLIANCE');
        const ppeAudits = auditData.filter(a => a.type === 'PPE_COMPLIANCE');
        const envAudits = auditData.filter(a => a.type === 'ENV_CLEANING');

        const calcAvg = (list: any[]) => {
          if (list.length === 0) return 0;
          const totalScore = list.reduce((acc, a) => acc + (a.score || 0), 0);
          const totalMax = list.reduce((acc, a) => acc + (a.total || 1), 0);
          return (totalScore / totalMax) * 100;
        };
        
        // Process Bundle Stats
        const todayLogs = bocData.filter(l => l.date === todayStr);
        const mtdLogs = bocData.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const calculateCompliance = (logs: BOCLog[]) => {
          const deviceStats: Record<string, { total: number, compliant: number, variances: Record<string, number> }> = {
            CENTRAL_LINE: { total: 0, compliant: 0, variances: {} },
            FOLEY: { total: 0, compliant: 0, variances: {} },
            VENTILATOR: { total: 0, compliant: 0, variances: {} },
            SURGICAL_SITE: { total: 0, compliant: 0, variances: {} }
          };

          logs.forEach(log => {
            log.devicesPresent?.forEach(dev => {
              const bundle = log.bundles?.[dev];
              if (bundle) {
                deviceStats[dev].total++;
                if (bundle.isCompliant) {
                  deviceStats[dev].compliant++;
                } else {
                  // Track variances (non-compliant items)
                  Object.entries(bundle.elements || {}).forEach(([el, val]) => {
                    if (!val) {
                      deviceStats[dev].variances[el] = (deviceStats[dev].variances[el] || 0) + 1;
                    }
                  });
                }
              }
            });
          });

          const getTopVariances = (dev: string) => {
            return Object.entries(deviceStats[dev].variances)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([label]) => label);
          };

          return {
            CLABSI: deviceStats.CENTRAL_LINE.total > 0 ? (deviceStats.CENTRAL_LINE.compliant / deviceStats.CENTRAL_LINE.total) * 100 : 0,
            CAUTI: deviceStats.FOLEY.total > 0 ? (deviceStats.FOLEY.compliant / deviceStats.FOLEY.total) * 100 : 0,
            VENTILATOR: deviceStats.VENTILATOR.total > 0 ? (deviceStats.VENTILATOR.compliant / deviceStats.VENTILATOR.total) * 100 : 0,
            SURGICAL_SITE: deviceStats.SURGICAL_SITE.total > 0 ? (deviceStats.SURGICAL_SITE.compliant / deviceStats.SURGICAL_SITE.total) * 100 : 0,
            overall: logs.length > 0 ? logs.reduce((acc, l) => acc + (l.compliancePercentage || 0), 0) / logs.length : 0,
            counts: {
              CLABSI: deviceStats.CENTRAL_LINE.total,
              CAUTI: deviceStats.FOLEY.total,
              VENTILATOR: deviceStats.VENTILATOR.total,
              SURGICAL_SITE: deviceStats.SURGICAL_SITE.total
            },
            topVariances: {
              CLABSI: getTopVariances('CENTRAL_LINE'),
              CAUTI: getTopVariances('FOLEY'),
              VENTILATOR: getTopVariances('VENTILATOR'),
              SURGICAL_SITE: getTopVariances('SURGICAL_SITE')
            }
          };
        };

        // Flags calculation
        const redFlags = todayLogs.filter(l => l.compliancePercentage < 100).length;
        const yellowFlags = todayLogs.filter(l => !l.patientName || !l.hospNo).length;
        
        // Blue Flags: Device present but no bundle form submitted
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayLogs = bocData.filter(l => l.date === yesterdayStr);
        const activePatientsYesterday = new Set(yesterdayLogs.map(l => l.patientName));
        const activePatientsToday = new Set(todayLogs.map(l => l.patientName));
        const blueFlags = Array.from(activePatientsYesterday).filter(p => !activePatientsToday.has(p)).length;

        // Black Flags: Repeated non-compliance (>=3 days)
        const patientHistory: Record<string, number> = {};
        bocData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(log => {
          if (log.compliancePercentage < 100) {
            patientHistory[log.patientName] = (patientHistory[log.patientName] || 0) + 1;
          }
        });
        const blackFlags = Object.values(patientHistory).filter(count => count >= 3).length;

        // Trends (Last 30 days)
        const last30Days = [...Array(30)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          const dateStr = d.toISOString().split('T')[0];
          const dayLogs = bocData.filter(l => l.date === dateStr);
          const comp = calculateCompliance(dayLogs);
          return { date: dateStr, ...comp };
        });

        // Unit Compliance (All time or MTD)
        const unitStats: Record<string, any> = {};
        bocData.forEach(log => {
          if (!unitStats[log.unit]) unitStats[log.unit] = { unit: log.unit, logs: [] };
          unitStats[log.unit].logs.push(log);
        });
        const unitList = Object.values(unitStats).map(u => ({
          name: u.unit,
          ...calculateCompliance(u.logs)
        })).sort((a, b) => b.overall - a.overall);

        // Verification Stats
        const validatedLogs = bocData.filter(l => l.isValidated);
        const discrepancies = validatedLogs.filter(l => l.verification?.accuracy.status === 'Inaccurate' || l.verification?.finalDecision === 'Non-compliant').length;
        const accuracyRate = validatedLogs.length > 0 ? ((validatedLogs.length - discrepancies) / validatedLogs.length) * 100 : 100;
        
        const commonErrors: Record<string, number> = {};
        validatedLogs.forEach(l => {
          if (l.verification?.reason) {
            commonErrors[l.verification.reason] = (commonErrors[l.verification.reason] || 0) + 1;
          }
        });

        const errorStats = Object.entries(commonErrors)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label, count]) => ({ label, count }));

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const allDocs = [
          ...auditData.map(a => ({ ...a, __type: 'AUDIT', __date: a.createdAt?.toDate?.() || new Date(a.timestamp) })),
          ...haiData.map(h => ({ ...h, __type: 'HAI', __date: h.createdAt?.toDate?.() || new Date(h.triggerDate) })),
          ...bocData.map(b => ({ ...b, __type: 'BUNDLE', __date: b.createdAt?.toDate?.() || new Date(b.date) })),
          ...amsData.map(a => ({ ...a, __type: 'AMS', __date: a.createdAt?.toDate?.() || (a.dateTimeRequested ? new Date(a.dateTimeRequested) : (a.date ? new Date(a.date) : new Date())) })),
          ...nsiData.map(n => ({ ...n, __type: 'NSI', __date: n.createdAt?.toDate?.() || new Date() })),
          ...outbreakData.map(o => ({ ...o, __type: 'OUTBREAK', __date: o.createdAt?.toDate?.() || new Date(o.detectedAt) }))
        ];

        const pendingReportsList = allDocs.filter((d: any) => { 
          if (d.__type === 'AMS') { 
            if ((d.status === 'PENDING' || d.status === 'APPROVED') && d.__date < oneMonthAgo) {
              return false;
            }
            return d.status === 'PENDING' || d.status === 'APPROVED'; 
          } 
          return !(d.isValidated || d.status === 'VALIDATED' || d.status === 'APPROVED' || d.status === 'REJECTED' || d.status === 'RESOLVED' || !!d.validation?.decision); 
        }).sort((a: any, b: any) => b.__date.getTime() - a.__date.getTime());

        const total = allDocs.length;
        const validated = allDocs.filter((d: any) => d.isValidated || d.status === 'VALIDATED' || d.status === 'APPROVED' || d.status === 'REJECTED' || d.status === 'RESOLVED' || !!d.validation?.decision).length;

        setStats(prev => ({
          ...prev,
          validatedCount: validated,
          pendingVerificationCount: pendingReportsList.length,
          totalCount: total,
          complianceTrends: last4Months,

          activeAMS: amsData.filter(d => {
            const dDate = d.createdAt?.toDate?.() || (d.dateTimeRequested ? new Date(d.dateTimeRequested) : (d.date ? new Date(d.date) : new Date()));
            return d.status === 'PENDING' && dDate >= oneMonthAgo;
          }).length,
          recentHAIs: haiData.length,
          auditsCount: auditData.length,
          amsCount: amsData.length,
          outbreakCount: outbreakData.length,
          allReports: allDocs.sort((a: any, b: any) => b.__date.getTime() - a.__date.getTime()).slice(0, 5),
          pendingReports: pendingReportsList,
          hhCompliance: calcAvg(hhAudits),
          ppeCompliance: calcAvg(ppeAudits),
          envCompliance: calcAvg(envAudits),
          nsiToday: nsiData.filter((d: any) => {
            const date = d.createdAt?.toDate?.() || new Date();
            return date.toDateString() === new Date().toDateString();
          }).length,
          safety: {
            nsiMTD: nsiMTD,
            exposedStaff: nsiData.filter((d: any) => d.exposureSourceType === 'Known Positive').length
          },
          bundles: {
            today: calculateCompliance(todayLogs),
            mtd: calculateCompliance(mtdLogs),
            units: unitList,
            flags: { red: redFlags, yellow: yellowFlags, blue: blueFlags, black: blackFlags },
            trends: last30Days,
            verification: {
              accuracy: accuracyRate,
              total: validatedLogs.length,
              discrepancies: discrepancies,
              errors: errorStats,
              accuracyTrends: [...Array(30)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (29 - i));
                const dateStr = d.toISOString().split('T')[0];
                const dayLogs = bocData.filter(l => l.isValidated && l.date === dateStr);
                const dayDisc = dayLogs.filter(l => l.verification?.accuracy.status === 'Inaccurate' || l.verification?.finalDecision === 'Non-compliant').length;
                return { 
                  date: dateStr, 
                  accuracy: dayLogs.length > 0 ? ((dayLogs.length - dayDisc) / dayLogs.length) * 100 : 100 
                };
              })
            }
          }
        }));
      } catch (error) {
        console.warn('Stats error:', error);
      }
    }
    fetchStats();
  }, []);

  const purgeData = async () => {
    const collections = ['ams_requests', 'audits', 'boc_logs', 'hai_cases', 'nsi_reports', 'outbreaks', 'bundle_monitorings'];
    let count = 0;

    try {
      for (const collName of collections) {
        const snap = await getDocs(collection(db, collName));
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, collName, docSnap.id));
          count++;
        }
      }
      showToast(`Purge Complete! ${count} documents removed.`);
      window.location.reload();
    } catch (error) {
      console.warn("Purge failed:", error);
      showToast("Purge failed.", "error");
    }
  };

  const clinicalReports = stats.pendingReports.filter((r: any) => r.__type !== 'AMS');
  const amsPendingReports = stats.pendingReports.filter((r: any) => r.__type === 'AMS' && r.status === 'PENDING');
  const pharmacyReports = stats.pendingReports.filter((r: any) => r.__type === 'AMS' && r.status === 'APPROVED');

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex items-center justify-between">
         <div className="hidden md:block" />
         {(user?.role === 'ADMIN' || user?.role === 'IPCN') && (
            <div />
        )}
      </div>

      {/* 🚀 COMMAND CENTER LAUNCHPAD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'validation', activeTab: 'IPCU', label: 'IPC Validation', color: 'bg-indigo-600', icon: ShieldCheck, desc: 'Daily Bundle Audits' },
          { id: 'antibiogram', activeTab: 'OVERALL', label: 'Antibiogram', color: 'bg-emerald-600', icon: Database, desc: 'Resistance Patterns 2025' },
          { id: 'ams', activeTab: 'AMS', label: 'Antimicrobial Stewardship', color: 'bg-teal-600', icon: FlaskConical, desc: 'Drug Request Console' },
          { id: 'audits', activeTab: 'AUDITS', label: 'IPC Audits', color: 'bg-amber-600', icon: ClipboardCheck, desc: 'HH, PPE & ENV' }
        ].map((tile) => (
          <button
            key={tile.id}
            onClick={() => onNavigate && onNavigate(tile.id)}
            className={`flex flex-col items-start p-5 rounded-3xl text-left transition-all hover:scale-105 active:scale-95 text-white ${tile.color} shadow-lg shadow-${tile.color.replace('bg-', '')}/30`}
          >
            <tile.icon className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="font-black text-lg leading-tight">{tile.label}</h3>
            <p className="text-xs font-medium opacity-80 mt-1">{tile.desc}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">IPC COMMAND</h2>
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">Period: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>

        <div className="space-y-6">
          {stats.pendingVerificationCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-900 tracking-tight">Pending Verifications</h4>
                  <p className="text-[10px] font-bold text-amber-700/80 uppercase tracking-widest mt-0.5">There are {stats.pendingVerificationCount} records awaiting validation</p>
                </div>
              </div>
              <button onClick={() => setShowPendingModal(true)} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 active:scale-95 transition-all shadow-md shadow-amber-600/20">Review Now</button>
            </div>
          )}
          {/* High-Level Highlight Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bento-card p-4 sm:p-6 bg-slate-900 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-4 sm:mb-6">Data Integrity Index</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">
                  {stats.totalCount > 0 ? Math.round((stats.validatedCount / stats.totalCount) * 100) : 100}%
               </div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-slate-400 uppercase">Validated Reports</span>
                  <span>{stats.validatedCount} / {stats.totalCount}</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-brand-primary text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-100 mb-4 sm:mb-6">Device Bundle Adherence</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{Math.round(stats.bundles.today.overall)}%</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-teal-200">MTD AVG</span>
                  <span>{Math.round(stats.bundles.mtd.overall)}%</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-emerald-600 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-4 sm:mb-6">IPC Audits Compliance</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{Math.round((stats.hhCompliance + stats.ppeCompliance + stats.envCompliance) / 3 || 0)}%</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-emerald-200">AUDITS MTD</span>
                  <span>{stats.auditsCount}</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-amber-500 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-100 mb-4 sm:mb-6">Antimicrobial Stewardship</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{stats.activeAMS}</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-amber-200">PENDING ACTIONS</span>
                  <span>{stats.amsCount} TOTAL</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <BundleSummaryCard 
              label="CLABSI Protocol" 
              today={stats.bundles.today.CLABSI} 
              mtd={stats.bundles.mtd.CLABSI} 
              icon={Droplets}
              color="text-emerald-500"
              bgColor="bg-emerald-50"
            />
            <BundleSummaryCard 
              label="CAUTI Protocol" 
              today={stats.bundles.today.CAUTI} 
              mtd={stats.bundles.mtd.CAUTI} 
              icon={Thermometer}
              color="text-amber-500"
              bgColor="bg-amber-50"
            />
            <BundleSummaryCard 
              label="VAP/VAE Respiratory" 
              today={stats.bundles.today.VENTILATOR} 
              mtd={stats.bundles.mtd.VENTILATOR} 
              icon={Wind}
              color="text-sky-500"
              bgColor="bg-sky-50"
            />
            <BundleSummaryCard 
              label="SSI Surgical Site" 
              today={stats.bundles.today.SURGICAL_SITE} 
              mtd={stats.bundles.mtd.SURGICAL_SITE} 
              icon={Scissors}
              color="text-rose-500"
              bgColor="bg-rose-50"
            />
          </div>

          <AnimatePresence>
            {showPendingModal && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-md">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
                  <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                       <ShieldAlert className="w-5 h-5 text-amber-600" />
                       <h3 className="text-sm font-black uppercase tracking-tight text-amber-900">Pending IPC Verifications</h3>
                    </div>
                    <button onClick={() => setShowPendingModal(false)} className="p-2 hover:bg-amber-100 rounded-full transition-colors text-amber-600">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-6 custom-scrollbar">
                    {stats.pendingReports.length === 0 ? (
                      <p className="text-center text-sm font-bold text-slate-500 py-8">No pending verifications found.</p>
                    ) : (
                      <div className="space-y-6">
                        {/* Clinical / IPC Reviews Section */}
                        {clinicalReports.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-3 py-1 rounded-md bg-slate-100 inline-block">
                              🔬 Clinical & IPC Verifications
                            </h4>
                            <div className="space-y-5">
                              {['BUNDLE', 'AUDIT', 'HAI', 'NSI', 'OUTBREAK'].map(type => {
                                const groupReports = clinicalReports.filter((r: any) => r.__type === type);
                                if (groupReports.length === 0) return null;
                                return (
                                  <div key={type} className="space-y-3">
                                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 pb-1.5 border-b border-slate-100">
                                      {type} REPORTS ({groupReports.length})
                                    </h5>
                                    {groupReports.map((report: any, idx: number) => (
                                      <div key={`${report.id || Math.random()}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                                        <div className="flex items-center gap-4">
                                          <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs",
                                            report.__type === 'AUDIT' ? 'bg-amber-500' :
                                            report.__type === 'BUNDLE' ? 'bg-indigo-500' :
                                            report.__type === 'HAI' ? 'bg-rose-500' :
                                            report.__type === 'NSI' ? 'bg-orange-500' : 'bg-slate-500'
                                          )}>
                                            {report.__type?.[0]}
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{report.__type} REPORT • {report.unit || report.incident?.unit || 'GEN'}</p>
                                            <p className="text-[10px] font-medium text-slate-500 italic">By {report.auditorName || report.staffName || report.prescriberName || report.reporterName || report.reportedBy || report.reporterEmail || 'Staff Member'}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(report.__date)}</p>
                                            <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 bg-amber-100 text-amber-700">
                                              PENDING
                                            </div>
                                          </div>
                                          <button onClick={() => { setShowPendingModal(false); onNavigate && onNavigate(report.__type === 'BUNDLE' ? 'hai' : report.__type === 'AUDIT' ? 'audits' : report.__type.toLowerCase()); }} className="p-2 bg-white shadow-sm border border-slate-200 rounded-xl hover:border-brand-primary hover:text-brand-primary transition-colors">
                                            <ArrowDownRight className="w-4 h-4 -rotate-90" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Combined Antimicrobial Stewardship (AMS) Section */}
                        {(amsPendingReports.length > 0 || pharmacyReports.length > 0) && (
                          <div className="space-y-4 pt-4 border-t border-slate-200/80">
                            <h4 className="text-xs font-black uppercase tracking-widest text-teal-800 px-3 py-1 rounded-md bg-teal-50 inline-block border border-teal-100">
                              🧬 Antimicrobial Stewardship (AMS) Queue
                            </h4>

                            <div className="space-y-5">
                              {/* Clinical AMS Reviews Needed */}
                              {amsPendingReports.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-[10px] font-black uppercase tracking-wider text-teal-600 pb-1.5 border-b border-teal-50">
                                    🔬 CLINICAL REVIEWS NEEDED ({amsPendingReports.length})
                                  </h5>
                                  {amsPendingReports.map((report: any, idx: number) => (
                                    <div key={`${report.id || Math.random()}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                                      <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-teal-500 font-black text-xs">
                                          A
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                                            AMS CLINICAL REPORT • {report.unit || 'GEN'}
                                          </p>
                                          <p className="text-[10px] font-medium text-slate-500 italic">
                                            By {report.requestingPhysician || report.prescriberName || report.staffName || 'Staff Member'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(report.__date)}</p>
                                          <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 bg-amber-100 text-amber-700">
                                            PENDING REVIEW
                                          </div>
                                        </div>
                                        <button onClick={() => { setShowPendingModal(false); onNavigate && onNavigate('ams'); }} className="p-2 bg-white shadow-sm border border-slate-200 rounded-xl hover:border-brand-primary hover:text-brand-primary transition-colors">
                                          <ArrowDownRight className="w-4 h-4 -rotate-90" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Pharmacy Reviews / Dispensing */}
                              {pharmacyReports.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-[10px] font-black uppercase tracking-wider text-sky-600 pb-1.5 border-b border-sky-50">
                                    💊 HEADING TO PHARMACY FOR DISPENSING ({pharmacyReports.length})
                                  </h5>
                                  {pharmacyReports.map((report: any, idx: number) => (
                                    <div key={`${report.id || Math.random()}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-sky-50/5 transition-colors border border-transparent hover:border-sky-100">
                                      <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-sky-500 font-black text-xs">
                                          P
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                                            PHARMACY REPORT • {report.unit || 'GEN'}
                                          </p>
                                          <p className="text-[10px] font-medium text-slate-500 italic">
                                            Approved for dispensing • By {report.requestingPhysician || report.prescriberName || 'Staff Member'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(report.__date)}</p>
                                          <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 bg-sky-100 text-sky-700 border border-sky-200">
                                            TO DISPENSE
                                          </div>
                                        </div>
                                        <button onClick={() => { setShowPendingModal(false); onNavigate && onNavigate('ams'); }} className="p-2 bg-white shadow-sm border border-slate-200 rounded-xl hover:border-sky-500 hover:text-sky-600 transition-colors">
                                          <ArrowDownRight className="w-4 h-4 -rotate-90" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <div className="grid grid-cols-12 gap-6">
            {/* Recent Intelligence Feed */}
            <div className="col-span-12 bento-card p-4 sm:p-6">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700">Recent Intelligence Analytics</h3>
                  <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase">Computed {new Date().toLocaleTimeString()}</div>
               </div>
               <div className="space-y-3">
                  {(stats as any).allReports?.map((report: any, idx: number) => (
                    <div key={`${report.id || Math.random()}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs",
                          report.__type === 'AUDIT' ? 'bg-amber-500' :
                          report.__type === 'BUNDLE' ? 'bg-indigo-500' :
                          report.__type === 'HAI' ? 'bg-rose-500' :
                          report.__type === 'AMS' ? 'bg-teal-500' :
                          report.__type === 'NSI' ? 'bg-orange-500' : 'bg-slate-500'
                        )}>
                          {report.__type?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{report.__type} REPORT • {report.unit || report.incident?.unit || 'GEN'}</p>
                          <p className="text-[10px] font-medium text-slate-500 italic">By {report.auditorName || report.staffName || report.prescriberName || report.reporterName || report.reportedBy || report.reporterEmail || 'Staff Member'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(report.__date)}</p>
                        <div className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1",
                          (report.isValidated || report.status === 'VALIDATED' || !!report.validation?.decision) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {(report.isValidated || report.status === 'VALIDATED' || !!report.validation?.decision) ? 'SECURED' : 'PENDING'}
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

                      </div>
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
    </div>
  );
}

function BundleSummaryCard({ label, today, mtd, icon: Icon, color, bgColor }: any) {
  return (
    <div className={`p-4 rounded-xl ${bgColor} flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-bold text-slate-700">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-black text-slate-900">{Math.round(today)}%</span>
        <span className="text-xs text-slate-500 mb-1">Today</span>
      </div>
      <div className="text-xs font-medium text-slate-500">
        MTD: <span className="font-bold text-slate-700">{Math.round(mtd)}%</span>
      </div>
    </div>
  );
}

function ComplianceCell({ value }: { value: number }) {
  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <div className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
        value >= 90 ? 'bg-emerald-100 text-emerald-700' :
        value >= 75 ? 'bg-amber-100 text-amber-700' :
        'bg-rose-100 text-rose-700'
      }`}>
        {Math.round(value)}%
      </div>
    </td>
  );
}
