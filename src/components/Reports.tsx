import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, Filter, 
  CheckCircle2, FileSpreadsheet, Loader2,
  Activity, ClipboardCheck, AlertTriangle, Stethoscope, ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

type ReportType = 'COMPLIANCE' | 'AUDITS' | 'AMS' | 'HAI' | 'NSI' | 'OUTBREAK';
type TimeFrame = 'DAILY' | 'MONTHLY' | 'CUSTOM';

export default function Reports({ user }: { user: UserProfile | null }) {
  const [reportType, setReportType] = useState<ReportType>('COMPLIANCE');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('DAILY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const reportOptions = [
    { id: 'COMPLIANCE', label: 'Bundle Compliance', icon: Activity, description: 'CLABSI, CAUTI, VAP, SSI bundles' },
    { id: 'AUDITS', label: 'IPC Audits', icon: ClipboardCheck, description: 'Hand Hygiene & PPE Adherence' },
    { id: 'AMS', label: 'AMS Stewardship', icon: Stethoscope, description: 'Antibiotic requests & approvals' },
    { id: 'HAI', label: 'HAI Surveillance', icon: Activity, description: 'Detected cases & validation status' },
    { id: 'NSI', label: 'Safety (NSI)', icon: AlertTriangle, description: 'Needle stick injuries & exposure' },
    { id: 'OUTBREAK', label: 'Outbreak Status', icon: ShieldAlert, description: 'Active & closed outbreak events' },
  ];

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      setMessage({ type: 'error', text: 'No data found for the selected criteria.' });
      return;
    }

    // Collect all unique keys from all objects to ensure comprehensive headers
    const allKeys = new Set<string>();
    data.forEach(obj => {
      Object.keys(obj).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    const csvContent = [
      headers.join(','),
      ...data.map(obj => 
        headers.map(header => {
          const v = obj[header];
          const str = (v === null || v === undefined) ? '' : String(v).replace(/"/g, '""');
          return `"${str}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setMessage({ type: 'success', text: `Successfully exported ${data.length} records.` });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      let data: any[] = [];
      let collectionName = '';
      let dateField = 'createdAt';
      
      switch (reportType) {
        case 'COMPLIANCE': collectionName = 'boc_logs'; dateField = 'date'; break;
        case 'AUDITS': collectionName = 'audits'; dateField = 'timestamp'; break;
        case 'AMS': collectionName = 'ams_requests'; dateField = 'createdAt'; break;
        case 'HAI': collectionName = 'hai_cases'; dateField = 'createdAt'; break;
        case 'NSI': collectionName = 'nsi_reports'; dateField = 'createdAt'; break;
        case 'OUTBREAK': collectionName = 'outbreaks'; dateField = 'detectedAt'; break;
      }

      const collRef = collection(db, collectionName);
      let q;

      if (timeFrame === 'DAILY') {
        if (dateField === 'date') {
          // Some collections use simple string YYYY-MM-DD
          q = query(collRef, where(dateField, '==', selectedDate));
        } else {
          // Others use Timestamp
          const start = new Date(selectedDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(selectedDate);
          end.setHours(23, 59, 59, 999);
          q = query(collRef, where(dateField, '>=', start), where(dateField, '<=', end));
        }
      } else {
        // Monthly
        const [year, month] = selectedMonth.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        
        if (dateField === 'date') {
          const startStr = start.toISOString().split('T')[0];
          const endStr = end.toISOString().split('T')[0];
          q = query(collRef, where(dateField, '>=', startStr), where(dateField, '<=', endStr));
        } else {
          q = query(collRef, where(dateField, '>=', start), where(dateField, '<=', end));
        }
      }

      const querySnapshot = await getDocs(q);
      data = querySnapshot.docs.map(doc => {
        const d = doc.data();
        // Flatten or transform for CSV
        const result: any = { id: doc.id };
        Object.entries(d).forEach(([key, val]) => {
          if (val instanceof Timestamp) {
            result[key] = val.toDate().toISOString();
          } else if (typeof val === 'object' && val !== null) {
            result[key] = JSON.stringify(val);
          } else {
            result[key] = val;
          }
        });
        return result;
      });

      downloadCSV(data, `${reportType}_Report`);
    } catch (error: any) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: `Export failed: ${error.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">System Intelligence Reports</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Export Daily and Monthly Institutional Data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Step 1: Report Type */}
          <section className="bento-card p-6 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-xs">1</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Select Report Domain</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {reportOptions.map(opt => (
                 <button
                   key={opt.id}
                   onClick={() => setReportType(opt.id as ReportType)}
                   className={cn(
                     "flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                     reportType === opt.id 
                       ? "border-brand-primary bg-teal-50/30" 
                       : "border-slate-100 hover:border-slate-200"
                   )}
                 >
                   <div className={cn(
                     "p-2 rounded-xl h-fit",
                     reportType === opt.id ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"
                   )}>
                     <opt.icon className="w-4 h-4" />
                   </div>
                   <div>
                     <div className="text-[10px] font-black uppercase tracking-tight text-slate-900">{opt.label}</div>
                     <div className="text-[9px] font-bold text-slate-400 leading-tight">{opt.description}</div>
                   </div>
                 </button>
               ))}
             </div>
          </section>

          {/* Step 2: Timeframe */}
          <section className="bento-card p-6 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-xs">2</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Select Time Interval</h3>
             </div>
             
             <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl w-fit">
               {(['DAILY', 'MONTHLY'] as const).map(tf => (
                 <button
                   key={tf}
                   onClick={() => setTimeFrame(tf)}
                   className={cn(
                     "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                     timeFrame === tf ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                   )}
                 >
                   {tf}
                 </button>
               ))}
             </div>

             <div className="pt-4">
               {timeFrame === 'DAILY' ? (
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target Date</label>
                   <div className="relative">
                     <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                       type="date"
                       value={selectedDate}
                       onChange={e => setSelectedDate(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-brand-primary/20 outline-none"
                     />
                   </div>
                 </div>
               ) : (
                 <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target Month</label>
                   <div className="relative">
                     <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                       type="month"
                       value={selectedMonth}
                       onChange={e => setSelectedMonth(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-brand-primary/20 outline-none"
                     />
                   </div>
                 </div>
               )}
             </div>
          </section>
        </div>

        <div className="space-y-6">
           {/* Finalization Card */}
           <div className="bento-card p-6 bg-slate-900 text-white flex flex-col justify-between items-center text-center">
              <div className="p-5 bg-white/10 rounded-full mb-6">
                 <FileSpreadsheet className="w-10 h-10 text-brand-primary" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2 text-white">Generate CSV</h3>
              <p className="text-[10px] text-slate-400 mb-8 font-bold uppercase tracking-widest leading-loose">
                Ready to compile {reportType.toLowerCase()} records for {timeFrame.toLowerCase()} period.
              </p>
              
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full py-5 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-teal-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? 'Processing...' : 'Download Report'}
              </button>
           </div>

           {message && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className={cn(
                 "p-6 rounded-3xl border text-center flex flex-col items-center gap-3",
                 message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
               )}
             >
               {message.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
               <div className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                 {message.text}
               </div>
             </motion.div>
           )}

           <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-800 mb-3 flex items-center gap-2">
                 <Filter className="w-3 h-3 text-brand-primary" />
                 Report Constraints
              </h4>
              <ul className="space-y-2">
                 <li className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter list-disc ml-3">CSV format compatible with Excel</li>
                 <li className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter list-disc ml-3">Automated timestamp flattening</li>
                 <li className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter list-disc ml-3">Full institutional row extraction</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}
