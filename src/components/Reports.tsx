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

type ReportType = 'COMPLIANCE' | 'AUDITS' | 'AMS' | 'HAI' | 'NSI' | 'OUTBREAK' | 'CLINICAL_SYSTEMS';
type TimeFrame = 'DAILY' | 'MONTHLY' | 'ALL_TIME';

export default function Reports({ user }: { user: UserProfile | null }) {
  const [reportType, setReportType] = useState<ReportType>('CLINICAL_SYSTEMS');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('MONTHLY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const reportOptions = [
    { id: 'CLINICAL_SYSTEMS', label: 'Systems Integrity Report', icon: FileSpreadsheet, description: 'Consolidated Audits, Bundles, & HAI Cases for holistic oversight' },
    { id: 'COMPLIANCE', label: 'Bundle Compliance', icon: Activity, description: 'CLABSI, CAUTI, VAP, SSI bundles' },
    { id: 'AUDITS', label: 'IPC Audits', icon: ClipboardCheck, description: 'Hand HH, PPE, and Environmental adherence logs' },
    { id: 'AMS', label: 'Antimicrobial Stewardship', icon: Stethoscope, description: 'Antibiotic requests & approvals' },
    { id: 'HAI', label: 'HAI Surveillance', icon: Activity, description: 'Detected cases & validation status' },
    { id: 'NSI', label: 'Safety (NSI)', icon: AlertTriangle, description: 'Needle stick injuries & exposure' },
    { id: 'OUTBREAK', label: 'Outbreak Status', icon: ShieldAlert, description: 'Active & closed outbreak events' },
  ];

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      setMessage({ type: 'error', text: 'No data found for the selected criteria.' });
      return;
    }

    const headers = Object.keys(data[0]);

    const csvContent = [
      headers.join(','),
      ...data.map(obj => 
        headers.map(header => {
          const v = obj[header];
          const str = (v === null || v === undefined) ? '' : String(v).replace(/"/g, '""').replace(/\n/g, ' ');
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

  const mapDataRecord = (d: any, type: string) => {
    const common = {
      'System ID': d.id,
      'Source Collection': d.__source || type
    };

    switch (type) {
      case 'AUDITS':
        const auditDetails = d.details || {};
        let findings = '';
        
        if (d.type === 'HH_COMPLIANCE' && auditDetails.hhObs) {
          const obs = auditDetails.hhObs;
          findings = Object.entries(obs.indications || {})
            .filter(([_, active]) => active)
            .map(([moment, _]) => `${moment}: ${obs.actions?.[moment] || 'missed'}`)
            .join('; ');
        } else if (d.type === 'HH_AVAILABILITY') {
          const missings = [];
          if (!auditDetails.abhr?.poc) missings.push('No ABHR at POC');
          if (!auditDetails.sink?.sink) missings.push('No Sink');
          if (!auditDetails.sink?.soap) missings.push('No Soap');
          findings = missings.length > 0 ? `Missing: ${missings.join(', ')}` : 'Full Availability';
        } else if (d.type === 'ENV_CLEANING' && auditDetails.envCleaning?.surfaces) {
          const missed = Object.entries(auditDetails.envCleaning.surfaces)
            .filter(([_, status]) => status === 'notCleaned')
            .map(([surface, _]) => surface)
            .join(', ');
          findings = missed ? `Dirty Surfaces: ${missed}` : 'All Cleaned';
        } else if (d.type === 'PPE_COMPLIANCE' && auditDetails.ppeCompliance) {
          const ppe = auditDetails.ppeCompliance;
          findings = `Staff: ${ppe.staffType}${ppe.staffIdentifier ? ' (' + ppe.staffIdentifier + ')' : ''} | Correct PPE: ${ppe.correctPPE ? 'YES' : 'NO'}${ppe.missingItems ? ' (Missing: ' + ppe.missingItems + ')' : ''}`;
        } else if (d.type === 'SAFE_INJECTION' && auditDetails.safeInjection) {
          const si = auditDetails.safeInjection;
          const issues = [];
          if (!si.hhBefore) issues.push('No HH Before');
          if (!si.sterileNeedle) issues.push('Needle Reused');
          if (si.noRecapping === false) issues.push('Recapping Observed');
          findings = issues.length > 0 ? `Issues: ${issues.join(', ')}` : 'Perfect Technique';
        }

        return {
          ...common,
          'Date': d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : (d.timestamp ? new Date(d.timestamp).toLocaleString() : ''),
          'Auditor': d.auditorName || d.auditorEmail || d.auditorId,
          'Unit': d.unit,
          'Audit Type': (d.type || '').replace(/_/g, ' '),
          'Staff Observed': d.staffIdentifier || 'N/A',
          'Score': `${d.score}/${d.total}`,
          'Compliance %': (d.total > 0 ? (d.score / d.total) * 100 : 0).toFixed(1) + '%',
          'Findings/Details': findings || d.remarks || 'N/A',
          'Profession': d.profession || 'N/A',
          'Is Validated': d.isValidated ? 'YES' : 'NO',
          'Monitoring Method': d.monitoringMethod || 'N/A',
          'Monitoring Status': d.monitoringStatus || 'Passed/Failed',
          'Validator': d.validatorName || d.validatedBy || 'Pending',
          'Validated At': d.validatedAt?.toDate ? d.validatedAt.toDate().toLocaleString() : (d.validatedAt || 'Pending'),
          'Correction': d.correctiveActions?.join('; ') || '',
          'Rationale': d.reason || ''
        };

      case 'COMPLIANCE':
      case 'boc_logs':
        return {
          ...common,
          'Date': d.date,
          'Time': d.time,
          'Unit': d.unit,
          'Patient Name': d.patientName,
          'Hosp Number': d.hospNo,
          'Age/Sex': `${d.age} / ${d.sex}`,
          'Devices': (d.devicesPresent || []).join(', '),
          'Compliance %': d.compliancePercentage + '%',
          'Staff Reporter': d.staffName,
          'Designation': d.staffDesignation,
          'Verification Status': d.isValidated ? 'Validated' : 'Pending',
          'Final Decision': d.verification?.finalDecision || 'N/A',
          'Reasoning': d.verification?.reason || '',
          'Corrective Actions': (d.verification?.correctiveAction || []).join('; '),
          'Validator Name': d.verification?.validatorName || '',
          'Validated At': d.verification?.date || ''
        };

      case 'AMS':
      case 'ams_requests':
        return {
          ...common,
          'Request Type': d.type,
          'Date Requested': d.date,
          'Patient Name': d.patientName,
          'Hosp Number': d.hospNo,
          'Unit': d.unit,
          'Drug Requested': d.antibiotic || d.antimicrobialsRequested?.join(', '),
          'Indication': d.indication || d.indicationForUse,
          'Diagnosis': d.diagnosis || d.infectiousDiagnosis,
          'Status': d.status,
          'Prescriber': d.prescriberName || d.prescriberEmail || d.prescriberId,
          'Decision Basis': d.overrideReason || d.remarks || '',
          'Reviewer': d.reviewerName || d.reviewerEmail || d.reviewerId || 'Pending',
          'Reviewed At': d.reviewedAt || 'Pending'
        };

      case 'HAI':
      case 'hai_cases':
        return {
          ...common,
          'Case Type': d.type,
          'Patient Name': d.patientName,
          'Hosp Number': d.hospNo,
          'Unit': d.unit,
          'Trigger Date': d.triggerDate,
          'Risk Level': d.riskLevel,
          'Status': d.status,
          'Validator': d.validatorName || 'Pending',
          'Decision Note': d.decisionNote || '',
          'Validated At': d.validatedAt || 'Pending',
          'Invariants Found': [d.bundleIssues, d.clinicalIssues, d.labIssues].filter(Boolean).join('; ')
        };

      case 'NSI':
      case 'nsi_reports':
        return {
          ...common,
          'Incident Date': d.incident?.date,
          'Exposure Type': d.incident?.exposureType,
          'Device': d.incident?.deviceInvolved,
          'Activity': d.incident?.activity,
          'Staff Name': d.staff?.name || d.reporterName || d.reporterEmail,
          'Unit': d.incident?.unit,
          'Status': d.status,
          'IPCU Decision': d.validation?.decision || 'Pending',
          'Classification': d.validation?.classification || '',
          'Root Causes': (d.validation?.rootCauses || []).join('; '),
          'Validator': d.validation?.validatorName || d.validation?.validatorId || 'Pending',
          'Validated At': d.validation?.validatedAt?.toDate ? d.validation.validatedAt.toDate().toLocaleString() : 'Pending'
        };

      case 'OUTBREAK':
      case 'outbreaks':
        return {
          ...common,
          'Detected At': d.detectedAt,
          'Status': d.status,
          'Affected Units': d.epidemiology?.unitsAffected,
          'Total Cases': d.epidemiology?.totalCases,
          'Reporter': d.reportedBy || d.reporterEmail || 'System',
          'Confirmed By': d.validation?.validatorName || 'Pending',
          'Validation Decision': d.validation?.decision || ''
        };

      default:
        return { ...common, ...d };
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      let rawData: any[] = [];
      
      const fetchCollectionData = async (collName: string, dateFld: string) => {
        const collRef = collection(db, collName);
        let q;

        const start = timeFrame === 'DAILY' ? new Date(selectedDate) : (timeFrame === 'MONTHLY' ? new Date(selectedMonth.split('-')[0], parseInt(selectedMonth.split('-')[1]) - 1, 1) : null);
        const end = timeFrame === 'DAILY' ? new Date(selectedDate) : (timeFrame === 'MONTHLY' ? new Date(selectedMonth.split('-')[0], parseInt(selectedMonth.split('-')[1]), 0) : null);
        
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (timeFrame === 'DAILY') {
          if (dateFld === 'date') {
            q = query(collRef, where(dateFld, '==', selectedDate));
          } else if (dateFld === 'timestamp' || dateFld === 'dateTimeRequested' || dateFld === 'reportedAt') {
            const startStr = start?.toISOString() || '';
            const endStr = end?.toISOString() || '';
            q = query(collRef, where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
          } else {
            q = query(collRef, where(dateFld, '>=', start), where(dateFld, '<=', end));
          }
        } else if (timeFrame === 'MONTHLY') {
          if (dateFld === 'date') {
            const startStr = start?.toISOString().split('T')[0] || '';
            const endStr = end?.toISOString().split('T')[0] || '';
            q = query(collRef, where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
          } else if (dateFld === 'timestamp' || dateFld === 'dateTimeRequested' || dateFld === 'reportedAt') {
            const startStr = start?.toISOString() || '';
            const endStr = end?.toISOString() || '';
            q = query(collRef, where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
          } else {
            q = query(collRef, where(dateFld, '>=', start), where(dateFld, '<=', end));
          }
        } else {
          q = query(collRef, orderBy(dateFld, 'desc'));
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, __source: collName, ...doc.data() }));
      };

      if (reportType === 'CLINICAL_SYSTEMS') {
        const p1 = fetchCollectionData('audits', 'createdAt');
        const p2 = fetchCollectionData('boc_logs', 'date');
        const p3 = fetchCollectionData('hai_cases', 'createdAt');
        const results = await Promise.all([p1, p2, p3]);
        
        // Unified Schema for Consolidated Intelligence Report
        const unifiedMapper = (d: any, domain: string) => {
          const base = {
            'Date': '',
            'Unit': d.unit || 'N/A',
            'Patient/Subject': 'Institutional',
            'Domain': domain,
            'Staff/Reporter': 'N/A',
            'Assessment Type': '',
            'Performance Result': '',
            'Compliance %': 'N/A',
            'Validation Status': d.isValidated ? 'Validated' : 'Pending',
            'IPCU Decision': 'N/A',
            'Validator/Reviewer': 'N/A',
            'Clinical Rationale/Action': ''
          };

          if (domain === 'AUDIT') {
            base.Date = d.createdAt instanceof Timestamp ? d.createdAt.toDate().toLocaleString() : (d.timestamp ? new Date(d.timestamp).toLocaleString() : '');
            base['Staff/Reporter'] = d.auditorName || d.auditorEmail || d.auditorId || 'N/A';
            base['Assessment Type'] = (d.type || '').replace(/_/g, ' ');
            base['Performance Result'] = `${d.score}/${d.total}`;
            base['Compliance %'] = (d.total > 0 ? (d.score / d.total) * 100 : 0).toFixed(1) + '%';
            base['IPCU Decision'] = d.monitoringStatus || 'N/A';
            base['Validator/Reviewer'] = d.validatorName || d.validatedBy || 'N/A';
            base['Clinical Rationale/Action'] = [d.remarks, d.reason, d.correctiveActions?.join('; ')].filter(Boolean).join(' | ');
          } else if (domain === 'BUNDLE') {
            base.Date = d.date;
            base['Patient/Subject'] = d.patientName || d.hospNo || 'N/A';
            base['Staff/Reporter'] = d.staffName || 'N/A';
            base['Assessment Type'] = (d.devicesPresent || []).join(', ') || 'Bundle Assessment';
            base['Performance Result'] = d.compliancePercentage + '%';
            base['Compliance %'] = d.compliancePercentage + '%';
            base['IPCU Decision'] = d.verification?.finalDecision || 'N/A';
            base['Validator/Reviewer'] = d.verification?.validatorName || 'N/A';
            base['Clinical Rationale/Action'] = [d.verification?.reason, d.verification?.correctiveAction?.join('; ')].filter(Boolean).join(' | ');
          } else if (domain === 'HAI') {
            base.Date = d.triggerDate || (d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : d.createdAt);
            base['Patient/Subject'] = d.patientName || d.hospNo || 'N/A';
            base['Staff/Reporter'] = d.auditorName || d.reportedBy || 'N/A';
            base['Assessment Type'] = d.type || 'HAI Surveillance';
            base['Performance Result'] = d.status;
            base['IPCU Decision'] = d.status;
            base['Validator/Reviewer'] = d.validatorName || 'N/A';
            base['Clinical Rationale/Action'] = [d.decisionNote, d.bundleIssues, d.clinicalIssues, d.labIssues].filter(Boolean).join(' | ');
          }

          return base;
        };

        const formattedData = results[0].map(d => unifiedMapper(d, 'AUDIT'))
          .concat(results[1].map(d => unifiedMapper(d, 'BUNDLE')))
          .concat(results[2].map(d => unifiedMapper(d, 'HAI')));
          
        downloadCSV(formattedData, `Systems_Integrity_Consolidated_Report`);
      } else {
        let collectionName = '';
        let dateField = 'createdAt';
        
        switch (reportType) {
          case 'COMPLIANCE': collectionName = 'boc_logs'; dateField = 'date'; break;
          case 'AUDITS': collectionName = 'audits'; dateField = 'timestamp'; break;
          case 'AMS': collectionName = 'ams_requests'; dateField = 'dateTimeRequested'; break;
          case 'HAI': collectionName = 'hai_cases'; dateField = 'triggerDate'; break;
          case 'NSI': collectionName = 'nsi_reports'; dateField = 'reportedAt'; break;
          case 'OUTBREAK': collectionName = 'outbreaks'; dateField = 'detectedAt'; break;
        }
        const data = await fetchCollectionData(collectionName, dateField);
        const formattedData = data.map(d => mapDataRecord(d, reportType));
        downloadCSV(formattedData, `${reportType}_Report`);
      }
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
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">System Intelligence Reports</h2>
        <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Export Daily and Monthly Institutional Data</p>
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
                     "flex items-start gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all text-left",
                     reportType === opt.id 
                       ? "border-brand-primary bg-teal-50/30" 
                       : "border-slate-100 hover:border-slate-200"
                   )}
                 >
                   <div className={cn(
                     "p-1.5 sm:p-2 rounded-lg sm:rounded-xl h-fit",
                     reportType === opt.id ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"
                   )}>
                     <opt.icon className="w-3.5 h-3.5" />
                   </div>
                   <div>
                     <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-slate-900">{opt.label}</div>
                     <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 leading-tight line-clamp-1">{opt.description}</div>
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
             
             <div className="flex flex-wrap gap-2 p-1 bg-slate-100 rounded-xl sm:rounded-2xl w-full sm:w-fit">
               {(['DAILY', 'MONTHLY', 'ALL_TIME'] as const).map(tf => (
                 <button
                   key={tf}
                   onClick={() => setTimeFrame(tf)}
                   className={cn(
                     "flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                     timeFrame === tf ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                   )}
                 >
                   {tf.replace('_', ' ')}
                 </button>
               ))}
             </div>

             <div className="pt-4">
               {timeFrame === 'DAILY' && (
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
               )}
               {timeFrame === 'MONTHLY' && (
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
               {timeFrame === 'ALL_TIME' && (
                 <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                   <ShieldAlert className="w-5 h-5 text-amber-500" />
                   <p className="text-[10px] font-bold text-amber-800 uppercase leading-relaxed">
                     Extracting all-time cumulative entries. This may result in a large file containing the full institutional history.
                   </p>
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
              <ul className="space-y-2 text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                 <li className="list-disc ml-3">CSV format compatible with Excel</li>
                 <li className="list-disc ml-3">Automated timestamp flattening</li>
                 <li className="list-disc ml-3">Full institutional row extraction</li>
              </ul>
           </div>

           <button 
             onClick={async () => {
               setIsExporting(true);
               try {
                 let masterContent = `INSTITUTIONAL MASTER ARCHIVE - ${new Date().toLocaleString()}\n\n`;
                 const collectionsList = [
                   { id: 'boc_logs', label: 'Bundle Compliance (Log Bundle)' },
                   { id: 'audits', label: 'IPC Audits (Inspections)' },
                   { id: 'ams_requests', label: 'Antimicrobial Stewardship' },
                   { id: 'hai_cases', label: 'HAI Surveillance (Case Reports)' },
                   { id: 'nsi_reports', label: 'Safety NSI' },
                   { id: 'outbreaks', label: 'Outbreak Mgmt' }
                 ];

                 for (const coll of collectionsList) {
                   masterContent += `--- ${coll.label.toUpperCase()} ---\n`;
                   const snap = await getDocs(collection(db, coll.id));
                   if (snap.empty) {
                     masterContent += "No records found.\n\n";
                     continue;
                   }
                   const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                   masterContent += JSON.stringify(docs, (key, value) => 
                     value instanceof Timestamp ? value.toDate().toISOString() : value
                   , 2);
                   masterContent += "\n\n";
                 }

                 const blob = new Blob([masterContent], { type: 'text/plain' });
                 const url = URL.createObjectURL(blob);
                 const link = document.createElement('a');
                 link.href = url;
                 link.download = `Institutional_Full_System_Archive_${new Date().toISOString().split('T')[0]}.txt`;
                 link.click();
                 URL.revokeObjectURL(url);
                 setMessage({ type: 'success', text: 'Full System Archive generated successfully.' });
               } catch (e: any) {
                 setMessage({ type: 'error', text: `Archive failed: ${e.message}` });
               } finally {
                 setIsExporting(false);
               }
             }}
             className="w-full p-6 bg-slate-900 border border-slate-800 text-white rounded-3xl shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-2 group"
           >
             <div className="flex items-center gap-3">
               <FileText className="w-5 h-5 text-brand-primary group-hover:scale-110 transition-transform" />
               <span className="text-xs font-black uppercase tracking-widest">Generate Full Systems Report</span>
             </div>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Consolidated System Archive (.txt)</p>
           </button>
        </div>
      </div>
    </div>
  );
}
