import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, Filter, 
  CheckCircle2, FileSpreadsheet, Loader2,
  Activity, ClipboardCheck, AlertTriangle, Stethoscope, ShieldAlert,
  Building2
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, orderBy, Timestamp, limit } from 'firebase/firestore';
import { db, safeGetDocs } from '../lib/firebase';
const getDocs = safeGetDocs;
import { UserProfile } from '../types';
import { cn } from '../lib/utils';
import { UNITS, BUNDLE_ELEMENTS } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const getBase64ImageFromUrl = (imageUrl: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
};

type ReportType = 'COMPLIANCE' | 'AUDITS' | 'AMS' | 'HAI' | 'NSI' | 'OUTBREAK' | 'CLINICAL_SYSTEMS' | 'WARD_SUMMARY';
type TimeFrame = 'DAILY' | 'MONTHLY' | 'ALL_TIME';

export default function Reports({ user }: { user: UserProfile | null }) {
  const [reportType, setReportType] = useState<ReportType>('CLINICAL_SYSTEMS');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('MONTHLY');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedWard, setSelectedWard] = useState<string>(UNITS[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [selectedAuditType, setSelectedAuditType] = useState<string>('ALL');

  const auditTypeOptions = [
    { id: 'ALL', label: 'All Audits' },
    { id: 'HH_COMPLIANCE', label: 'Hand Hygiene Compliance' },
    { id: 'HH_AVAILABILITY', label: 'Hand Hygiene Availability' },
    { id: 'PPE_COMPLIANCE', label: 'PPE Compliance' },
    { id: 'PPE_AVAILABILITY', label: 'PPE Availability' },
    { id: 'ENV_CLEANING', label: 'Environmental Cleaning' },
    { id: 'SAFE_INJECTION', label: 'Safe Injection' }
  ];

  const reportOptions = [
    { id: 'CLINICAL_SYSTEMS', label: 'Systems Integrity Report', icon: FileSpreadsheet, description: 'Consolidated Audits, Bundles, & HAI Cases for holistic oversight' },
    { id: 'WARD_SUMMARY', label: 'Ward/Location Monthly Summary', icon: Building2, description: 'Comparative monthly scorecard per unit (PDF)' },
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

  const flattenObject = (ob: any, prefix = ''): any => {
    let toReturn: any = {};
    for (let i in ob) {
        if (!ob.hasOwnProperty(i)) continue;
        
        let keyName = i.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // CamelCase to Title Case
        if (prefix) keyName = `${prefix} - ${keyName}`;

        if ((typeof ob[i]) === 'object' && ob[i] !== null && !Array.isArray(ob[i]) && !(ob[i] instanceof Date) && typeof ob[i]?.toDate !== 'function') {
            let flatObject = flattenObject(ob[i], keyName);
            for (let x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                toReturn[x] = flatObject[x];
            }
        } else if (Array.isArray(ob[i])) {
            toReturn[keyName] = JSON.stringify(ob[i]);
        } else if (ob[i]?.toDate) {
            toReturn[keyName] = ob[i].toDate().toLocaleString();
        } else {
            toReturn[keyName] = ob[i];
        }
    }
    return toReturn;
  };

  const mapDataRecord = (d: any, type: string, subType: string = 'ALL') => {
    const common = {
      'System ID': d.id,
      'Source Collection': d.__source || type
    };

    switch (type) {
      case 'AUDITS':
        const auditDetails = d.details || {};
        
        const dateVal = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : (d.timestamp && !isNaN(new Date(d.timestamp).getTime()) ? new Date(d.timestamp).toLocaleString() : '');
        const commonAuditFields = {
          ...common,
          'Date': dateVal,
          'Auditor': d.auditorName || d.auditorEmail || d.auditorId,
          'Unit': d.unit,
          'Audit Type': (d.type || '').replace(/_/g, ' '),
          'Staff Observed': d.staffIdentifier || 'N/A'
        };

        if (subType === 'HH_COMPLIANCE' && d.type === 'HH_COMPLIANCE' && auditDetails.hhObs) {
          const obs = auditDetails.hhObs;
          let missedMoments: string[] = [];
          let missedWithGlovesCount = 0;
          let reasonsList: string[] = [];

          if (obs.entries && Array.isArray(obs.entries)) {
             obs.entries.forEach((e: any) => {
                if (e.action === 'missed') {
                   missedMoments.push(e.indications?.join(', ') || 'Unknown');
                   if (e.gloves) {
                      missedWithGlovesCount++;
                      reasonsList.push(`Gloves used instead of HH for [${e.indications?.join(', ') || '?'}]`);
                   }
                }
             });
          }

          const prepList = [];
          if (obs.shortNaturalNails === false) prepList.push('Long/Non-Natural Nails');
          if (obs.noArtificialNails === false) prepList.push('Artificial Nails Used');
          if (obs.noNailPolish === false) prepList.push('Nail Polish Present');
          if (obs.noJewelry === false) prepList.push('Wrist/Finger Jewelry Present');
          if (obs.bareBelowElbow === false) prepList.push('Not Bare Below Elbow');
          
          return {
             ...commonAuditFields,
             'Staff Category': d.profession || obs.profession || obs.role || 'N/A',
             'Total Opportunities': d.total || obs.total || 0,
             'Total Actions Performed': d.score || obs.score || 0,
             'Compliance %': (d.total > 0 ? (d.score / d.total) * 100 : 0).toFixed(1) + '%',
             'Missed Moments': missedMoments.length > 0 ? missedMoments.join('; ') : 'None',
             'Reasons for missed HH': reasonsList.length > 0 ? reasonsList.join('; ') : 'N/A',
             'Missed HH was gloves use': missedWithGlovesCount > 0 ? 'Yes' : 'No',
             'Nail & Hand Prep Pre-Requisites compliance': prepList.length === 0 ? "PASS" : `FAIL (${prepList.join(', ')})`,
             'Is Validated': d.isValidated ? 'YES' : 'NO',
             'Validator': d.validatorName || d.validatedBy || 'Pending'
          };
        } else if (subType === 'PPE_COMPLIANCE' && d.type === 'PPE_COMPLIANCE' && auditDetails.ppeCompliance) {
          const ppe = auditDetails.ppeCompliance;
          return {
             ...commonAuditFields,
             'Staff Category': d.profession || ppe.staffType || 'N/A',
             'Correct PPE for Zone (Yes/No)': ppe.correctPPE ? 'Yes' : 'No',
             'Wearing Correct PPE (Yes/No)': ppe.correctPPE ? 'Yes' : 'No',
             'Wearing Incorrect PPE (Yes/No)': ppe.incorrectPPE ? 'Yes' : 'No',
             'Appropriate PPE per Transmission-Based Isolation (Yes/No)': ppe.appropriatePPEPerIsolation ? 'Yes' : 'No',
             'Missing PPE Item (Specify item or write “None”)': ppe.missingItems ? ppe.missingItems : 'None',
             'Proper Donning Observed (Yes/No)': ppe.properDonning ? 'Yes' : 'No',
             'Proper Doffing Observed (Yes/No)': ppe.properDoffing ? 'Yes' : 'No',
             'PPE Intact (Yes/No)': ppe.ppeIntact ? 'Yes' : 'No',
             'PPE Fits Properly (Yes/No)': ppe.ppeFits ? 'Yes' : 'No',
             'Reason for Non-Compliance (Free text)': ppe.nonComplianceReason || 'N/A',
             'Is Validated': d.isValidated ? 'YES' : 'NO',
             'Validator': d.validatorName || d.validatedBy || 'Pending'
          };
        } else if (subType === 'HH_AVAILABILITY' && d.type === 'HH_AVAILABILITY' && auditDetails) {
          const abhr = auditDetails.abhr || {};
          const sink = auditDetails.sink || {};
          const posters = auditDetails.posters || {};
          const inventory = auditDetails.inventory || {};
          
          return {
             'Unit/Area': d.unit || 'N/A',
             'Date': dateVal,
             'ABHR at Point of Care (Yes/No)': abhr.poc ? 'Yes' : 'No',
             'Personnel Equipped with Portable ABHR (Yes/No)': abhr.personnelHasPortableABHR ? 'Yes' : 'No',
             'Bottle Not Empty (Yes/No)': abhr.notEmpty ? 'Yes' : 'No',
             'ABHR Expiry Date': abhr.expiry || 'N/I',
             'ABHR Expiry N/I (Yes/No)': abhr.notIndicated ? 'Yes' : 'No',
             'Pump Functional (Yes/No)': abhr.functional ? 'Yes' : 'No',
             'Alternative Delivery Method Used (Specify or “None”)': abhr.alternativeDeliveryMethod || 'None',
             'Properly Mounted/Placed (Yes/No)': abhr.mounted ? 'Yes' : 'No',
             'Functional Sink (Yes/No)': sink.sink ? 'Yes' : 'No',
             'Running Water (Yes/No)': sink.water ? 'Yes' : 'No',
             'Soap Available (Yes/No)': sink.soap ? 'Yes' : 'No',
             'Soap Expiry Date': sink.expiry || 'N/I',
             'Soap Expiry N/I (Yes/No)': sink.notIndicated ? 'Yes' : 'No',
             'Paper Towels Available (Yes/No)': sink.towels ? 'Yes' : 'No',
             'Sink Not Clogged (Yes/No)': sink.notClogged ? 'Yes' : 'No',
             'Posters Visible (Yes/No)': posters.visible ? 'Yes' : 'No',
             'Posters Clean/Readable (Yes/No)': posters.clean ? 'Yes' : 'No',
             'Inventory Audited (Yes/No)': inventory.audited ? 'Yes' : 'No',
             'Inventory Status (Adequate / Low / Critical)': inventory.status === 'OutOfStock' ? 'Critical' : (inventory.status || 'Adequate'),
             'Replenishment Action (Replenished / Not Needed / Pending)': inventory.replenished === 'Yes' ? 'Replenished' : (inventory.replenished === 'NotNeeded' ? 'Not Needed' : 'Pending'),
             'Assigned Personnel (Name/Role)': inventory.assignedPersonnel || 'N/A'
          };
        } else if (subType === 'PPE_AVAILABILITY' && d.type === 'PPE_AVAILABILITY' && auditDetails) {
          const ppe = auditDetails.ppe || {};
          const gloves = ppe.gloves || {};
          const masks = ppe.masks || {};
          const n95 = ppe.n95 || {};
          const gowns = ppe.gowns || {};
          const shields = ppe.shields || {};
          const signage = ppe.signage || {};
          const inventory = auditDetails.inventory || {};
          
          return {
             'Unit/Area': d.unit || 'N/A',
             'Date': dateVal,
             'Gloves Available (Yes/No)': gloves.avail ? 'Yes' : 'No',
             'Gloves Correct Sizes Available (Yes/No)': gloves.sizes ? 'Yes' : 'No',
             'Gloves Expiry Date': gloves.expiry || 'N/I',
             'Gloves Expiry N/I (Yes/No)': gloves.notIndicated ? 'Yes' : 'No',
             'Surgical Masks Available (Yes/No)': masks.avail ? 'Yes' : 'No',
             'Box Not Empty (Yes/No)': masks.notEmpty ? 'Yes' : 'No',
             'Surgical Mask Expiry Date': masks.expiry || 'N/I',
             'Surgical Mask Expiry N/I (Yes/No)': masks.notIndicated ? 'Yes' : 'No',
             'N95 Available (Yes/No)': n95.avail ? 'Yes' : 'No',
             'N95 Correct Sizes Available (Yes/No)': n95.sizes ? 'Yes' : 'No',
             'N95 Expiry Date': n95.expiry || 'N/I',
             'N95 Expiry N/I (Yes/No)': n95.notIndicated ? 'Yes' : 'No',
             'Gowns Available (Yes/No)': gowns.avail ? 'Yes' : 'No',
             'Sizes Appropriate for Staff (Yes/No)': gowns.appropriate ? 'Yes' : 'No',
             'Gown Expiry Date': gowns.expiry || 'N/I',
             'Gown Expiry N/I (Yes/No)': gowns.notIndicated ? 'Yes' : 'No',
             'Face Shields Available (Yes/No)': shields.avail ? 'Yes' : 'No',
             'Not Cracked/Damaged (Yes/No)': shields.notDamaged ? 'Yes' : 'No',
             'Transmission Isolation Signages Posted (Yes/No)': signage.posted ? 'Yes' : 'No',
             'Inventory Audited (Yes/No)': inventory.audited ? 'Yes' : 'No',
             'Inventory Status (Adequate / Low / Critical)': inventory.status === 'OutOfStock' ? 'Critical' : (inventory.status || 'Adequate'),
             'Replenishment Action (Replenished / Not Needed / Pending)': inventory.replenished === 'Yes' ? 'Replenished' : (inventory.replenished === 'NotNeeded' ? 'Not Needed' : 'Pending'),
             'Assigned Personnel (Name/Role)': inventory.assignedPersonnel || 'N/A'
          };
        } else if (subType === 'SAFE_INJECTION' && d.type === 'SAFE_INJECTION' && auditDetails.safeInjection) {
          const si = auditDetails.safeInjection;
          return {
             'Unit/Area': d.unit || 'N/A',
             'Date': dateVal,
             'HCW Category': d.profession || 'N/A',
             'Staff Name (Optional)': d.staffIdentifier || 'N/A',
             'Injection Prepared in Clean Area (Yes/No)': si.prepClean ? 'Yes' : 'No',
             'Alcohol Pad Available (Yes/No)': si.alcoholAvail ? 'Yes' : 'No',
             'Alcohol Pad Expiry Date': si.alcoholExpiry || 'N/I',
             'Alcohol Pad Expiry N/I (Yes/No)': si.alcoholNotIndicated ? 'Yes' : 'No',
             'Hand Hygiene Performed (Yes/No)': si.hhBefore ? 'Yes' : 'No',
             'Skin Disinfected (Yes/No)': si.skinDisinfected ? 'Yes' : 'No',
             'Allowed to Dry Completely (Yes/No)': si.allowedToDry ? 'Yes' : 'No',
             'No Touching of Site (Yes/No)': si.noTouchSite ? 'Yes' : 'No',
             'Single‑Dose Vial Used Once (Yes/No)': si.singleDoseOnce ? 'Yes' : 'No',
             'Multi‑Dose Vial Used Correctly (Yes/No)': si.multiDoseCorrect ? 'Yes' : 'No',
             'Vial Expiry Date': si.vialExpiry || 'N/I',
             'Vial Expiry N/I (Yes/No)': si.vialNotIndicated ? 'Yes' : 'No',
             'Vial Not Contaminated (Yes/No)': si.vialNotContaminated ? 'Yes' : 'No',
             'Sterile Syringe Used (Yes/No)': si.sterileSyringe ? 'Yes' : 'No',
             'Sterile Needle Used (Yes/No)': si.sterileNeedle ? 'Yes' : 'No',
             'No Recapping After Use (Yes/No)': si.noRecapping ? 'Yes' : 'No',
             'Needle Not Reused (Yes/No)': si.needleNotReused ? 'Yes' : 'No',
             'Correct Route Followed (Yes/No)': si.correctRoute ? 'Yes' : 'No',
             'Correct Dose Administered (Yes/No)': si.correctDose ? 'Yes' : 'No',
             'No Reuse Between Patients (Yes/No)': si.noReuse ? 'Yes' : 'No',
             'Used Syringe Disposed Immediately (Yes/No)': si.disposeImmediate ? 'Yes' : 'No',
             'Disposed Into Sharps Container (Yes/No)': si.disposeSharps ? 'Yes' : 'No',
             'Sharps Container ≤ 3/4 Full (Yes/No)': si.sharpsNotFull ? 'Yes' : 'No',
             'Sharps Container Properly Mounted (Yes/No)': si.sharpsMounted ? 'Yes' : 'No',
             'General Remarks / Notes': si.notes || 'N/A'
          };
        }

        let findings = '';
        
        if (d.type === 'ENV_CLEANING' && auditDetails.envCleaning?.surfaces) {
          const missed = Object.entries(auditDetails.envCleaning?.surfaces || {})
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
        } else if (d.type === 'HH_AVAILABILITY' && auditDetails) {
          const missings = [];
          if (!auditDetails.abhr?.poc) missings.push('No ABHR at POC');
          if (!auditDetails.sink?.sink) missings.push('No Sink');
          if (!auditDetails.sink?.soap) missings.push('No Soap');
          findings = missings.length > 0 ? `Missing: ${missings.join(', ')}` : 'Full Availability';
        } else if (d.type === 'PPE_AVAILABILITY' && auditDetails.ppe) {
          const ppe = auditDetails.ppe;
          const missings = [];
          if (!ppe.gloves?.avail) missings.push('Gloves');
          if (!ppe.masks?.avail) missings.push('Masks');
          if (!ppe.n95?.avail) missings.push('N95');
          if (!ppe.gowns?.avail) missings.push('Gowns');
          findings = missings.length > 0 ? `Missing: ${missings.join(', ')}` : 'Full Availability';
        }

        return {
          ...common,
          'Date': d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : (d.timestamp && !isNaN(new Date(d.timestamp).getTime()) ? new Date(d.timestamp).toLocaleString() : ''),
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
      case 'bundle_monitorings':
      case 'boc_logs':
        if (d.monitoringDays && Array.isArray(d.monitoringDays)) {
          return d.monitoringDays.map((day: any) => {
            const reqValues = Object.values(day.bundleChecklist || {});
            const requiredCount = reqValues.length;
            const compliantCount = reqValues.filter((v: any) => v === 'Done' || v === 'N/A').length;
            const compPct = requiredCount > 0 ? ((compliantCount / requiredCount) * 100).toFixed(1) : '0';
            
            return {
              ...common,
              'Date': day.date,
              'Time': 'N/A',
              'Unit': d.unit,
              'Patient Name': d.patientName,
              'Hosp Number': d.hospitalNo || d.hospNo || '',
              'Age/Sex': `${d.age || ''} / ${d.sex || ''}`,
              'Physician in-charge': d.attendingPhysician || 'N/A',
              'Devices': day.bundleType || '',
              'Compliance %': (day.complianceScores?.overall || compPct) + '%',
              'Staff Reporter': d.staffName || day.staffName || 'System',
              'Designation': 'N/A',
              'Clinical Criteria': day.clinicalCriteria ? Object.entries(day.clinicalCriteria).filter(([_, v]) => v === true || v === 'Present').map(([k]) => k).join(', ') : 'None',
              'Verification Status': day.verification?.isValidated ? 'Validated' : 'Pending',
              'Final Decision': day.verification?.isValidated ? 'Proceed' : 'N/A',
              'Reasoning': day.verification?.validatorComment || '',
              'Corrective Actions': '',
              'Validator Name': day.verification?.validatorName || '',
              'Validated At': day.verification?.validatedAt && !isNaN(new Date(day.verification.validatedAt).getTime()) ? new Date(day.verification.validatedAt).toLocaleString() : ''
            };
          });
        }
        return [{
          ...common,
          'Date': d.date || '',
          'Time': d.time || '',
          'Unit': d.unit || '',
          'Patient Name': d.patientName || '',
          'Hosp Number': d.hospNo || '',
          'Age/Sex': `${d.age || ''} / ${d.sex || ''}`,
          'Physician in-charge': d.attendingPhysician || 'N/A',
          'Devices': (d.devicesPresent || d.devices || []).join(', '),
          'Compliance %': (d.compliancePercentage || 0) + '%',
          'Staff Reporter': d.staffName || '',
          'Designation': d.staffDesignation || '',
          'Clinical Criteria': 'N/A',
          'Verification Status': d.isValidated ? 'Validated' : 'Pending',
          'Final Decision': d.verification?.finalDecision || 'N/A',
          'Reasoning': d.verification?.reason || '',
          'Corrective Actions': (d.verification?.correctiveAction || []).join('; '),
          'Validator Name': d.verification?.validatorName || '',
          'Validated At': d.verification?.date || ''
        }];

      case 'AMS':
      case 'ams_requests':
        return {
          ...common,
          'Request Type': d.type,
          'Date Requested': d.date || d.dateTimeRequested || '',
          'Patient Name': d.patientName,
          'Hosp Number': d.hospNo,
          'Unit': d.unit || d.ward || '',
          'Drug Requested': d.antibiotic || d.antimicrobialsRequested?.join(', '),
          'Indication': d.indication || d.indicationForUse,
          'Diagnosis': d.diagnosis || d.infectiousDiagnosis,
          'Status': d.status,
          'Prescriber': d.prescriberName || d.prescriberEmail || d.prescriberId,
          'Clinical Data': d.clinicalData || '',
          'Lab Data': d.labData || '',
          'Treatment Plan': d.treatmentPlan || '',
          'Duration': d.durationOfTherapy || '',
          'Justification': d.justification || '',
          'Decision Basis': d.overrideReason || d.remarks || '',
          'Reviewer': d.reviewerName || d.reviewerEmail || d.reviewerId || 'Pending',
          'Reviewed At': d.reviewedAt || 'Pending',
          'Pharmacist': d.pharmacistName || d.pharmacistId || 'N/A',
          'Dispensed At': d.dispensedAt || 'N/A',
          'Dispensing Remarks': d.dispensingRemarks || ''
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
          'Clinical Criteria': d.clinicalCriteria?.join('; ') || '',
          'Lab Criteria': d.labCriteria?.join('; ') || '',
          'Bundle Invariants': d.bundleIssues || '',
          'Clinical Summary': d.clinicalIssues || '',
          'Lab Summary': d.labIssues || '',
          'Validator': d.validatorName || 'Pending',
          'Decision Note': d.decisionNote || '',
          'Validated At': d.validatedAt || 'Pending'
        };

      case 'NSI':
      case 'nsi_reports':
        return {
          ...common,
          'Incident Date': d.incident?.date,
          'Incident Time': d.incident?.time,
          'Exposure Type': d.incident?.exposureType,
          'Category': d.incident?.category,
          'Device': d.incident?.deviceInvolved,
          'Device Safety': d.incident?.safetyDevice ? 'YES' : 'NO',
          'Activity': d.incident?.activity,
          'Unit': d.incident?.unit,
          'Department': d.staff?.department || '',
          'Designation': d.staff?.designation || '',
          'Staff Name': d.staff?.name || d.reporterName || d.reporterEmail,
          'Outcome': d.outcome || '',
          'Status': d.status,
          'IPCU Decision': d.validation?.decision || 'Pending',
          'Classification': d.validation?.classification || '',
          'Root Causes': (d.validation?.rootCauses || []).join('; '),
          'Corrective Actions': (d.validation?.correctiveActions || []).join('; '),
          'Validator': d.validation?.validatorName || d.validation?.validatorId || 'Pending',
          'Validated At': d.validation?.validatedAt?.toDate ? d.validation.validatedAt.toDate().toLocaleString() : 'Pending'
        };

      case 'OUTBREAK':
      case 'outbreaks':
        return {
          ...common,
          'Detected At': d.detectedAt,
          'Detected Time': d.detectedTime,
          'Type': (d.type || []).join(', '),
          'Reporting Source': (d.reportingSrc || []).join(', '),
          'Trigger Criteria': (d.triggerCriteria || []).join(', '),
          'Status': d.status,
          'Index Case': d.epidemiology?.indexCase || '',
          'Affected Units': d.epidemiology?.unitsAffected,
          'Total Cases': d.epidemiology?.totalCases,
          'Attack Rate (%)': d.epidemiology?.attackRate || '',
          'Transmission Mode': (d.epidemiology?.transmissionMode || []).join(', '),
          'Control Measures': (d.controlMeasures?.actions || []).join(', '),
          'Lab Findings': d.findings?.labAlerts?.organism || '',
          'Resistance Pattern': d.findings?.labAlerts?.resistancePattern || '',
          'Environmental Swabbing': d.findings?.envSwabbing?.done ? 'YES' : 'NO',
          'Reporter': d.reportedBy || d.reporterEmail || 'System',
          'Conclusion': d.conclusion || '',
          'Recommendations': d.recommendations || '',
          'Investigation Team': (d.investigationTeam || []).join('; '),
          'Validation Decision': d.validation?.decision || ''
        };

      default:
        let rawD = { ...d };
        delete rawD.id;
        delete rawD.__source;
        return { ...common, ...flattenObject(rawD) };
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      let rawData: any[] = [];
      
      const isIPCU = user?.role === 'ADMIN' || user?.role === 'IPCN';

      const fetchCollectionData = async (collName: string, dateFld: string) => {
        const collRef = collection(db, collName);
        let constraints: any[] = [];

        let start = timeFrame === 'DAILY' ? new Date(selectedDate) : (timeFrame === 'MONTHLY' ? new Date(Number(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1) : null);
        let end = timeFrame === 'DAILY' ? new Date(selectedDate) : (timeFrame === 'MONTHLY' ? new Date(Number(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0) : null);
        
        if (start && isNaN(start.getTime())) start = null;
        if (end && isNaN(end.getTime())) end = null;
        
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        // Date Constraints
        const stringDateFields = ['date', 'triggerDate', 'detectedAt'];
        
        if (collName !== 'bundle_monitorings' && collName !== 'audits') {
          if (timeFrame === 'DAILY') {
            if (stringDateFields.includes(dateFld)) {
              constraints.push(where(dateFld, '==', selectedDate));
            } else if (dateFld === 'timestamp' || dateFld === 'dateTimeRequested' || dateFld === 'reportedAt') {
              const startStr = start?.toISOString() || '';
              const endStr = end?.toISOString() || '';
              constraints.push(where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
            } else {
              constraints.push(where(dateFld, '>=', start), where(dateFld, '<=', end));
            }
          } else if (timeFrame === 'MONTHLY') {
            if (stringDateFields.includes(dateFld)) {
              const startStr = start?.toISOString().split('T')[0] || '';
              const endStr = end?.toISOString().split('T')[0] || '';
              constraints.push(where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
            } else if (dateFld === 'timestamp' || dateFld === 'dateTimeRequested' || dateFld === 'reportedAt') {
              const startStr = start?.toISOString() || '';
              const endStr = end?.toISOString() || '';
              constraints.push(where(dateFld, '>=', startStr), where(dateFld, '<=', endStr));
            } else {
              constraints.push(where(dateFld, '>=', start), where(dateFld, '<=', end));
            }
          } else {
            constraints.push(orderBy(dateFld, 'desc'));
          }
        }

        // User Constraints
        if (!isIPCU && user) {
          if (collName === 'audits' || collName === 'hai_cases') {
            constraints.push(where('auditorId', '==', user.uid));
          } else if (collName === 'bundle_monitorings' || collName === 'boc_logs') {
            constraints.push(where('staffId', '==', user.uid));
          } else if (collName === 'ams_requests') {
            if (user?.role !== 'APPROVER' && user?.role !== 'PHARMACY') {
              constraints.push(where('prescriberId', '==', user.uid));
            }
          } else if (collName === 'nsi_reports') {
            constraints.push(where('reporterId', '==', user.uid));
          }
        }

        const q = query(collRef, ...constraints, limit(200));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ __source: collName, ...doc.data() as any, id: doc.id }));
      };

      if (reportType === 'WARD_SUMMARY') {
        const [audits, rawBocLogs, amsRequests, haiCases, nsiReports] = await Promise.all([
          fetchCollectionData('audits', 'createdAt'),
          fetchCollectionData('bundle_monitorings', 'createdAt'),
          fetchCollectionData('ams_requests', 'createdAt'),
          fetchCollectionData('hai_cases', 'createdAt'),
          fetchCollectionData('nsi_reports', 'createdAt')
        ]);
        
        let bocLogs = rawBocLogs;
        if (timeFrame !== 'ALL_TIME') {
          bocLogs = rawBocLogs.map(log => {
             if (log.monitoringDays && Array.isArray(log.monitoringDays)) {
                 const filteredDays = log.monitoringDays.filter((day: any) => {
                     if (timeFrame === 'DAILY') return day.date === selectedDate;
                     if (timeFrame === 'MONTHLY') return day.date && day.date.startsWith(selectedMonth);
                     return true;
                 });
                 return { ...log, monitoringDays: filteredDays };
             }
             return log;
          });
        }
        
        const calcStats = (data: any[], type: string, ward: string | null) => {
          let subset = data;
          if (ward) {
             subset = data.filter(d => {
               const u = d.unit || d.ward || (d.incident?.unit) || (d.epidemiology?.unitsAffected?.[0]) || '';
               return u === ward;
             });
          }
          
          if (type.startsWith('AUDIT_TYPE:')) {
            const auditType = type.split(':')[1];
            const valid = subset.filter(d => d.total > 0 && d.type === auditType);
            if (!valid.length) return { score: 'N/A', raw: -1 };
            const avg = valid.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / valid.length;
            return { score: (avg * 100).toFixed(1) + '%', raw: avg * 100 };
          }
          if (type === 'AUDITS_ALL') {
            const valid = subset.filter(d => d.total > 0);
            if (!valid.length) return { score: 'N/A', raw: -1 };
            const avg = valid.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / valid.length;
            return { score: (avg * 100).toFixed(1) + '%', raw: avg * 100 };
          }
          if (type === 'BUNDLE') {
            let totalApplicable = 0;
            let totalCompliant = 0;
            subset.forEach(log => {
               if (log.monitoringDays && Array.isArray(log.monitoringDays)) {
                   log.monitoringDays.forEach((day: any) => {
                       if (day.bundleChecklist && Object.keys(day.bundleChecklist).length > 0) {
                           const reqValues = Object.values(day.bundleChecklist);
                           const applicable = reqValues.filter((v: any) => v !== "N/A");
                           totalApplicable += applicable.length;
                           totalCompliant += applicable.filter((v: any) => v === "Done").length;
                       } else if (day.elements) {
                           const reqValues = Object.values(day.elements);
                           totalApplicable += reqValues.length;
                           totalCompliant += reqValues.filter(Boolean).length;
                       }
                   });
               }
            });
            if (totalApplicable === 0) return { score: 'N/A', raw: -1 };
            const pct = (totalCompliant / totalApplicable) * 100;
            return { score: pct.toFixed(1) + '%', raw: pct };
          }
          if (type === 'AMS') {
            const approved = subset.filter(d => d.status === 'APPROVED');
            return { score: `${approved.length} / ${subset.length}`, raw: subset.length };
          }
          if (type === 'HAI') {
            return { score: `${subset.length}`, raw: subset.length };
          }
          if (type === 'NSI') {
            return { score: `${subset.length}`, raw: subset.length };
          }
          return { score: 'N/A', raw: -1 };
        };

        const wardStatsDefinitions = [
          { metric: 'Overall IPC Audit Avg', type: 'AUDITS_ALL', isPercent: true },
          { metric: '   Hand Hygiene Compliance', type: 'AUDIT_TYPE:HH_COMPLIANCE', isPercent: true },
          { metric: '   Hand Hygiene Availability', type: 'AUDIT_TYPE:HH_AVAILABILITY', isPercent: true },
          { metric: '   PPE Compliance', type: 'AUDIT_TYPE:PPE_COMPLIANCE', isPercent: true },
          { metric: '   PPE Availability', type: 'AUDIT_TYPE:PPE_AVAILABILITY', isPercent: true },
          { metric: '   Environmental Cleaning', type: 'AUDIT_TYPE:ENV_CLEANING', isPercent: true },
          { metric: '   Safe Injections', type: 'AUDIT_TYPE:SAFE_INJECTION', isPercent: true },
          { metric: 'Device Bundle Compliance', type: 'BUNDLE', isPercent: true },
          { metric: 'Reported HAI Cases', type: 'HAI', isPercent: false },
          { metric: 'Reported NSI Cases', type: 'NSI', isPercent: false }
        ];

        // We will store pure objects to pass to autoTable and also render custom bars
        const wardStatsData = wardStatsDefinitions.map(m => {
           let dataRef: any[] = [];
           if (m.type.startsWith('AUDIT_TYPE:') || m.type === 'AUDITS_ALL') dataRef = audits;
           if (m.type === 'BUNDLE') dataRef = bocLogs;
           if (m.type === 'AMS') dataRef = amsRequests;
           if (m.type === 'HAI') dataRef = haiCases;
           if (m.type === 'NSI') dataRef = nsiReports;
           
           const target = calcStats(dataRef, m.type, selectedWard);
           const otherWards = dataRef.filter(d => {
             const u = d.unit || d.ward || (d.incident?.unit) || (d.epidemiology?.unitsAffected?.[0]) || '';
             return u !== selectedWard;
           });
           const rest = calcStats(otherWards, m.type, null);
           
           let status = 'Neutral';
           if (m.isPercent) {
              if (target.raw > rest.raw && target.raw !== -1 && rest.raw !== -1) status = 'Better';
              if (target.raw < rest.raw && target.raw !== -1 && rest.raw !== -1) status = 'Worse';
           } else {
              // For counts, fewer is better generally (except maybe AMS where it's complex, but let's assume fewer cases is better)
              if (target.raw > rest.raw && target.raw !== -1 && rest.raw !== -1) status = 'Worse';
              if (target.raw < rest.raw && target.raw !== -1 && rest.raw !== -1) status = 'Better';
           }
           
           let performanceIndicator = '';
           if (status === 'Better') performanceIndicator = '(+) Better';
           if (status === 'Worse') performanceIndicator = '(-) Worse';
           if (status === 'Neutral') performanceIndicator = '(--) Neutral';
           if (target.raw === -1 || rest.raw === -1) performanceIndicator = '(--) N/A';

           return {
             metric: m.metric,
             targetScore: target.score,
             restScore: rest.score,
             status: performanceIndicator,
             rawTarget: target.raw,
             rawRest: rest.raw,
             isPercent: m.isPercent
           };
        });

        // Convert for standard autoTable array
        const autoTableData = wardStatsData.map(d => [
          d.metric, 
          d.targetScore, 
          d.restScore, 
          d.status
        ]);

        const doc = new jsPDF();
        
        try {
          const dohLogo = await getBase64ImageFromUrl('/doh-logo.png');
          const bagongPilipinas = await getBase64ImageFromUrl('/bagongpilipinas-logo.png');
          const mharsmcLogo = await getBase64ImageFromUrl('/mharsmc-logo.png'); 
          
          if (dohLogo) doc.addImage(dohLogo, 'PNG', 15, 10, 22, 22);
          if (mharsmcLogo) doc.addImage(mharsmcLogo, 'PNG', 40, 10, 22, 22);
          if (bagongPilipinas) doc.addImage(bagongPilipinas, 'PNG', 65, 10, 26, 26);
        } catch (e) {
          console.warn("Could not load header logos", e);
        }
        
        // --- HEADER ---
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'bold');
        doc.text('Republic of the Philippines', 100, 15);
        doc.text('Department of Health', 100, 20);
        doc.setFontSize(12);
        doc.text('Mayor Hilarion A. Ramiro Sr. Medical Center', 100, 25);
        doc.setFontSize(11);
        doc.setFont('times', 'normal');
        doc.text('Maningcol, Ozamiz City 7200', 100, 30);
        doc.text('Tel. No. (088) 521-0440; Telefax (088) 521-0022', 100, 35);
        doc.text('Email Address: mharsmc@mharsmc.doh.gov.ph', 100, 40);
        
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFont('helvetica', 'bold');
        doc.text(`Ward Analytics Report: ${selectedWard}`, 14, 55);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFont('helvetica', 'normal');
        const periodStr = timeFrame === 'MONTHLY' ? selectedMonth : (timeFrame === 'DAILY' ? selectedDate : 'All Time');
        doc.text(`Period: ${timeFrame} (${periodStr})`, 14, 63);
        
        autoTable(doc, {
          startY: 70,
          margin: { top: 20, right: 14, bottom: 25, left: 14 },
          pageBreak: 'auto',
          rowPageBreak: 'avoid',
          head: [['Metric', `Target (${selectedWard})`, 'Rest of Hospital', 'Comparison']],
          body: autoTableData,
          headStyles: { fillColor: [13, 148, 136] }, // brand-primary teal
          theme: 'grid',
          styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 35 },
            2: { cellWidth: 35 },
            3: { cellWidth: 40 }
          },
          willDrawCell: (data: any) => {
             if (data.section === 'body' && data.column.index === 3) {
                const val = String(data.cell.raw);
                if (val.includes('Better')) data.cell.styles.textColor = [16, 185, 129];
                if (val.includes('Worse')) data.cell.styles.textColor = [244, 63, 94];
                if (val.includes('Neutral') || val.includes('N/A')) data.cell.styles.textColor = [100, 116, 139];
             }
             if (data.section === 'body' && data.column.index === 0) {
                const val = String(data.cell.raw);
                if (val.startsWith('   ')) {
                   data.cell.styles.fontStyle = 'italic';
                   data.cell.styles.textColor = [100, 116, 139]; // subtle indent text
                } else {
                   data.cell.styles.fontStyle = 'bold';
                }
             }
          },
          didDrawCell: (data: any) => {
             if (data.section === 'body' && (data.column.index === 1 || data.column.index === 2)) {
                const rowData = wardStatsData[data.row.index];
                if (rowData && rowData.isPercent) {
                   const rawVal = data.column.index === 1 ? rowData.rawTarget : rowData.rawRest;
                   if (rawVal !== -1) {
                      const width = Math.max(2, (rawVal / 100) * (data.cell.width - 4));
                      doc.setDrawColor(13, 148, 136);
                      // Draw a 3px high bar under the text
                      doc.setFillColor(13, 148, 136);
                      doc.rect(data.cell.x + 2, data.cell.y + data.cell.height - 4, width, 2, 'F');
                   }
                }
             }
          }
        });

        // Track and Calculate Comprehensive Issues
        const allTargetAudits = audits.filter((d: any) => {
           const u = d.unit || d.ward || (d.incident?.unit) || (d.epidemiology?.unitsAffected?.[0]) || '';
           return u === selectedWard;
        });

        // 1. Hand Hygiene Missed Moments
        const targetAudits = allTargetAudits.filter((d: any) => d.type === 'HH_COMPLIANCE');
        let missedMomentsCount: Record<string, number> = {
           'Before Touching Patient': 0,
           'Before Clean/Aseptic Procedure': 0,
           'After Body Fluid Exposure Risk': 0,
           'After Touching Patient': 0,
           'After Touching Patient Surroundings': 0
        };
        let hhHcwNonCompliance: Record<string, number> = {};
        let hhnNailNonCompliance: Record<string, number> = {
           'Long / Non-Natural Nails': 0,
           'Artificial Nails / Extensions Used': 0,
           'Nail Polish / Chipped Color Present': 0,
           'Wrist & Finger Jewelry Present': 0,
           'Not Bare Below the Elbow (BBE)': 0
        };

        const mapIndication = (ind: string) => {
           if (ind === 'M1' || ind === 'before-patient') return 'Before Touching Patient';
           if (ind === 'M2' || ind === 'before-aseptic') return 'Before Clean/Aseptic Procedure';
           if (ind === 'M3' || ind === 'after-fluid') return 'After Body Fluid Exposure Risk';
           if (ind === 'M4' || ind === 'after-patient') return 'After Touching Patient';
           if (ind === 'M5' || ind === 'after-surroundings') return 'After Touching Patient Surroundings';
           return ind;
        };

        targetAudits.forEach((audit: any) => {
           let missedForHcw = 0;
           if (audit.details?.hhObs?.entries) {
              audit.details.hhObs.entries.forEach((e: any) => {
                 if (e.action === 'missed') {
                    missedForHcw++;
                    if (Array.isArray(e.indications)) {
                       e.indications.forEach((ind: string) => {
                          const key = mapIndication(ind);
                          if (missedMomentsCount[key] !== undefined) {
                             missedMomentsCount[key]++;
                          } else {
                             missedMomentsCount[key] = 1;
                          }
                       });
                    }
                 }
              });
           } else if (audit.details?.hhObs?.indications) {
              // Legacy format
              Object.entries(audit.details.hhObs.indications).forEach(([ind, active]) => {
                 if (active && audit.details.hhObs.actions?.[ind] === 'missed') {
                    missedForHcw++;
                    const key = mapIndication(ind);
                    if (missedMomentsCount[key] !== undefined) {
                       missedMomentsCount[key]++;
                    } else {
                       missedMomentsCount[key] = 1;
                    }
                 }
              });
           }
           if (missedForHcw > 0) {
              const prof = audit.profession || audit.details?.hhObs?.staffType || 'Unknown';
              hhHcwNonCompliance[prof] = (hhHcwNonCompliance[prof] || 0) + missedForHcw;
           }

           if (audit.details?.hhObs) {
              const obs = audit.details.hhObs;
              if (obs.shortNaturalNails === false) {
                 hhnNailNonCompliance['Long / Non-Natural Nails'] = (hhnNailNonCompliance['Long / Non-Natural Nails'] || 0) + 1;
              }
              if (obs.noArtificialNails === false) {
                 hhnNailNonCompliance['Artificial Nails / Extensions Used'] = (hhnNailNonCompliance['Artificial Nails / Extensions Used'] || 0) + 1;
              }
              if (obs.noNailPolish === false) {
                 hhnNailNonCompliance['Nail Polish / Chipped Color Present'] = (hhnNailNonCompliance['Nail Polish / Chipped Color Present'] || 0) + 1;
              }
              if (obs.noJewelry === false) {
                 hhnNailNonCompliance['Wrist & Finger Jewelry Present'] = (hhnNailNonCompliance['Wrist & Finger Jewelry Present'] || 0) + 1;
              }
              if (obs.bareBelowElbow === false) {
                 hhnNailNonCompliance['Not Bare Below the Elbow (BBE)'] = (hhnNailNonCompliance['Not Bare Below the Elbow (BBE)'] || 0) + 1;
              }
           }
        });

        // 2. HH Availability Issues
        let hhAvailIssues: Record<string, number> = {};
        allTargetAudits.filter((d: any) => d.type === 'HH_AVAILABILITY').forEach((audit: any) => {
           const details = audit.details;
           if (!details) return;
           if (details.abhr && !details.abhr.poc) hhAvailIssues['No ABHR at Point of Care'] = (hhAvailIssues['No ABHR at Point of Care'] || 0) + 1;
           if (details.abhr && !details.abhr.notEmpty) hhAvailIssues['ABHR Empty'] = (hhAvailIssues['ABHR Empty'] || 0) + 1;
           if (details.sink && !details.sink.sink) hhAvailIssues['No Functional Sink'] = (hhAvailIssues['No Functional Sink'] || 0) + 1;
           if (details.sink && !details.sink.soap) hhAvailIssues['No Soap Available'] = (hhAvailIssues['No Soap Available'] || 0) + 1;
           if (details.sink && !details.sink.towels) hhAvailIssues['No Paper Towels'] = (hhAvailIssues['No Paper Towels'] || 0) + 1;
        });

        // 3. PPE Compliance Issues
        let ppeComplianceIssues: Record<string, number> = {};
        let ppeHcwNonCompliance: Record<string, number> = {};
        allTargetAudits.filter((d: any) => d.type === 'PPE_COMPLIANCE').forEach((audit: any) => {
           const details = audit.details?.ppeCompliance;
           if (!details) return;
           let issues = 0;
           if (!details.correctPPE) { ppeComplianceIssues['Incorrect PPE Worn'] = (ppeComplianceIssues['Incorrect PPE Worn'] || 0) + 1; issues++; }
           if (details.properDonning === false) { ppeComplianceIssues['Improper Donning'] = (ppeComplianceIssues['Improper Donning'] || 0) + 1; issues++; }
           if (details.properDoffing === false) { ppeComplianceIssues['Improper Doffing'] = (ppeComplianceIssues['Improper Doffing'] || 0) + 1; issues++; }
           if (details.ppeIntact === false) { ppeComplianceIssues['PPE Not Intact/Damaged'] = (ppeComplianceIssues['PPE Not Intact/Damaged'] || 0) + 1; issues++; }
           if (details.missingItems) {
               const items = details.missingItems.split(',').map((s: string) => s.trim()).filter(Boolean);
               items.forEach((item: string) => {
                   const key = `Missing: ${item}`;
                   ppeComplianceIssues[key] = (ppeComplianceIssues[key] || 0) + 1;
               });
               issues += items.length;
           }
           if (issues > 0) {
               const prof = audit.profession || details.staffType || 'Unknown';
               ppeHcwNonCompliance[prof] = (ppeHcwNonCompliance[prof] || 0) + issues;
           }
        });

        // 4. PPE Availability Issues
        let ppeAvailIssues: Record<string, number> = {};
        allTargetAudits.filter((d: any) => d.type === 'PPE_AVAILABILITY').forEach((audit: any) => {
           const ppe = audit.details?.ppe;
           if (!ppe) return;
           if (ppe.gloves && !ppe.gloves.avail) ppeAvailIssues['Gloves Unavailable'] = (ppeAvailIssues['Gloves Unavailable'] || 0) + 1;
           if (ppe.masks && !ppe.masks.avail) ppeAvailIssues['Surgical Masks Unavailable'] = (ppeAvailIssues['Surgical Masks Unavailable'] || 0) + 1;
           if (ppe.n95 && !ppe.n95.avail) ppeAvailIssues['N95 Respirators Unavailable'] = (ppeAvailIssues['N95 Respirators Unavailable'] || 0) + 1;
           if (ppe.gowns && !ppe.gowns.avail) ppeAvailIssues['Isolation Gowns Unavailable'] = (ppeAvailIssues['Isolation Gowns Unavailable'] || 0) + 1;
           if (ppe.shields && !ppe.shields.avail) ppeAvailIssues['Face Shields Unavailable'] = (ppeAvailIssues['Face Shields Unavailable'] || 0) + 1;
            if (ppe.signage && !ppe.signage.posted) ppeAvailIssues['Transmission Isolation Signage Not Posted'] = (ppeAvailIssues['Transmission Isolation Signage Not Posted'] || 0) + 1;
        });

        // 5. Environmental Cleaning Issues
        let envCleaningIssues: Record<string, number> = {};
        allTargetAudits.filter((d: any) => d.type === 'ENV_CLEANING').forEach((audit: any) => {
            const surfaces = audit.details?.envCleaning?.surfaces;
            if (!surfaces) return;
            Object.entries(surfaces).forEach(([surface, status]) => {
                if (status === 'notCleaned') {
                    const name = surface.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
                    envCleaningIssues[name] = (envCleaningIssues[name] || 0) + 1;
                }
            });
        });

        // 6. Safe Injection Issues
        let safeInjectionIssues: Record<string, number> = {};
        let siHcwNonCompliance: Record<string, number> = {};
        allTargetAudits.filter((d: any) => d.type === 'SAFE_INJECTION').forEach((audit: any) => {
            const si = audit.details?.safeInjection;
            if (!si) return;
            const prof = audit.profession || 'Unknown';
            let issues = 0;
            if (si.hhBefore === false) { safeInjectionIssues['No Hand Hygiene Before'] = (safeInjectionIssues['No Hand Hygiene Before'] || 0) + 1; issues++; }
            if (si.prepClean === false) { safeInjectionIssues['Prepared in Unclean Area'] = (safeInjectionIssues['Prepared in Unclean Area'] || 0) + 1; issues++; }
            if (si.sterileSyringe === false) { safeInjectionIssues['Non-Sterile Syringe Used'] = (safeInjectionIssues['Non-Sterile Syringe Used'] || 0) + 1; issues++; }
            if (si.sterileNeedle === false) { safeInjectionIssues['Non-Sterile Needle Used'] = (safeInjectionIssues['Non-Sterile Needle Used'] || 0) + 1; issues++; }
            if (si.noRecapping === false) { safeInjectionIssues['Needle Recapping Observed'] = (safeInjectionIssues['Needle Recapping Observed'] || 0) + 1; issues++; }
            if (si.needleNotReused === false) { safeInjectionIssues['Needle Reused'] = (safeInjectionIssues['Needle Reused'] || 0) + 1; issues++; }
            if (si.singleDoseOnce === false) { safeInjectionIssues['Single-Dose Vial Reused'] = (safeInjectionIssues['Single-Dose Vial Reused'] || 0) + 1; issues++; }
            if (si.disposedImmediately === false) { safeInjectionIssues['Not Disposed Immediately'] = (safeInjectionIssues['Not Disposed Immediately'] || 0) + 1; issues++; }
            if (si.sharpsDisposed === false) { safeInjectionIssues['Not Disposed in Sharps Container'] = (safeInjectionIssues['Not Disposed in Sharps Container'] || 0) + 1; issues++; }
            if (issues > 0) siHcwNonCompliance[prof] = (siHcwNonCompliance[prof] || 0) + issues;
        });

        // 7. Bundle Compliance Issues
        let bundleMissedElements: Record<string, number> = {};
        let bundleClinicalCriteria: Record<string, number> = {
            'With Clinical Criteria': 0,
            'No Clinical Criteria Documented': 0
        };

        const targetBundles = bocLogs.filter(d => {
            const u = d.unit || d.ward || '';
            return u === selectedWard;
        });

        targetBundles.forEach((log: any) => {
            if (log.monitoringDays && Array.isArray(log.monitoringDays)) {
                log.monitoringDays.forEach((day: any) => {
                    let hasCriteria = false;
                    if (day.clinicalCriteria && Object.keys(day.clinicalCriteria).length > 0) {
                        hasCriteria = Object.values(day.clinicalCriteria).some(v => v === true || v === 'Present');
                    }
                    
                    if (hasCriteria) {
                        bundleClinicalCriteria['With Clinical Criteria']++;
                    } else {
                        bundleClinicalCriteria['No Clinical Criteria Documented']++;
                    }
                    if (day.bundleChecklist && Object.keys(day.bundleChecklist).length > 0) {
                        Object.entries(day.bundleChecklist).forEach(([el, status]) => {
                            if (status === "Not Done") {
                                const key = `${day.bundleType || 'Bundle'}: ${el}`;
                                bundleMissedElements[key] = (bundleMissedElements[key] || 0) + 1;
                            }
                        });
                    } else if (day.elements && Object.keys(day.elements).length > 0) {
                        Object.entries(day.elements).forEach(([el, isChecked]) => {
                            if (!isChecked) {
                                const key = `${day.bundleType || 'Bundle'}: ${el}`;
                                bundleMissedElements[key] = (bundleMissedElements[key] || 0) + 1;
                            }
                        });
                    }
                });
            }
        });

        let currentY = (doc as any).lastAutoTable.finalY + 15;
        
        const renderIssueTable = (title: string, dataObj: Record<string, number>, emptyMsg: string, headObj: string[] = ['Identified Issue', 'Occurrences']) => {
           const data = Object.entries(dataObj)
              .filter(([_, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([item, count]) => [item, count.toString()]);
           
           if (currentY > 260) {
              doc.addPage();
              currentY = 20;
           }

           doc.setFontSize(14);
           doc.setTextColor(15, 23, 42); // slate-900
           doc.text(`Analytical Breakdown: ${title}`, 14, currentY);

           if (data.length > 0) {
              autoTable(doc, {
                startY: currentY + 6,
                margin: { top: 20, right: 14, bottom: 20, left: 14 },
                pageBreak: 'auto',
                rowPageBreak: 'avoid',
                head: [headObj],
                body: data,
                headStyles: { fillColor: [244, 63, 94] }, // rose-500 for missing/issues
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
                columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60 } }
              });
              currentY = (doc as any).lastAutoTable.finalY + 15;
           } else {
              doc.setFontSize(11);
              doc.setTextColor(100, 116, 139);
              doc.text(emptyMsg, 14, currentY + 10);
              currentY += 25;
           }
        };

        renderIssueTable('Hand Hygiene Missed Moments', missedMomentsCount, 'No missed moments recorded.');
        renderIssueTable('Non-Compliant HCWs: Hand Hygiene', hhHcwNonCompliance, 'No hand hygiene non-compliance recorded.', ['Profession', 'Missed Actions']);
        renderIssueTable('HCW Hand & Wrist Prep Violations', hhnNailNonCompliance, 'No hand prep or nail hygiene non-compliance recorded.', ['Prep / Condition Issue', 'Violation Count']);
        renderIssueTable('Hand Hygiene Availability Issues', hhAvailIssues, 'No availability issues recorded.');
        renderIssueTable('PPE Compliance Issues', ppeComplianceIssues, 'No PPE compliance issues recorded.');
        renderIssueTable('Non-Compliant HCWs: PPE', ppeHcwNonCompliance, 'No PPE non-compliance recorded.', ['Profession', 'Issues Count']);
        renderIssueTable('PPE Availability Issues', ppeAvailIssues, 'No PPE availability issues recorded.');
        renderIssueTable('Safe Injection Issues', safeInjectionIssues, 'No safe injection issues recorded.');
        renderIssueTable('Non-Compliant HCWs: Safe Injection', siHcwNonCompliance, 'No safe injection non-compliance recorded.', ['Profession', 'Issues Count']);
        renderIssueTable('Environmental Cleaning Missed Surfaces', envCleaningIssues, 'No missed surfaces recorded.');
        renderIssueTable('Device Bundles: Frequently Missed Elements', bundleMissedElements, 'No missed bundle elements recorded.');
        renderIssueTable('Device Bundles: Clinical Criteria Checks', bundleClinicalCriteria, 'No clinical criteria checks recorded.', ['Documentation Status', 'Log Count']);

        // 8. Signature Block
        if (currentY > 220) {
           doc.addPage();
           currentY = 20;
        }

        currentY += 10;
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.5);

        // Monitored By Section
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFont('helvetica', 'normal');
        doc.text('Monitored By:', 14, currentY);

        doc.line(14, currentY + 18, 90, currentY + 18); // line for writing/signature

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('(Signature over Printed Name)', 14, currentY + 24);

        // Verified By Section
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text('Verified By:', 114, currentY);

        doc.line(114, currentY + 18, 190, currentY + 18); // line for signature

        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFont('helvetica', 'bold');
        doc.text('Mishelle Vonnabie O. Bala, MD, FPCP, FPSMID', 114, currentY + 24);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFont('helvetica', 'normal');
        doc.text('IPCU Manager', 114, currentY + 29);

        // Add Footer to all pages
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          
          // Motto at the bottom (slightly raised)
          doc.setFontSize(13);
          doc.setFont('times', 'italic');
          doc.setTextColor(21, 128, 61); // green-700
          doc.text('"Serbisyong Kasaligan, MHARSMC imong kauban"', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 15, { align: 'center' });

          // Thin divider line for ISO footer block
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.3);
          doc.line(14, doc.internal.pageSize.getHeight() - 11, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 11);

          // ISO Document Control Block and Page Numbering
          doc.setFontSize(8);
          doc.setFont('times', 'normal');
          doc.setTextColor(100, 116, 139); // slate-500
          
          // Left aligned ISO document code with system generation trace
          doc.text('Document Control No. HIPC-FM-040 / Rev. 0 / 1 June 2026 | Generated via IPC Guard', 14, doc.internal.pageSize.getHeight() - 7);
          
          // Right aligned page numbering
          doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
        }

        doc.save(`${selectedWard.replace(/\s+/g, '_')}_Report_${periodStr}.pdf`);
        setMessage({ type: 'success', text: `Ward PDF Report for ${selectedWard} downloaded successfully.` });
        return;
      }

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
            'Physician in-charge': 'N/A',
            'Clinical Criteria': 'N/A',
            'Validation Status': d.isValidated ? 'Validated' : 'Pending',
            'IPCU Decision': 'N/A',
            'Validator/Reviewer': 'N/A',
            'Clinical Rationale/Action': ''
          };

          if (domain === 'AUDIT') {
            base.Date = d.createdAt instanceof Timestamp ? d.createdAt.toDate().toLocaleString() : (d.timestamp && !isNaN(new Date(d.timestamp).getTime()) ? new Date(d.timestamp).toLocaleString() : '');
            base['Staff/Reporter'] = d.auditorName || d.auditorEmail || d.auditorId || 'N/A';
            base['Assessment Type'] = (d.type || '').replace(/_/g, ' ');
            base['Performance Result'] = `${d.score}/${d.total}`;
            base['Compliance %'] = (d.total > 0 ? (d.score / d.total) * 100 : 0).toFixed(1) + '%';
            base['IPCU Decision'] = d.monitoringStatus || 'N/A';
            base['Validator/Reviewer'] = d.validatorName || d.validatedBy || 'N/A';
            base['Clinical Rationale/Action'] = [d.remarks, d.reason, d.correctiveActions?.join('; ')].filter(Boolean).join(' | ');
          } else if (domain === 'BUNDLE') {
            if (d.monitoringDays && Array.isArray(d.monitoringDays)) {
              return d.monitoringDays.map((day: any) => {
                 const reqValues = Object.values(day.bundleChecklist || {});
                 const reqCount = reqValues.length;
                 const compCount = reqValues.filter((v: any) => v === 'Done' || v === 'N/A').length;
                 const compPct = reqCount > 0 ? ((compCount / reqCount) * 100).toFixed(1) + '%' : '0%';
                 return {
                    ...base,
                    Date: day.date,
                    'Patient/Subject': d.patientName || d.hospitalNo || 'N/A',
                    'Staff/Reporter': d.staffName || day.staffName || 'N/A',
                    'Physician in-charge': d.attendingPhysician || 'N/A',
                    'Clinical Criteria': day.clinicalCriteria ? Object.entries(day.clinicalCriteria).filter(([_, v]) => v === true || v === 'Present').map(([k]) => k).join(', ') : 'None',
                    'Assessment Type': day.bundleType || 'Bundle Assessment',
                    'Performance Result': (day.complianceScores?.overall || compPct.replace('%', '')) + '%',
                    'Compliance %': (day.complianceScores?.overall || compPct.replace('%', '')) + '%',
                    'IPCU Decision': day.verification?.isValidated ? 'Proceed' : 'N/A',
                    'Validator/Reviewer': day.verification?.validatorName || 'N/A',
                    'Clinical Rationale/Action': day.verification?.validatorComment || ''
                 };
              });
            }
            base.Date = d.date;
            base['Patient/Subject'] = d.patientName || d.hospNo || 'N/A';
            base['Staff/Reporter'] = d.staffName || 'N/A';
            base['Physician in-charge'] = d.attendingPhysician || 'N/A';
            base['Clinical Criteria'] = 'N/A';
            base['Assessment Type'] = (d.devicesPresent || []).join(', ') || 'Bundle Assessment';
            base['Performance Result'] = (d.compliancePercentage || 0) + '%';
            base['Compliance %'] = (d.compliancePercentage || 0) + '%';
            base['IPCU Decision'] = d.verification?.finalDecision || 'N/A';
            base['Validator/Reviewer'] = d.verification?.validatorName || 'N/A';
            base['Clinical Rationale/Action'] = [d.verification?.reason, d.verification?.correctiveAction?.join('; ')].filter(Boolean).join(' | ');
            return [base];
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

        let bundleData = results[1].flatMap(d => unifiedMapper(d, 'BUNDLE'));
        
        if (timeFrame !== 'ALL_TIME') {
            bundleData = bundleData.filter(row => {
               if (timeFrame === 'DAILY') {
                   return row.Date === selectedDate;
               } else if (timeFrame === 'MONTHLY') {
                   return row.Date && row.Date.startsWith(selectedMonth);
               }
               return true;
            });
        }

        const formattedData = results[0].map(d => unifiedMapper(d, 'AUDIT'))
          .concat(bundleData)
          .concat(results[2].map(d => unifiedMapper(d, 'HAI')));
          
        downloadCSV(formattedData, `Systems_Integrity_Consolidated_Report`);
      } else {
        let collectionName = '';
        let dateField = 'createdAt';
        
        switch (reportType) {
          case 'COMPLIANCE': collectionName = 'bundle_monitorings'; dateField = 'createdAt'; break;
          case 'AUDITS': collectionName = 'audits'; dateField = 'timestamp'; break;
          case 'AMS': collectionName = 'ams_requests'; dateField = 'createdAt'; break;
          case 'HAI': collectionName = 'hai_cases'; dateField = 'createdAt'; break;
          case 'NSI': collectionName = 'nsi_reports'; dateField = 'createdAt'; break;
          case 'OUTBREAK': collectionName = 'outbreaks'; dateField = 'createdAt'; break;
        }
        let data = await fetchCollectionData(collectionName, dateField);
        
        if (reportType === 'AUDITS' && selectedAuditType !== 'ALL') {
            data = data.filter((d: any) => d.type === selectedAuditType);
        }

        if (reportType === 'AUDITS' && timeFrame !== 'ALL_TIME') {
            const start = timeFrame === 'DAILY' ? new Date(selectedDate) : new Date(Number(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1);
            const end = timeFrame === 'DAILY' ? new Date(selectedDate) : new Date(Number(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            
            data = data.filter((d: any) => {
               const recDate = d.createdAt?.toDate ? d.createdAt.toDate() : (d.timestamp ? new Date(d.timestamp) : null);
               if (!recDate) return false;
               return recDate >= start && recDate <= end;
            });
        }

        let formattedData = data.flatMap(d => mapDataRecord(d, reportType, selectedAuditType));
        
        if (reportType === 'COMPLIANCE' && timeFrame !== 'ALL_TIME') {
          formattedData = formattedData.filter(row => {
            const dateVal = row['Date Logged'] || row.Date || row.date;
            if (timeFrame === 'DAILY') {
              return dateVal === selectedDate;
            } else if (timeFrame === 'MONTHLY') {
              return dateVal && dateVal.startsWith(selectedMonth); // e.g. 2026-06
            }
            return true;
          });
        }
        
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
                 <div className="space-y-1.5 break-inside-avoid">
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
               
               {reportType === 'WARD_SUMMARY' && (
                 <div className="space-y-1.5 mt-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Target Ward/Location</label>
                   <div className="relative">
                     <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                     <select 
                       value={selectedWard}
                       onChange={e => setSelectedWard(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-brand-primary/20 outline-none"
                     >
                       {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                     </select>
                   </div>
                 </div>
               )}

               {reportType === 'AUDITS' && (
                 <div className="space-y-1.5 mt-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Specific Audit</label>
                   <div className="relative">
                     <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                     <select 
                       value={selectedAuditType}
                       onChange={e => setSelectedAuditType(e.target.value)}
                       className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-brand-primary/20 outline-none"
                     >
                       {auditTypeOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                     </select>
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
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2 text-white">
                {reportType === 'WARD_SUMMARY' ? 'Generate PDF' : 'Generate CSV'}
              </h3>
              <p className="text-[10px] text-slate-400 mb-8 font-bold uppercase tracking-widest leading-loose">
                Ready to compile {reportType.toLowerCase().replace('_', ' ')} records for {timeFrame.toLowerCase()} period.
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
                   const collRef = collection(db, coll.id);
                   const isIPCU = user?.role === 'ADMIN' || user?.role === 'IPCN';
                   let constraints: any[] = [];
                   if (!isIPCU && user) {
                      if (coll.id === 'audits' || coll.id === 'hai_cases') {
                        constraints.push(where('auditorId', '==', user.uid));
                      } else if (coll.id === 'boc_logs') {
                        constraints.push(where('staffId', '==', user.uid));
                      } else if (coll.id === 'ams_requests') {
                        if (user?.role !== 'APPROVER' && user?.role !== 'PHARMACY') {
                          constraints.push(where('prescriberId', '==', user.uid));
                        }
                      } else if (coll.id === 'nsi_reports') {
                        constraints.push(where('reporterId', '==', user.uid));
                      }
                   }
                   const q = query(collRef, ...constraints, limit(200));
                   const snap = await getDocs(q);
                   if (snap.empty) {
                     masterContent += "No records found.\n\n";
                     continue;
                   }
                   const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
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
