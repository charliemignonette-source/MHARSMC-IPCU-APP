import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { 
  TrendingUp, Activity, ClipboardCheck, AlertTriangle, 
  Users, Calendar, ArrowUpRight, ArrowDownRight, Download
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, BOCLog } from '../types';
import { cn, getComplianceColor } from '../lib/utils';
import { ShieldCheck, Crosshair, Thermometer, Droplets, Wind, Scissors } from 'lucide-react';

const complianceData = [
  { month: 'JAN', hh: 82, ppe: 78, env: 85, ams: 70 },
  { month: 'FEB', hh: 84, ppe: 79, env: 86, ams: 72 },
  { month: 'MAR', hh: 87, ppe: 81, env: 88, ams: 75 },
  { month: 'APR', hh: 91.2, ppe: 88.5, env: 89, ams: 78 },
];

const amsTrends = [
  { name: 'Day 1', requests: 4 },
  { name: 'Day 2', requests: 3 },
  { name: 'Day 3', requests: 7 },
  { name: 'Day 4', requests: 5 },
  { name: 'Day 5', requests: 4 },
  { name: 'Day 6', requests: 11 },
  { name: 'Day 7', requests: 3 },
];

export default function Dashboard({ user }: { user: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'OVERALL' | 'CLABSI' | 'CAUTI' | 'VAP' | 'SSI' | 'IPCU' | 'AUDITS' | 'AMS_SAFETY'>('OVERALL');
  const [rawLogs, setRawLogs] = useState<{
    boc: BOCLog[];
    ams: any[];
    nsi: any[];
    audits: any[];
  }>({ boc: [], ams: [], nsi: [], audits: [] });
  const [stats, setStats] = useState({
    hhCompliance: 91.2,
    ppeCompliance: 88.5,
    envCompliance: 89.0,
    activeAMS: 0,
    recentHAIs: 0,
    nsiToday: 0,
    validatedCount: 0,
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
        const audits = await getDocs(collection(db, 'audits'));
        const hais = await getDocs(collection(db, 'hai_cases'));
        const boc = await getDocs(collection(db, 'boc_logs'));
        const ams = await getDocs(collection(db, 'ams_requests'));
        const nsi = await getDocs(collection(db, 'nsi_reports'));

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const bocData = boc.docs.map(d => ({ id: d.id, ...d.data() } as BOCLog));
        const amsData = ams.docs.map(d => d.data());
        const nsiData = nsi.docs.map(d => d.data());
        const auditData = audits.docs.map(d => d.data());
        
        setRawLogs({ boc: bocData, ams: amsData, nsi: nsiData, audits: auditData });

        // Process Domain Metrics
        const activeAMS = amsData.filter(d => d.status === 'PENDING').length;
        const nsiMTD = nsiData.filter(d => {
          const date = d.createdAt?.toDate?.() || new Date(d.createdAt);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }).length;

        const hhAudits = auditData.filter(a => a.type === 'HAND_HYGIENE');
        const ppeAudits = auditData.filter(a => a.type === 'PPE_ADHERENCE');
        const calcAvg = (list: any[]) => list.length > 0 ? list.reduce((acc, a) => acc + (a.complianceRate || 0), 0) / list.length : 0;
        
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
                  Object.entries(bundle.elements).forEach(([el, val]) => {
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

        // Unit Compliance
        const unitStats: Record<string, any> = {};
        bocData.filter(l => l.date === todayStr).forEach(log => {
          if (!unitStats[log.unit]) unitStats[log.unit] = { unit: log.unit, logs: [] };
          unitStats[log.unit].logs.push(log);
        });
        const unitList = Object.values(unitStats).map(u => ({
          name: u.unit,
          ...calculateCompliance(u.logs)
        }));

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

        const allDocs = [
          ...auditData,
          ...hais.docs.map(d => d.data()),
          ...bocData,
          ...amsData,
          ...nsiData
        ];

        const total = allDocs.length;
        const validated = allDocs.filter((d: any) => d.isValidated || d.status === 'VALIDATED').length;

        setStats(prev => ({
          ...prev,
          validatedCount: validated,
          totalCount: total,
          activeAMS: activeAMS,
          recentHAIs: hais.docs.length,
          auditsCount: auditData.length,
          amsCount: amsData.length,
          hhCompliance: calcAvg(hhAudits),
          ppeCompliance: calcAvg(ppeAudits),
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
        console.error('Stats error:', error);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">IPC COMMAND</h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">Period: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="flex items-center overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0 no-scrollbar">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
            {[
              { id: 'OVERALL', label: 'Summary' },
              { id: 'IPCU', label: 'Verif' },
              { id: 'CLABSI', label: 'CLABSI' },
              { id: 'CAUTI', label: 'CAUTI' },
              { id: 'VAP', label: 'VAP' },
              { id: 'SSI', label: 'SSI' },
              { id: 'AUDITS', label: 'HH' },
              { id: 'AMS_SAFETY', label: 'Safety' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
                  activeTab === tab.id ? "bg-white text-brand-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>


      {activeTab === 'OVERALL' ? (
        <div className="space-y-6">
          {/* High-Level Highlight Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bento-card p-4 sm:p-6 bg-brand-primary text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-100 mb-4 sm:mb-6">Device Bundle Adherence</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{Math.round(stats.bundles.today.overall)}%</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-teal-200">MTD AVG</span>
                  <span>{Math.round(stats.bundles.mtd.overall)}%</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-emerald-600 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-4 sm:mb-6">Hand Hygiene Compliance</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{Math.round(stats.hhCompliance)}%</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-emerald-200">AUDITS MTD</span>
                  <span>{stats.auditsCount}</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-amber-500 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-100 mb-4 sm:mb-6">AMS Stewardship</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{stats.activeAMS}</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-amber-200">PENDING ACTIONS</span>
                  <span>{stats.amsCount} TOTAL</span>
               </div>
            </div>

            <div className="bento-card p-4 sm:p-6 bg-rose-600 text-white">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-100 mb-4 sm:mb-6">Workplace Safety (NSI)</h4>
               <div className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 sm:mb-4">{stats.safety.nsiMTD}</div>
               <div className="flex items-center justify-between pt-4 border-t border-white/10 text-[10px] font-bold">
                  <span className="text-rose-200">INJURIES MTD</span>
                  <span>{stats.safety.exposedStaff} HIGH RISK</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <BundleSummaryCard 
              label="CLABSI Protocol" 
              today={stats.bundles.today.CLABSI} 
              mtd={stats.bundles.mtd.CLABSI} 
              icon={<Droplets className="w-5 h-5" />}
              color="text-emerald-500"
              bgColor="bg-emerald-50"
            />
            <BundleSummaryCard 
              label="CAUTI Protocol" 
              today={stats.bundles.today.CAUTI} 
              mtd={stats.bundles.mtd.CAUTI} 
              icon={<Thermometer className="w-5 h-5" />}
              color="text-amber-500"
              bgColor="bg-amber-50"
            />
            <BundleSummaryCard 
              label="VAP/VAE Respiratory" 
              today={stats.bundles.today.VENTILATOR} 
              mtd={stats.bundles.mtd.VENTILATOR} 
              icon={<Wind className="w-5 h-5" />}
              color="text-sky-500"
              bgColor="bg-sky-50"
            />
            <BundleSummaryCard 
              label="SSI Surgical Site" 
              today={stats.bundles.today.SURGICAL_SITE} 
              mtd={stats.bundles.mtd.SURGICAL_SITE} 
              icon={<Scissors className="w-5 h-5" />}
              color="text-rose-500"
              bgColor="bg-rose-50"
            />
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Daily Trend Chart */}
            <div className="col-span-12 lg:col-span-8 bento-card p-4 sm:p-6">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700">Daily Bundle Compliance Trend (30D)</h3>
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-[8px] font-black uppercase tracking-tight text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> CLABSI</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-500 rounded-full" /> CAUTI</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-sky-500 rounded-full" /> VAP</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-500 rounded-full" /> SSI</span>
                  </div>
               </div>
               <div className="h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.bundles.trends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                      />
                      <Line type="monotone" dataKey="CLABSI" stroke="#10b981" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="CAUTI" stroke="#f59e0b" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="VENTILATOR" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="SURGICAL_SITE" stroke="#f43f5e" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Non-Compliance Flags */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
               <div className="bento-card p-4 sm:p-6 bg-slate-900 text-white">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary mb-6">Non-Compliance Flags</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                     <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-500 rounded-full" />
                           <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">RED FLAGS</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black">{stats.bundles.flags.red}</div>
                     </div>
                     <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full" />
                           <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">YELLOW</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black">{stats.bundles.flags.yellow}</div>
                     </div>
                     <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-sky-500 rounded-full" />
                           <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">BLUE</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black">{stats.bundles.flags.blue}</div>
                     </div>
                     <div className="bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-slate-500 rounded-full" />
                           <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">BLACK</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black">{stats.bundles.flags.black}</div>
                     </div>
                  </div>
               </div>

               <div className="bento-card p-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Device Usage Today</h3>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Central Lines</span>
                        <span className="text-xs font-black text-slate-900">{stats.bundles.today.counts?.CLABSI || 0}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Foley Catheters</span>
                        <span className="text-xs font-black text-slate-900">{stats.bundles.today.counts?.CAUTI || 0}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Ventilators</span>
                        <span className="text-xs font-black text-slate-900">{stats.bundles.today.counts?.VENTILATOR || 0}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">Surgical Sites</span>
                        <span className="text-xs font-black text-slate-900">{stats.bundles.today.counts?.SURGICAL_SITE || 0}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Unit Level Compliance Map */}
            <div className="col-span-12 bento-card p-4 sm:p-6">
               <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 mb-6 sm:mb-8">Unit-Level Compliance Matrix</h3>
               <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[600px] px-4 sm:px-0">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Name</th>
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">CLABSI %</th>
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">CAUTI %</th>
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">VAP %</th>
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">SSI %</th>
                          <th className="pb-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">OVERALL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {stats.bundles.units.map(unit => (
                          <tr key={unit.name} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 text-[11px] sm:text-xs font-bold text-slate-900">{unit.name}</td>
                            <ComplianceCell value={unit.CLABSI} />
                            <ComplianceCell value={unit.CAUTI} />
                            <ComplianceCell value={unit.VENTILATOR} />
                            <ComplianceCell value={unit.SURGICAL_SITE} />
                            <td className="py-4 text-center">
                              <span className={cn(
                                "px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-black",
                                unit.overall >= 95 ? "bg-emerald-500 text-white" : unit.overall >= 80 ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                              )}>
                                {Math.round(unit.overall)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>

            {/* Monthly Summary Section */}
            <div className="col-span-12 space-y-6 pt-12">
               <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-none">Auto-Generated Monthly HAI Report Summary</h3>
                  <div className="h-px flex-1 bg-slate-200" />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bento-card p-6 border-brand-primary/20 bg-brand-primary/[0.02]">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-6">Top Performing Units</h4>
                     <div className="space-y-4">
                        {stats.bundles.units.sort((a, b) => b.overall - a.overall).slice(0, 3).map((u, i) => (
                          <div key={i} className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-800">{u.name}</span>
                             <span className="text-xs font-black text-emerald-500">{Math.round(u.overall)}%</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="bento-card p-6 border-rose-100 bg-rose-50/10">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-6">Units Needing Improvement</h4>
                     <div className="space-y-4">
                        {stats.bundles.units.sort((a, b) => a.overall - b.overall).slice(0, 3).map((u, i) => (
                          <div key={i} className="flex justify-between items-center">
                             <span className="text-xs font-bold text-slate-800">{u.name}</span>
                             <span className="text-xs font-black text-rose-500">{Math.round(u.overall)}%</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="bento-card p-6">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">MTD compliance Overview</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                           <span className="text-slate-600 font-bold">Overall MTD</span>
                           <span className="text-slate-900 font-black">{Math.round(stats.bundles.mtd.overall)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                           <div className="bg-brand-primary h-full" style={{ width: `${stats.bundles.mtd.overall}%` }} />
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'IPCU' ? (
        <VerificationDashboard stats={stats} />
      ) : activeTab === 'AUDITS' ? (
        <AuditsDashboard stats={stats} />
      ) : activeTab === 'AMS_SAFETY' ? (
        <AmsSafetyDashboard stats={stats} />
      ) : (
        <DeviceSpecificDashboard type={activeTab} stats={stats} />
      )}
    </div>
  );
}

function AuditsDashboard({ stats }: any) {
  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bento-card p-6 bg-emerald-600 text-white">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-6">HH Compliance Distribution (MTD)</h4>
             <div className="flex items-baseline gap-4 mb-8">
                <span className="text-5xl font-black">{Math.round(stats.hhCompliance)}%</span>
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Aggregate Score</span>
             </div>
             <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceData}>
                    <Bar dataKey="hh" fill="#fff" radius={[4, 4, 0, 0]} fillOpacity={0.2} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bento-card p-6">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">PPE Adherence Trends</h4>
             <div className="flex items-baseline gap-4 mb-8">
                <span className="text-4xl font-black text-slate-900">{Math.round(stats.ppeCompliance)}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MTD Average</span>
             </div>
             <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complianceData}>
                    <Area type="monotone" dataKey="ppe" stroke="#10b981" fill="#10b981" fillOpacity={0.05} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
       </div>
    </div>
  );
}

function AmsSafetyDashboard({ stats }: any) {
  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bento-card p-6 bg-amber-500 text-white">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-100 mb-6">AMS Request Velocity</h4>
             <div className="flex items-baseline gap-4 mb-8">
                <span className="text-5xl font-black">{stats.activeAMS}</span>
                <span className="text-[10px] font-bold text-amber-100 uppercase tracking-widest">Pending Review</span>
             </div>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={amsTrends}>
                    <Bar dataKey="requests" fill="#fff" radius={[4, 4, 0, 0]} fillOpacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="bento-card p-6 bg-rose-600 text-white">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-100 mb-6">Workplace Safety Incidents</h4>
             <div className="flex items-baseline gap-4 mb-8">
                <span className="text-5xl font-black">{stats.safety.nsiMTD}</span>
                <span className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Total NSI MTD</span>
             </div>
             <div className="space-y-4">
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                   <div className="text-[9px] font-bold text-rose-200 uppercase mb-1">High Risk Exposures</div>
                   <div className="text-2xl font-black">{stats.safety.exposedStaff}</div>
                </div>
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                   <div className="text-[9px] font-bold text-rose-200 uppercase mb-1">Incidents Today</div>
                   <div className="text-2xl font-black">{stats.nsiToday}</div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

function BundleSummaryCard({ label, today, mtd, icon, color, bgColor }: any) {
  return (
    <div className="bento-card p-4 sm:p-6 hover:shadow-xl transition-all">
       <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div className={cn("p-2 sm:p-2.5 rounded-xl sm:rounded-2xl", bgColor, color)}>
             {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 sm:w-5 sm:h-5" })}
          </div>
          <div className="text-right">
             <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">Today</div>
             <div className={cn("text-xl sm:text-2xl font-black tracking-tighter", color)}>{Math.round(today)}%</div>
          </div>
       </div>
       <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 sm:mb-4">{label}</h4>
       <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-slate-50">
          <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">MTD Compliance</span>
          <span className="text-[10px] sm:text-xs font-black text-slate-900">{Math.round(mtd)}%</span>
       </div>
    </div>
  );
}

function ComplianceCell({ value }: { value: number }) {
  return (
    <td className="py-4 text-center">
      <span className={cn(
        "text-xs font-bold font-mono",
        value >= 95 ? "text-emerald-500" : value >= 80 ? "text-amber-500" : "text-rose-500"
      )}>
        {Math.round(value)}%
      </span>
    </td>
  );
}

function DeviceSpecificDashboard({ type, stats }: any) {
  const deviceKey = type === 'VAP' ? 'VENTILATOR' : type === 'SSI' ? 'SURGICAL_SITE' : type;
  const variances = stats.bundles.mtd?.topVariances?.[deviceKey] || [];
  const count = stats.bundles.today?.counts?.[deviceKey] || 0;

   return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bento-card p-4 sm:p-6 bg-slate-900 text-white">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-6">Device Usage & Compliance</h4>
             <div className="space-y-6">
                <div>
                   <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">In Use Today</div>
                   <div className="text-2xl sm:text-3xl font-black">{count}</div>
                </div>
                <div>
                   <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">MTD Compliance</div>
                   <div className="text-2xl sm:text-3xl font-black text-brand-primary">{Math.round(stats.bundles.mtd?.[deviceKey] || 0)}%</div>
                </div>
             </div>
          </div>
          <div className="bento-card p-4 sm:p-6">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Top 3 Recurring Variance Items</h4>
             <div className="space-y-4">
                {variances.length > 0 ? variances.map((v: string) => (
                  <div key={v} className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase gap-2">
                      <span className="text-slate-600 line-clamp-1">{v}</span>
                      <span className="text-rose-500 shrink-0">Variance</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                       <div className="bg-rose-500 h-full w-[65%]" />
                    </div>
                  </div>
                )) : <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">No variances logged</div>}
             </div>
          </div>
          <div className="bento-card p-4 sm:p-6">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8">{type} Non-Compliance Distribution</h4>
             <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={variances.map((v: string) => ({ name: v, value: 5 + Math.random() * 10 }))}>
                      <XAxis dataKey="name" hide />
                      <Bar dataKey="value" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 bento-card p-4 sm:p-6">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8">{type} Daily Trend (30D)</h4>
             <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.bundles.trends}>
                    <Area type="monotone" dataKey={deviceKey} stroke="#0d9488" fill="#0d9488" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
       </div>
    </div>
  );
}

function VerificationDashboard({ stats }: any) {
  const v = stats.bundles.verification;
  if (!v) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
       <div className="bento-card p-4 sm:p-6 bg-slate-900 text-white">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-6">IPCU Verification Accuracy</h4>
          <div className="flex items-end gap-3 sm:gap-4 mb-8">
             <span className="text-4xl sm:text-5xl font-black tracking-tighter text-white">{Math.round(v.accuracy)}%</span>
             <span className="text-emerald-400 text-xs font-bold mb-2 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Baseline
             </span>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Total Validations</span>
                <span className="text-xs font-bold">{v.total}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Total Discrepancies</span>
                <span className="text-xs font-bold text-rose-400">{v.discrepancies}</span>
             </div>
          </div>
       </div>
       <div className="bento-card p-4 sm:p-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Most Common IPCU Errors Found</h4>
          <div className="space-y-4">
             {v.errors.length > 0 ? v.errors.map((err: any) => (
               <div key={err.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase gap-2">
                    <span className="text-slate-600 truncate">{err.label}</span>
                    <span className="text-slate-900 shrink-0">{err.count} cases</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                    <div className="bg-brand-primary h-1 rounded-full" style={{ width: `${(err.count / Math.max(v.discrepancies, 1)) * 100}%` }} />
                  </div>
               </div>
             )) : <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">No discrepancies logged</div>}
          </div>
       </div>

       <div className="col-span-1 sm:col-span-2 bento-card p-4 sm:p-6">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-8">Verification Accuracy Trend (30D)</h4>
          <div className="h-[200px]">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={v.accuracyTrends}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="date" hide />
                   <YAxis hide domain={[0, 100]} />
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                   />
                   <Area type="monotone" dataKey="accuracy" stroke="#0d9488" fill="#0d9488" fillOpacity={0.1} strokeWidth={3} />
                </AreaChart>
             </ResponsiveContainer>
          </div>
       </div>
    </div>
  );
}
