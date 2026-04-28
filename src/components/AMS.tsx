import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAntibioticRecommendation } from '../services/amsAlertService';
import { 
  Stethoscope, 
  FlaskConical, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Search,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  FileDown,
  Activity,
  Fingerprint,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AMSRequest, AMSStatus } from '../types';
import { UNITS, ANTIBIOTICS } from '../constants';
import { cn, formatDate } from '../lib/utils';

const getAwareStyles = (drugName: string) => {
  if (ANTIBIOTICS.ACCESS.includes(drugName)) {
    return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', bgBadge: 'bg-emerald-100', label: 'Access' };
  }
  if (ANTIBIOTICS.WATCH.includes(drugName)) {
    return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', bgBadge: 'bg-amber-100', label: 'Watch' };
  }
  if (ANTIBIOTICS.RESERVE.includes(drugName)) {
    return { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', bgBadge: 'bg-rose-100', label: 'Reserve' };
  }
  return { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-700', bgBadge: 'bg-slate-100', label: 'Other' };
};

export default function AMS({ user }: { user: UserProfile | null }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<AMSRequest[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'DASHBOARD'>('LIST');

  const getDepartment = (unit: string) => {
    if (['ICU', 'NICU', 'PICU', 'HDU'].includes(unit)) return 'Critical Care';
    if (['Ward 1A', 'Ward 1B', 'Ward 1C', 'Medical Ward'].includes(unit)) return 'Medicine';
    if (['Ward 2A', 'Ward 2B', 'Surgical Ward', 'OR'].includes(unit)) return 'Surgery';
    if (['OB Ward', 'DR'].includes(unit)) return 'OB-GYN';
    if (['Ward 3A', 'Ward 3B', 'Pedia Ward'].includes(unit)) return 'Pediatrics';
    if (['ER', 'OPD 1', 'OPD 2'].includes(unit)) return 'Emergency/Outpatient';
    return 'Ancillary/Other';
  };

  const getStats = () => {
    const stats = {
      commonAntibiotic: 'N/A',
      wardWithMostRequests: 'N/A',
      deptWithMostRequests: 'N/A',
      indications: { Prophylactic: 0, Empiric: 0, Definitive: 0 },
      focusOfInfection: {} as Record<string, number>,
      extensionsPerWard: {} as Record<string, number>,
      antibioticUsage: [] as { name: string, count: number }[],
      wardRequests: [] as { name: string, count: number }[],
      deptRequests: [] as { name: string, count: number }[],
      commonIndication: 'N/A',
      commonFocus: 'N/A',
    };

    if (requests.length === 0) return stats;

    const abUsage: Record<string, number> = {};
    const wRequests: Record<string, number> = {};
    const dRequests: Record<string, number> = {};

    requests.forEach(req => {
      req.antimicrobialsRequested?.forEach(ab => {
        abUsage[ab] = (abUsage[ab] || 0) + 1;
      });

      wRequests[req.unit] = (wRequests[req.unit] || 0) + 1;

      const dept = getDepartment(req.unit);
      dRequests[dept] = (dRequests[dept] || 0) + 1;

      if (req.type === 'EXTENSION_7D') {
        stats.extensionsPerWard[req.unit] = (stats.extensionsPerWard[req.unit] || 0) + 1;
      }

      if (req.indicationForUse) {
        stats.indications[req.indicationForUse] = (stats.indications[req.indicationForUse] || 0) + 1;
      }

      req.focusOfInfection?.forEach(focus => {
        stats.focusOfInfection[focus] = (stats.focusOfInfection[focus] || 0) + 1;
      });
    });

    stats.antibioticUsage = Object.entries(abUsage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    stats.wardRequests = Object.entries(wRequests)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    stats.deptRequests = Object.entries(dRequests)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    stats.commonAntibiotic = stats.antibioticUsage[0]?.name || 'N/A';
    stats.wardWithMostRequests = stats.wardRequests[0]?.name || 'N/A';
    stats.deptWithMostRequests = stats.deptRequests[0]?.name || 'N/A';

    const topIndication = Object.entries(stats.indications).sort((a, b) => b[1] - a[1])[0];
    stats.commonIndication = topIndication && topIndication[1] > 0 ? topIndication[0] : 'N/A';

    const topFocus = Object.entries(stats.focusOfInfection).sort((a, b) => b[1] - a[1])[0];
    stats.commonFocus = topFocus && topFocus[1] > 0 ? topFocus[0] : 'N/A';

    return stats;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
      return dateStr;
    }
  };
  const [isAdding, setIsAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AMSStatus | 'ALL'>('ALL');
  const [formData, setFormData] = useState<Partial<AMSRequest>>({
    type: 'RESTRICTED_USE',
    hospNo: '',
    location: '',
    firstName: '',
    middleName: '',
    lastName: '',
    patientName: '',
    date: new Date().toISOString().split('T')[0],
    drugAllergy: { hasAllergy: false, specify: '' },
    sex: 'Male',
    dob: '',
    age: '',
    ageUnit: 'Years',
    weight: '',
    height: '',
    serumCreatinine: '',
    creatinineClearance: '',
    sgpt: '',
    sgot: '',
    antimicrobialsRequested: [],
    drugDoses: {},
    dosingRegimen: '',
    indicationForUse: 'Empiric',
    focusOfInfection: [],
    focusOther: '',
    infectiousDiagnosis: '',
    cultureSent: [],
    cultureDateSent: new Date().toISOString().split('T')[0],
    previousAntibiotics: [],
    immunocompromisingCondition: [],
    microbiology: {
      date: new Date().toISOString().split('T')[0],
      specimen: '',
      organism: '',
      resistancePattern: ''
    },
    criticallyIll: {
      sepsisCriteria: [],
      sepsisOther: '',
      organDysfunctionCriteria: [],
      organOther: ''
    },
    unit: UNITS[0],
    antibiotic: '',
    dose: '',
    diagnosis: '',
    justification: '',
    prescriberContact: '',
    requestingPhysician: '',
    durationRequested: '',
    status: 'PENDING'
  });

  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});
  const [reviewPhysicians, setReviewPhysicians] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const baseQuery = collection(db, 'ams_requests');
    let q;

    if (user.role === 'ADMIN' || user.role === 'IPCN' || user.role === 'APPROVER') {
      q = query(baseQuery, orderBy('createdAt', 'desc'));
    } else {
      q = query(baseQuery, where('prescriberId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AMSRequest));
      setRequests(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ams_requests');
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.antimicrobialsRequested || formData.antimicrobialsRequested.length === 0) {
      setErrorMessage("Please select at least one antimicrobial.");
      return;
    }

    const isExtension = checkExtensionNeeded(formData.hospNo || '', formData.antimicrobialsRequested || []);
    if (isExtension && formData.type !== 'EXTENSION_7D') {
      setErrorMessage("This patient already has an active request for the same antibiotic. This must be filed as an EXTENSION.");
      setFormData(prev => ({ ...prev, type: 'EXTENSION_7D' }));
      return;
    }

    try {
      const patientName = `${formData.firstName} ${formData.middleName ? formData.middleName + ' ' : ''}${formData.lastName}`;
      const dateTimeRequested = new Date().toISOString();
      
      if (editingId) {
        await updateDoc(doc(db, 'ams_requests', editingId), {
          ...formData,
          patientName,
          updatedAt: serverTimestamp()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'ams_requests'), {
          ...formData,
          patientName,
          dateTimeRequested,
          prescriberId: user.uid,
          prescriberEmail: user.email || '',
          prescriberName: user.name, // adding name
          status: 'PENDING',
          isValidated: false,
          createdAt: serverTimestamp()
        });
      }
      setIsAdding(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ams_requests');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'RESTRICTED_USE',
      hospNo: '',
      location: '',
      firstName: '',
      middleName: '',
      lastName: '',
      patientName: '',
      date: new Date().toISOString().split('T')[0],
      drugAllergy: { hasAllergy: false, specify: '' },
      sex: 'Male',
      dob: '',
      age: '',
      ageUnit: 'Years',
      weight: '',
      height: '',
      serumCreatinine: '',
      creatinineClearance: '',
      sgpt: '',
      sgot: '',
      antimicrobialsRequested: [],
      drugDoses: {},
      dosingRegimen: '',
      indicationForUse: 'Empiric',
      focusOfInfection: [],
      infectiousDiagnosis: '',
      cultureSent: [],
      cultureDateSent: new Date().toISOString().split('T')[0],
      previousAntibiotics: [],
      immunocompromisingCondition: [],
      microbiology: {
        date: new Date().toISOString().split('T')[0],
        specimen: '',
        organism: '',
        resistancePattern: ''
      },
      criticallyIll: {
        sepsisCriteria: [],
        organDysfunctionCriteria: []
      },
      unit: UNITS[0],
      antibiotic: '',
      dose: '',
      diagnosis: '',
      justification: '',
      prescriberContact: '',
      requestingPhysician: '',
      durationRequested: '',
      status: 'PENDING'
    });
  };

  const handleEdit = (req: AMSRequest) => {
    setFormData({
      ...req,
      date: req.date || new Date().toISOString().split('T')[0]
    });
    setEditingId(req.id!);
    setIsAdding(true);
  };

  const handleDelete = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to delete this drug request? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'ams_requests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ams_requests/${requestId}`);
    }
  };

  const handleAction = async (requestId: string, status: AMSStatus) => {
    if (!user) return;
    const req = requests.find(r => r.id === requestId);
    if (!req) return;

    const remarks = reviewRemarks[requestId] || '';
    const requestingPhysician = reviewPhysicians[requestId] || '';
    const now = new Date();
    const dateTimeApproved = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    try {
      const updateData: any = {
        status,
        remarks,
        reviewerId: user.uid,
        reviewerEmail: user.email,
        reviewerName: user.name,
        reviewedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      };

      if (status === 'APPROVED') {
        updateData.dateTimeApproved = dateTimeApproved;
      }

      if (requestingPhysician) {
        updateData.requestingPhysician = requestingPhysician;
      }

      await updateDoc(doc(db, 'ams_requests', requestId), updateData);

      // Notify Pharmacy if approved
      if (status === 'APPROVED') {
        try {
          await fetch('/api/notify-pharmacy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: req.antibiotic,
              patientName: req.patientName,
              patientHrn: req.patientHrn,
              ward: req.unit,
              justification: req.justification || remarks,
              prescriberName: req.prescriberName || 'Physician',
            })
          });
        } catch (e) {
          console.error("Failed to notify pharmacy via email", e);
        }
      }
      
      setReviewRemarks(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setReviewPhysicians(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `ams_requests/${requestId}`);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date Requested', 'Patient Name', 'Hospital No', 'Unit', 'Antibiotic', 
      'Dose', 'Status', 'Indication', 'Physician', 'Approved Date'
    ];
    
    const rows = filteredRequests.map(req => [
      formatDate(req.dateTimeRequested || ''),
      req.patientName || '',
      req.hospNo || '',
      req.unit || '',
      req.antibiotic || '',
      req.dose || '',
      req.status,
      req.indicationForUse || '',
      req.requestingPhysician || '',
      req.dateTimeApproved || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Antimicrobial_Stewardship_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string>('');

  useEffect(() => {
    if (formData.antimicrobialsRequested && formData.antimicrobialsRequested.length > 0) {
      const rec = getAntibioticRecommendation(
        formData.antimicrobialsRequested, 
        formData.cultureSent || [], 
        formData.unit || ''
      );
      setRecommendation(rec);
    } else {
      setRecommendation('');
    }
  }, [formData.antimicrobialsRequested, formData.cultureSent, formData.unit]);

  const checkExtensionNeeded = (hospNo: string, selectedAntibiotics: string[]) => {
    if (!hospNo || selectedAntibiotics.length === 0) return false;
    
    // Check if any of the selected antibiotics have been requested by this patient before
    return requests.some(req => 
      req.hospNo === hospNo && 
      (req.status === 'APPROVED' || req.status === 'PENDING' || req.status === 'DISPENSED') &&
      selectedAntibiotics.some(ab => req.antimicrobialsRequested?.includes(ab))
    );
  };

  useEffect(() => {
    const isExtension = checkExtensionNeeded(formData.hospNo || '', formData.antimicrobialsRequested || []);
    if (isExtension && formData.type !== 'EXTENSION_7D') {
      setFormData(prev => ({ ...prev, type: 'EXTENSION_7D' }));
    }
  }, [formData.hospNo, formData.antimicrobialsRequested]);

  const generatePDF = (req: AMSRequest) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 15;

      // Header
      doc.setFontSize(18);
      doc.setTextColor(13, 148, 136); // Teal-600
      doc.text('Antimicrobial Stewardship Request', pageWidth / 2, currentY, { align: 'center' });
      currentY += 7;
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Request ID: ${req.id?.slice(-8) || 'N/A'} | Type: ${req.type.replace('_', ' ')}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 10;

      // Status Banner
      const statusColors: Record<string, [number, number, number]> = {
        'PENDING': [245, 158, 11], // Amber-500
        'APPROVED': [16, 185, 129], // Emerald-500
        'DENIED': [244, 63, 94], // Rose-500
        'DISPENSED': [14, 165, 233], // Sky-500
        'OVERRIDDEN': [99, 102, 241], // Indigo-500
      };
      
      const statusColor = statusColors[req.status] || [100, 116, 139];
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.rect(14, currentY, pageWidth - 28, 8, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.text(`CURRENT STATUS: ${req.status}${req.manualApproval ? ' (MANUAL APPROVAL)' : ''}`, pageWidth / 2, currentY + 5.5, { align: 'center' });
      currentY += 15;

      if (req.status === 'OVERRIDDEN' && req.overrideReason) {
        doc.setFontSize(9);
        doc.setTextColor(99, 102, 241);
        doc.text(`Override Reason: ${req.overrideReason}`, 14, currentY);
        currentY += 10;
      }

      // Section: Patient Identity
      autoTable(doc, {
        startY: currentY,
        head: [['Patient Identification', 'Value']],
        body: [
          ['Full Name', `${req.lastName}, ${req.firstName} ${req.middleName || ''}`.trim()],
          ['Hospital Number', req.hospNo || 'N/A'],
          ['Location / Ward', `${req.unit || 'N/A'} / ${req.location || 'N/A'}`],
          ['Sex / Age', `${req.sex || 'N/A'} / ${req.age || 'N/A'} ${req.ageUnit || 'N/A'}`],
          ['Date of Birth', req.dob || 'N/A'],
          ['Drug Allergy', req.drugAllergy?.hasAllergy ? `YES: ${req.drugAllergy.specify}` : 'No known drug allergies'],
        ],
        headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { horizontal: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Section: Clinical Parameters
      autoTable(doc, {
        startY: currentY,
        head: [['Clinical & Vital Parameters', 'Value']],
        body: [
          ['Weight / Height', `${req.weight || 'N/A'} kg / ${req.height || 'N/A'} cm`],
          ['Serum Creatinine', `${req.serumCreatinine || 'N/A'} mg/dL`],
          ['Creatinine Clearance', `${req.creatinineClearance || 'N/A'} mL/min`],
          ['Liver Function (SGPT/SGOT)', `${req.sgpt || 'N/A'} / ${req.sgot || 'N/A'} IU/L`],
          ['Immunocompromised', req.immunocompromisingCondition?.length ? req.immunocompromisingCondition.join(', ') + (req.immunocompromisingOthers ? ` (${req.immunocompromisingOthers})` : '') : 'None documented'],
        ],
        headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 } },
        margin: { horizontal: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Section: Previous Antibiotics (30 days)
      if (req.previousAntibiotics && req.previousAntibiotics.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [['Previous Antibiotics (Last 30 Days)', 'Dose', 'Period', 'Indication']],
          body: req.previousAntibiotics.map(ab => [
            ab.name,
            ab.dose,
            `${ab.startDate} to ${ab.stopDate}`,
            ab.indication
          ]),
          headStyles: { fillColor: [71, 85, 105], fontSize: 9 },
          margin: { horizontal: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // Check if we need a new page for Order Details
      if (currentY > 180) {
        doc.addPage();
        currentY = 20;
      }

      // Section: The Antimicrobial Order
      autoTable(doc, {
        startY: currentY,
        head: [['Antimicrobial Agent Requested', 'Dose Information']],
        body: req.antimicrobialsRequested?.map(drug => [
          drug, 
          req.drugDoses?.[drug] || 'No specific dose provided'
        ]) || [['No drugs selected', 'N/A']],
        headStyles: { fillColor: [13, 148, 136], fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        margin: { horizontal: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Section: Clinical Indication
      autoTable(doc, {
        startY: currentY,
        head: [['Clinical Context & Indication', 'Details']],
        body: [
          ['Indication Type', req.indicationForUse || 'N/A'],
          ['Infectious Diagnosis', req.infectiousDiagnosis || req.diagnosis || 'N/A'],
          ['Focus of Infection', (req.focusOfInfection?.join(', ') || 'N/A') + (req.focusOther ? ` (${req.focusOther})` : '')],
          ['Cultures Sent', (req.cultureSent?.join(', ') || 'NONE') + (req.cultureDateSent ? ` on ${req.cultureDateSent}` : '') + (req.cultureOthers ? ` [${req.cultureOthers}]` : '')],
          ['Dosing Regimen / Remarks', req.dosingRegimen || 'N/A'],
          ['Detailed Justification', req.justification || 'N/A'],
        ],
        headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { horizontal: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Section: Critical Illness Criteria
      if (req.criticallyIll && (req.criticallyIll.sepsisCriteria?.length || req.criticallyIll.organDysfunctionCriteria?.length)) {
        autoTable(doc, {
          startY: currentY,
          head: [['Critical Illness Inclusion Criteria', 'Findings']],
          body: [
            ['Sepsis Criteria', req.criticallyIll.sepsisCriteria?.join(', ') + (req.criticallyIll.sepsisOther ? ` (${req.criticallyIll.sepsisOther})` : '') || 'None'],
            ['Organ Dysfunction', req.criticallyIll.organDysfunctionCriteria?.join(', ') + (req.criticallyIll.organOther ? ` (${req.criticallyIll.organOther})` : '') || 'None'],
          ],
          headStyles: { fillColor: [225, 29, 72], fontSize: 10 },
          margin: { horizontal: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // Section: Microbiology
      if (req.indicationForUse === 'Definitive' && req.microbiology) {
        autoTable(doc, {
          startY: currentY,
          head: [['Microbiology Results', 'Details']],
          body: [
            ['Collection Date', req.microbiology.date || 'N/A'],
            ['Specimen Type', req.microbiology.specimen || 'N/A'],
            ['Organism Isolated', req.microbiology.organism + (req.microbiology.otherOrganism ? ` (${req.microbiology.otherOrganism})` : '')],
            ['Resistance Pattern', req.microbiology.resistancePattern + (req.microbiology.otherResistance ? ` - ${req.microbiology.otherResistance}` : '')],
          ],
          headStyles: { fillColor: [124, 58, 237], fontSize: 10 },
          margin: { horizontal: 14 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // Check for new page for footer/signatures
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      // Section: Request Timeline & Approval
      autoTable(doc, {
        startY: currentY,
        head: [['Request & Review Timeline', 'Timestamp', 'Personnel']],
        body: [
          ['Date/Time Requested', req.dateTimeRequested || 'N/A', req.requestingPhysician || req.prescriberEmail || 'Unknown'],
          ['Review Outcome', req.status || 'PENDING', req.reviewerEmail || 'Awaiting Review'],
          ['Approval Date', req.dateTimeApproved || 'N/A', req.status === 'APPROVED' ? req.reviewerEmail || 'N/A' : 'N/A'],
          ['Dispensing Log', req.status === 'DISPENSED' ? 'DISPENSED' : 'N/A', req.dispensedBy || 'N/A'],
        ],
        headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
        margin: { horizontal: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;

      if (req.remarks) {
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text('Reviewer Remarks:', 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitRemarks = doc.splitTextToSize(req.remarks, pageWidth - 28);
        doc.text(splitRemarks, 14, currentY + 5);
        currentY += (splitRemarks.length * 5) + 10;
      }

      // Signature area
      doc.setDrawColor(200);
      doc.line(14, currentY + 15, 80, currentY + 15);
      doc.line(pageWidth - 80, currentY + 15, pageWidth - 14, currentY + 15);
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('Attending Physician Signature', 14, currentY + 20);
      doc.text('Infectious Disease Consultant / Antimicrobial Stewardship Lead', pageWidth - 80, currentY + 20);

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} | Generated by IPCU Management System | ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' });
      }

      doc.save(`Antimicrobial_Order_${req.hospNo}_${req.lastName}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Failed to generate PDF. Error: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const isApprover = user?.role === 'APPROVER' || user?.role === 'ADMIN' || user?.role === 'IPCN';

  const filteredRequests = (activeFilter === 'ALL' 
    ? requests 
    : requests.filter(r => r.status === activeFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row shadow-sm sm:shadow-none items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">Antimicrobial Stewardship</h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-tight">Antimicrobial stewardship and restriction protocols</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto btn-primary px-6 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">New Drug Request</span>
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Ledger - The main list */}
        <div className="col-span-12 bento-card bg-white min-h-[500px] flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
              {['LIST', 'DASHBOARD'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={cn(
                    "px-3 sm:px-4 py-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                    viewMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            {viewMode === 'LIST' && (
              <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar ml-auto">
                {['ALL', 'PENDING', 'APPROVED', 'DENIED', 'DISPENSED'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f as any)}
                    className={cn(
                      "px-3 sm:px-4 py-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                      activeFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={exportToCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 transition-colors text-[9px] font-black uppercase tracking-widest"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <div className="flex-1 sm:flex-none flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-white focus-within:ring-1 focus-within:ring-brand-primary">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Search..." className="text-[10px] font-bold focus:outline-none w-full sm:w-24 uppercase" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {viewMode === 'DASHBOARD' ? (
              <AMSDashboard stats={getStats()} />
            ) : (
              filteredRequests.map((req) => (
              <div key={req.id} className="group border border-transparent hover:border-slate-100 rounded-2xl transition-all">
                <div 
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === req.id ? null : req.id!)}
                >
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl",
                      req.status === 'PENDING' ? "bg-amber-100/50 text-amber-600" : req.status === 'APPROVED' ? "bg-emerald-100/50 text-emerald-600" : "bg-rose-100/50 text-rose-600"
                    )}>
                      <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-tight">{req.antibiotic}</h4>
                        <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.unit}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                         <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-tight opacity-80">{req.type.replace('_', ' ')} • MISSION CRITICAL</p>
                         {req.dateTimeRequested && <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Req: {formatDate(req.dateTimeRequested)}</p>}
                         <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[150px] sm:max-w-none">Physician: {req.prescriberName || req.requestingPhysician || req.prescriberEmail}</p>
                         {req.isValidated && (
                            <p className="text-[8px] sm:text-[9px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                               <CheckCircle2 className="w-2.5 h-2.5" />
                               <span className="hidden sm:inline">Validated by:</span> {req.reviewerName || req.validatedBy}
                            </p>
                         )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto border-t border-slate-50 sm:border-none pt-3 sm:pt-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); generatePDF(req); }}
                      className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                      title="Download PDF"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                      {req.prescriberId === user?.uid && req.status === 'PENDING' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(req); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit Request"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {(user?.role === 'ADMIN' || user?.role === 'IPCN') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(req.id!); }}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {req.status === 'PENDING' && isApprover ? null : (
                         <div className={cn(
                            "px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                            req.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : 
                            req.status === 'DISPENSED' ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" :
                            req.status === 'DENIED' ? "bg-rose-100 text-rose-700" : 
                            "bg-amber-100 text-amber-700"
                          )}>
                            {req.status === 'DISPENSED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {req.status}
                          </div>
                      )}
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expandedId === req.id && "rotate-180")} />
                    </div>
                    
                    {req.status === 'PENDING' && isApprover ? (
                      <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAction(req.id!, 'APPROVED'); }}
                            className="p-1.5 sm:p-2 bg-white rounded-lg text-emerald-600 hover:text-emerald-700 shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-[8px] sm:text-[9px] font-bold uppercase">Approve</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAction(req.id!, 'DENIED'); }}
                            className="p-1.5 sm:p-2 bg-white rounded-lg text-rose-600 hover:text-rose-700 shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="text-[8px] sm:text-[9px] font-bold uppercase">Deny</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {(user?.role === 'PHARMACY' || user?.role === 'ADMIN' || user?.role === 'IPCN') && req.status === 'APPROVED' && (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await updateDoc(doc(db, 'ams_requests', req.id!), {
                                  status: 'DISPENSED',
                                  dispensedBy: user?.name || user?.email,
                                  dispensedAt: serverTimestamp()
                                });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `ams_requests/${req.id}`);
                              }
                            }}
                            className="px-3 py-1.5 bg-sky-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-sky-600/30 hover:bg-sky-500 active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <FlaskConical className="w-3 h-3" />
                            <span className="hidden xs:inline">Dispense</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                  <div className="flex items-center gap-8 pl-16">
                     <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 opacity-50">Justification Summary</p>
                        <p className="text-xs text-slate-700 font-medium italic truncate max-w-md">"{req.justification || req.diagnosis}"</p>
                     </div>
                     <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 border-l border-slate-100 pl-8">
                        <div className="flex flex-col items-end">
                           <span className="uppercase">{req.patientName}</span>
                           <span className="font-mono text-[9px] opacity-60 tracking-tight">{req.hospNo}</span>
                        </div>
                     </div>
                  </div>

                <AnimatePresence>
                  {expandedId === req.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-slate-50 border-t border-slate-100"
                    >
                      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Patient Details</p>
                               <div className="space-y-1">
                                  <p className="text-xs font-bold text-slate-700">{req.sex}, {req.age} {req.ageUnit}</p>
                                  <p className="text-xs text-slate-600">DOB: {req.dob}</p>
                                  <p className="text-xs text-slate-600">Loc: {req.location}</p>
                               </div>
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Drug Allergy</p>
                               <p className="text-xs font-bold text-slate-700">{req.drugAllergy?.hasAllergy ? `YES: ${req.drugAllergy.specify}` : 'NONE'}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Vital Parameters</p>
                               <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  <p className="text-xs text-slate-500 uppercase">Weight: <span className="text-slate-900 font-bold">{req.weight}kg</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Height: <span className="text-slate-900 font-bold">{req.height}cm</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Creatinine: <span className="text-slate-900 font-bold">{req.serumCreatinine}</span></p>
                                  <p className="text-xs text-slate-500 uppercase">Clearance: <span className="text-slate-900 font-bold">{req.creatinineClearance}</span></p>
                               </div>
                            </div>

                            {req.previousAntibiotics && req.previousAntibiotics.length > 0 && (
                               <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Previous Antibiotics</p>
                                  <div className="space-y-2">
                                     {req.previousAntibiotics.map((pa, idx) => (
                                       <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-[10px]">
                                          <div className="flex justify-between items-start mb-1">
                                             <span className="font-bold text-slate-800">{pa.name}</span>
                                             <span className="text-slate-500">{pa.startDate} - {pa.stopDate}</span>
                                          </div>
                                          <p className="text-slate-600">Dose: {pa.dose}</p>
                                          <p className="text-slate-500 italic">Indication: {pa.indication}</p>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}

                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Indication & Focus</p>
                               <p className="text-xs font-bold text-brand-primary uppercase underline">{req.indicationForUse}</p>
                               <p className="text-[10px] text-slate-600 mt-1">{req.focusOfInfection?.join(', ')}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Order Summary</p>
                               <div className="space-y-2">
                                  {req.type === 'EXTENSION_7D' && req.durationRequested && (
                                     <div className="mb-2 px-3 py-1.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                                        <p className="text-[10px] font-black text-brand-primary uppercase">Extension for {req.durationRequested} Days</p>
                                     </div>
                                  )}
                                  {req.antimicrobialsRequested?.map(drug => (
                                    <div key={drug} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100">
                                       <span className="text-xs font-bold text-slate-900">{drug}</span>
                                       <span className="text-[10px] font-mono bg-slate-50 px-2 py-0.5 rounded text-slate-600">{req.drugDoses?.[drug] || 'No dose info'}</span>
                                    </div>
                                  ))}
                               </div>
                               <p className="text-[10px] text-slate-500 mt-2 italic">Remarks: {req.dosingRegimen}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Cultures & Conditions</p>
                               <p className="text-[10px] text-slate-600 font-bold uppercase">{req.cultureSent?.join(', ') || 'NONE SENT'} {req.cultureDateSent && `(${req.cultureDateSent})`}</p>
                               <div className="mt-1 flex flex-wrap gap-1">
                                  {req.immunocompromisingCondition?.map(c => (
                                    <span key={c} className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase">{c}</span>
                                  ))}
                               </div>
                            </div>
                         </div>

                         <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                            {req.criticallyIll && (req.criticallyIll.sepsisCriteria.length > 0 || req.criticallyIll.organDysfunctionCriteria.length > 0) && (
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Critical Illness Criteria</p>
                                <div className="space-y-3">
                                   {req.criticallyIll.sepsisCriteria.length > 0 && (
                                     <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mb-1">Sepsis</p>
                                        <div className="flex flex-wrap gap-1">
                                           {req.criticallyIll.sepsisCriteria.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded border border-rose-100 font-medium">{s}</span>)}
                                        </div>
                                     </div>
                                   )}
                                   {req.criticallyIll.organDysfunctionCriteria.length > 0 && (
                                     <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mb-1">Organ Dysfunction</p>
                                        <div className="flex flex-wrap gap-1">
                                           {req.criticallyIll.organDysfunctionCriteria.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100 font-medium">{s}</span>)}
                                        </div>
                                     </div>
                                   )}
                                </div>
                              </div>
                            )}

                            {req.indicationForUse === 'Definitive' && req.microbiology && (
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary mb-2">Microbiology Result (Definitive)</p>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <p className="text-xs font-black text-slate-900">{req.microbiology.organism}</p>
                                         <p className="text-[10px] text-slate-500 uppercase font-bold">{req.microbiology.specimen} • {req.microbiology.date}</p>
                                      </div>
                                      <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[9px] font-black rounded uppercase">
                                         {req.microbiology.resistancePattern}
                                      </span>
                                   </div>
                                </div>
                              </div>
                            )}
                         </div>

                         <div className="col-span-full pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Detailed Justification</p>
                               <p className="text-xs text-slate-700 leading-relaxed font-serif italic">"{req.justification || 'No detailed justification provided.'}"</p>
                            </div>
                            {req.requestingPhysician && (
                               <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Requesting Physician</p>
                                 <p className="text-sm font-bold text-slate-900">{req.requestingPhysician}</p>
                               </div>
                            )}
                            {req.prescriberContact && (
                               <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Physician Contact</p>
                                 <p className="text-sm font-bold text-slate-900">{req.prescriberContact}</p>
                               </div>
                            )}
                            {req.status === 'DISPENSED' && (
                               <div className="md:col-span-2 bg-sky-50 p-4 rounded-2xl border border-sky-100 flex items-center justify-between mt-4">
                                  <div className="flex items-center gap-4">
                                     <div className="bg-sky-100 p-2 rounded-xl text-sky-600">
                                        <FlaskConical className="w-5 h-5" />
                                     </div>
                                     <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Dispensed by Pharmacy</p>
                                        <p className="text-sm font-bold text-slate-900">{req.dispensedBy}</p>
                                     </div>
                                  </div>
                                  {req.dispensedAt && (
                                     <div className="text-right text-[10px] font-bold text-sky-500 uppercase">
                                        {req.dispensedAt?.toDate ? req.dispensedAt.toDate().toLocaleString() : String(req.dispensedAt)}
                                     </div>
                                  )}
                               </div>
                            )}
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
        </div>
      </div>

      {/* Request Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-brand-primary p-2 rounded-xl text-white">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                      {editingId ? 'Edit AMS Request' : 'Antimicrobial Stewardship Request'}
                    </h3>
                  </div>
                  
                  {!editingId && (
                    <div className="flex bg-slate-200 p-1 rounded-xl">
                      {[
                        { id: 'RESTRICTED_USE', label: 'Initial Request' },
                        { id: 'EXTENSION_7D', label: '7-Day Extension' }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, type: t.id as any })}
                          className={cn(
                            "px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                            formData.type === t.id ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                  <AnimatePresence>
                    {errorMessage && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600"
                      >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-xs font-bold uppercase tracking-tight">{errorMessage}</p>
                        <button type="button" onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-rose-100 rounded-full transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Patient Identity */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Patient Information</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hospital Number <span className="text-rose-500">*</span></label>
                          <input 
                            required
                            className="text-input" 
                            placeholder="Hosp Number"
                            value={formData.hospNo}
                            onChange={e => setFormData({...formData, hospNo: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Location / Ward <span className="text-rose-500">*</span></label>
                          <input 
                            required
                            className="text-input" 
                            placeholder="Unit/Bed"
                            value={formData.location}
                            onChange={e => setFormData({...formData, location: e.target.value})}
                          />
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">First Name <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Last Name <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                          </div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Middle Name <span className="text-rose-500">*</span></label>
                          <input required className="text-input" value={formData.middleName} onChange={e => setFormData({...formData, middleName: e.target.value})} />
                       </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sex <span className="text-rose-500">*</span></label>
                           <select required className="text-input" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value as any})}>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                           </select>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Age <span className="text-rose-500">*</span></label>
                           <div className="flex gap-1">
                              <input required className="text-input w-full" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                              <select required className="text-input bg-slate-100" value={formData.ageUnit} onChange={e => setFormData({...formData, ageUnit: e.target.value as any})}>
                                <option value="Years">Y</option>
                                <option value="Months">M</option>
                                <option value="Days">D</option>
                              </select>
                           </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date of Birth <span className="text-rose-500">*</span></label>
                         <input required type="date" className="text-input" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                      </div>
                    </div>

                    {/* Clinical Parameters */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Vital & Clinical Parameters</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Weight (kg) <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Height (cm) <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Serum Creatinine <span className="text-rose-500">*</span></label>
                             <input required className="text-input" placeholder="mg/dL" value={formData.serumCreatinine} onChange={e => setFormData({...formData, serumCreatinine: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cr. Clearance <span className="text-rose-500">*</span></label>
                             <input required className="text-input" placeholder="mL/min" value={formData.creatinineClearance} onChange={e => setFormData({...formData, creatinineClearance: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SGPT (IU/L) <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.sgpt} onChange={e => setFormData({...formData, sgpt: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">SGOT (IU/L) <span className="text-rose-500">*</span></label>
                             <input required className="text-input" value={formData.sgot} onChange={e => setFormData({...formData, sgot: e.target.value})} />
                          </div>
                       </div>
                    </div>

                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Previous Antibiotics Used</h4>
                      <p className="text-[10px] text-slate-500 font-medium">List antibiotics used in the last 30 days</p>
                    </div>

                    <div className="col-span-full space-y-4">
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <div className="space-y-4">
                             {formData.previousAntibiotics?.map((ab, idx) => (
                               <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-white rounded-2xl border border-slate-100 relative group">
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const updated = [...(formData.previousAntibiotics || [])];
                                      updated.splice(idx, 1);
                                      setFormData({...formData, previousAntibiotics: updated});
                                    }}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Antibiotic</label>
                                     <input className="text-input py-1.5" value={ab.name} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].name = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Dose</label>
                                     <input className="text-input py-1.5" value={ab.dose} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].dose = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Start Date</label>
                                     <input type="date" className="text-input py-1.5" value={ab.startDate} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].startDate = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Stop Date</label>
                                     <input type="date" className="text-input py-1.5" value={ab.stopDate} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].stopDate = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[9px] font-bold uppercase text-slate-400">Indication</label>
                                     <input className="text-input py-1.5" value={ab.indication} onChange={e => {
                                       const updated = [...(formData.previousAntibiotics || [])];
                                       updated[idx].indication = e.target.value;
                                       setFormData({...formData, previousAntibiotics: updated});
                                     }} />
                                  </div>
                               </div>
                             ))}
                             <button
                               type="button"
                               onClick={() => setFormData({
                                 ...formData, 
                                 previousAntibiotics: [...(formData.previousAntibiotics || []), { name: '', dose: '', startDate: '', stopDate: '', indication: '' }]
                               })}
                               className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all flex items-center justify-center gap-2"
                             >
                               <Plus className="w-4 h-4" />
                               <span className="text-[10px] font-black uppercase tracking-widest">Add Previous Antibiotic Used</span>
                             </button>
                          </div>
                       </div>
                    </div>

                    {/* Order Details */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">
                        {formData.type === 'EXTENSION_7D' ? 'Extension Order Details' : 'Antimicrobial Order'}
                      </h4>
                      {formData.type === 'EXTENSION_7D' && (
                        <div className="flex items-center gap-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Duration (Days):</label>
                           <input 
                             className="w-16 text-center text-xs font-black bg-white border border-brand-primary/20 rounded-lg py-1 px-2 focus:ring-1 focus:ring-brand-primary outline-none"
                             value={formData.durationRequested}
                             onChange={e => setFormData({...formData, durationRequested: e.target.value})}
                           />
                        </div>
                      )}
                    </div>

                    <div className="col-span-full md:col-span-2 space-y-4">
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                             {formData.type === 'EXTENSION_7D' ? 'Antimicrobials for Extension' : 'Antimicrobials Requested (Enter dose per drug)'}
                          </label>
                          
                          {formData.type === 'EXTENSION_7D' ? (
                             <div className="space-y-4 p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/10">
                                <div className="space-y-1">
                                   <label className="text-[9px] font-bold uppercase text-brand-primary">Select Antimicrobial</label>
                                   <select 
                                      className="text-input"
                                      onChange={e => {
                                         if (!e.target.value) return;
                                         const drugName = e.target.value;
                                         const current = formData.antimicrobialsRequested || [];
                                         if (!current.includes(drugName)) {
                                            const updated = [...current, drugName];
                                            setFormData({...formData, antimicrobialsRequested: updated, antibiotic: updated.join(', ')});
                                         }
                                         e.target.value = ''; // Reset select
                                      }}
                                   >
                                      <option value="">Choose an antimicrobial...</option>
                                      {ANTIBIOTICS.FULL.map(drug => (
                                         <option key={drug} value={drug}>{drug}</option>
                                      ))}
                                      <option value="Others">Others (Specify)</option>
                                   </select>
                                </div>
                                {formData.antimicrobialsRequested && formData.antimicrobialsRequested.length > 0 && (
                                   <div className="space-y-3 pt-2">
                                      {formData.antimicrobialsRequested.map(drug => {
                                         const styles = getAwareStyles(drug);
                                         return (
                                            <div key={drug} className={cn("flex flex-col gap-2 p-3 rounded-2xl border shadow-sm transition-colors", styles.bg, styles.border)}>
                                               <div className="flex justify-between items-center">
                                                  <div className="flex items-center gap-2">
                                                     <span className={cn("text-xs font-bold uppercase", styles.text)}>{drug}</span>
                                                     <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full", styles.bgBadge, styles.text)}>
                                                        {styles.label}
                                                     </span>
                                                  </div>
                                                  <button 
                                                     type="button"
                                                     onClick={() => {
                                                        const updated = formData.antimicrobialsRequested!.filter(d => d !== drug);
                                                        setFormData({...formData, antimicrobialsRequested: updated, antibiotic: updated.join(', ')});
                                                     }}
                                                     className="text-slate-400 hover:text-rose-500 transition-colors"
                                                  >
                                                     <Trash2 className="w-4 h-4" />
                                                  </button>
                                               </div>
                                               {drug === 'Others' && (
                                                  <input 
                                                     className="text-input py-1.5 bg-white/50"
                                                     placeholder="Specify drug name..."
                                                     value={formData.otherAntibiotic || ''}
                                                     onChange={e => setFormData({...formData, otherAntibiotic: e.target.value})}
                                                  />
                                               )}
                                               <input 
                                                  className="w-full text-[10px] font-bold uppercase tracking-tight bg-white/50 border border-slate-100 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary"
                                                  placeholder={`Enter dose for ${drug === 'Others' ? (formData.otherAntibiotic || 'Other Drug') : drug}`}
                                                  value={formData.drugDoses?.[drug] || ''}
                                                  onChange={e => setFormData({
                                                     ...formData, 
                                                     drugDoses: { ...formData.drugDoses, [drug]: e.target.value }
                                                  })}
                                               />
                                            </div>
                                         );
                                      })}
                                   </div>
                                )}
                             </div>
                          ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                {[
                                  { id: 'micafungin', name: 'Micafungin' },
                                  { id: 'aztreonam', name: 'Aztreonam' },
                                  { id: 'cefepime_tazo', name: 'Cefepime + Tazobactam' },
                                  { id: 'ceftaz_avi', name: 'Ceftazidime–Avibactam' },
                                  { id: 'ertapenem', name: 'Ertapenem' },
                                  { id: 'imipenem', name: 'Imipenem–Cilastatin' },
                                  { id: 'meropenem', name: 'Meropenem' },
                                  { id: 'colistin', name: 'Colistin / Polymyxin' },
                                  { id: 'ampho_b', name: 'Amphotericin B' },
                                  { id: 'linezolid', name: 'Linezolid' },
                                  { id: 'vancomycin', name: 'Vancomycin' },
                                  { id: 'voriconazole', name: 'Voriconazole' },
                                  { id: 'others', name: 'Others' }
                                ].map(drug => {
                                  const styles = getAwareStyles(drug.name);
                                  const isSelected = formData.antimicrobialsRequested?.includes(drug.name);
                                  return (
                                    <div key={drug.id} className={cn("space-y-2 p-3 rounded-2xl border transition-all", 
                                      isSelected ? styles.bg : "bg-white",
                                      isSelected ? styles.border : "border-slate-50 shadow-xs"
                                    )}>
                                      <label className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                          type="checkbox"
                                          className={cn("w-5 h-5 rounded-lg border-slate-300 focus:ring-brand-primary", 
                                            isSelected ? styles.text : "text-brand-primary"
                                          )}
                                          checked={isSelected}
                                          onChange={e => {
                                             const current = formData.antimicrobialsRequested || [];
                                             const updated = e.target.checked ? [...current, drug.name] : current.filter(d => d !== drug.name);
                                             setFormData({...formData, antimicrobialsRequested: updated, antibiotic: updated.join(', ')});
                                          }}
                                        />
                                        <div className="flex flex-col">
                                           <span className={cn("text-[11px] font-black uppercase tracking-widest transition-colors", 
                                             isSelected ? styles.text : "text-slate-700 group-hover:text-slate-900"
                                           )}>{drug.name}</span>
                                           {isSelected && (
                                              <span className={cn("text-[8px] font-bold uppercase", styles.text)}>
                                                 {styles.label} Group
                                              </span>
                                           )}
                                        </div>
                                      </label>
                                      <AnimatePresence>
                                        {isSelected && (
                                          <motion.div 
                                            initial={{ opacity: 0, x: -10 }} 
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="pl-8 space-y-2"
                                          >
                                            {drug.id === 'others' && (
                                               <input 
                                                 className="w-full text-input py-2 mb-2 bg-white"
                                                 placeholder="Specify drug name..."
                                                 value={formData.otherAntibiotic || ''}
                                                 onChange={e => setFormData({...formData, otherAntibiotic: e.target.value})}
                                               />
                                            )}
                                            <input 
                                              className="w-full text-[10px] font-bold uppercase tracking-tight bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
                                              placeholder={`Dose for ${drug.id === 'others' ? (formData.otherAntibiotic || 'Other Drug') : drug.name}`}
                                              value={formData.drugDoses?.[drug.name] || ''}
                                              onChange={e => setFormData({
                                                ...formData, 
                                                drugDoses: { ...formData.drugDoses, [drug.name]: e.target.value }
                                              })}
                                            />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                             </div>
                          )}
                       </div>
                       
                       {/* Antibiotic Recommendation Alert Section */}
                       <AnimatePresence>
                         {recommendation && (
                           <motion.div
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: 10 }}
                             className="p-6 bg-slate-900 text-slate-50 rounded-3xl border border-slate-700 shadow-xl overflow-hidden relative group"
                           >
                              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                 <AlertTriangle className="w-16 h-16" />
                              </div>
                              <div className="relative z-10">
                                 <div className="flex items-center gap-2 mb-4 text-teal-400">
                                    <ShieldAlert className="w-5 h-5" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Stewardship Intelligence</span>
                                 </div>
                                 <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed text-slate-300">
                                    {recommendation}
                                 </div>
                              </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Global Dosing Regimen / Remarks <span className="text-rose-500">*</span></label>
                          <textarea 
                            required
                            className="text-input h-24" 
                            placeholder="Additional dosing notes or instructions..."
                            value={formData.dosingRegimen}
                            onChange={e => setFormData({...formData, dosingRegimen: e.target.value, dose: e.target.value})}
                          />
                       </div>
                    </div>

                    {/* Clinical Context */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Clinical Context</h4>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Indication <span className="text-rose-500">*</span></label>
                          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                             {['Prophylactic', 'Empiric', 'Definitive'].map(ind => (
                               <button
                                 key={ind}
                                 type="button"
                                 onClick={() => setFormData({...formData, indicationForUse: ind as any})}
                                 className={cn(
                                   "py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                   formData.indicationForUse === ind ? "bg-white text-brand-primary shadow-sm" : "text-slate-400 hover:text-slate-500"
                                 )}
                               >
                                 {ind}
                               </button>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Culture Type (select all that apply)</label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'Blood', 'Respiratory', 'Urine', 'CSF', 'Wound', 
                               'Tissue', 'Catheter tip', 'Stool', 'Body fluid'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.cultureSent?.includes(c)}
                                    onChange={e => {
                                      const current = formData.cultureSent || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, cultureSent: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase">{c}</span>
                               </label>
                             ))}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Date Sent</label>
                                <input type="date" className="text-input py-2" value={formData.cultureDateSent} onChange={e => setFormData({...formData, cultureDateSent: e.target.value})} />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Others (Specify)</label>
                                <input className="text-input py-2" value={formData.cultureOthers} onChange={e => setFormData({...formData, cultureOthers: e.target.value})} />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="col-span-full md:col-span-2 space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Focus of Infection</label>
                          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'HENT', 'Ocular', 'Skin/Soft tissue', 'Bones/Joints', 
                               'Respiratory', 'Cardiovascular', 'GI / Intra‑abdominal', 
                               'Genito‑urinary', 'CNS', 'Others'
                             ].map(f => (
                               <label key={f} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary"
                                    checked={formData.focusOfInfection?.includes(f)}
                                    onChange={e => {
                                      const current = formData.focusOfInfection || [];
                                      const updated = e.target.checked ? [...current, f] : current.filter(i => i !== f);
                                      setFormData({...formData, focusOfInfection: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{f}</span>
                               </label>
                             ))}
                          </div>
                          {formData.focusOfInfection?.includes('Others') && (
                             <input 
                               className="text-input mt-2"
                               placeholder="Specify other focus..."
                               value={formData.focusOther || ''}
                               onChange={e => setFormData({...formData, focusOther: e.target.value})}
                             />
                          )}
                          <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Infectious Diagnosis <span className="text-rose-500">*</span></label>
                          <input required className="text-input py-2" placeholder="Specific diagnosis..." value={formData.infectiousDiagnosis} onChange={e => setFormData({...formData, infectiousDiagnosis: e.target.value})} />
                        </div>
                     </div>
                  </div>

                    {/* Inclusion Criteria for Critically Ill */}
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Inclusion Criteria for Critically Ill</h4>
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Select if applicable</span>
                    </div>

                    <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sepsis Criteria (Any 2)</label>
                          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'HR >90/min',
                               'RR >20/min or pCO2 <32 mmHg',
                               'Temperature ≥38°C or ≤36°C',
                               'WBC >12,000 or <4,000 or >10% bands', 'Others'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.criticallyIll?.sepsisCriteria.includes(c)}
                                    onChange={e => {
                                      const current = formData.criticallyIll?.sepsisCriteria || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, sepsisCriteria: updated }});
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-600">{c}</span>
                               </label>
                             ))}
                          </div>
                           {formData.criticallyIll?.sepsisCriteria.includes('Others') && (
                              <input 
                                className='text-input mt-2' 
                                placeholder='Specify other sepsis criteria...' 
                                value={formData.criticallyIll?.sepsisOther || ''} 
                                onChange={e => setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, sepsisOther: e.target.value }})} 
                              />
                           )}
                       </div>
                       <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Organ Dysfunction (At least 1)</label>
                          <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'SBP <90 or dropped >40 mmHg',
                               'New onset jaundice',
                               'Platelet <100,000/uL or INR >1.5',
                               'Upper or Lower GI bleeding',
                               'Respiratory failure / saO2 <90%',
                               'Urine Output <0.5 mL/kg/hr', 'Others'
                             ].map(c => (
                               <label key={c} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-300 text-brand-primary"
                                    checked={formData.criticallyIll?.organDysfunctionCriteria.includes(c)}
                                    onChange={e => {
                                      const current = formData.criticallyIll?.organDysfunctionCriteria || [];
                                      const updated = e.target.checked ? [...current, c] : current.filter(i => i !== c);
                                      setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, organDysfunctionCriteria: updated }});
                                    }}
                                  />
                                  <span className="text-xs font-semibold text-slate-600">{c}</span>
                               </label>
                             ))}
                          </div>
                           {formData.criticallyIll?.organDysfunctionCriteria.includes('Others') && (
                              <input 
                                className='text-input mt-2' 
                                placeholder='Specify other organ dysfunction...' 
                                value={formData.criticallyIll?.organOther || ''} 
                                onChange={e => setFormData({...formData, criticallyIll: { ...formData.criticallyIll!, organOther: e.target.value }})} 
                              />
                           )}
                       </div>
                    </div>

                    {/* Microbiological Results (Only for Definitive indication) */}
                    <AnimatePresence>
                      {formData.indicationForUse === 'Definitive' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="col-span-full overflow-hidden"
                        >
                          <div className="border-b border-slate-100 pb-4 mt-8 mb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Microbiological Results (Definitive)</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/10">
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Result Date</label>
                               <input 
                                 type="date"
                                 className="text-input border-brand-primary/20"
                                 value={formData.microbiology?.date || ''}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, date: e.target.value }})}
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Specimen</label>
                               <input 
                                 className="text-input border-brand-primary/20"
                                 placeholder="e.g. Blood, Urine, CSF"
                                 value={formData.microbiology?.specimen || ''}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, specimen: e.target.value }})}
                               />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Organism</label>
                               <select 
                                 className="text-input border-brand-primary/20"
                                 value={formData.microbiology?.organism || ''}
                                 onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, organism: e.target.value }})}
                               >
                                 <option value="">Select Organism...</option>
                                 {[
                                   'Acinetobacter baumannii', 'Candida (specify species)', 'Clostridium difficile',
                                   'Enterococcus faecium/faecalis', 'Escherichia coli', 'Enterobacteriaceae (other)',
                                   'Haemophilus influenzae', 'Klebsiella pneumoniae', 'Neisseria gonorrhoeae',
                                   'Pseudomonas aeruginosa', 'Salmonella (non‑typhoidal)', 'Salmonella typhi',
                                   'Shigella spp.', 'Staphylococcus aureus', 'Streptococcus pneumoniae', 'Others (specify)'
                                 ].map(o => <option key={o} value={o}>{o}</option>)}
                               </select>
                               {(formData.microbiology?.organism === 'Others (specify)' || formData.microbiology?.organism?.includes('(specify)')) && (
                                  <input 
                                    className="text-input mt-2 py-2 border-brand-primary/20"
                                    placeholder="Specify organism..."
                                    value={formData.microbiology?.otherOrganism || ''}
                                    onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, otherOrganism: e.target.value }})}
                                  />
                               )}
                            </div>
                            <div className="col-span-full space-y-1.5">
                               <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Resistance Pattern / Result <span className="text-rose-500">*</span></label>
                               <div className="flex flex-wrap gap-2">
                                  {[
                                    'MDR', 'XDR', 'PDR', 'ESBL', 'CRE', 
                                    'Ampicillin‑resistant', 'Ceftriaxone‑resistant', 'Penicillin‑resistant', 
                                    'Fluconazole‑resistant', 'Methicillin‑resistant (MRSA)', 'Vancomycin‑resistant (VRE)'
                                  ].map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setFormData({...formData, microbiology: { ...formData.microbiology!, resistancePattern: p }})}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                                        formData.microbiology?.resistancePattern === p ? "bg-brand-primary text-white shadow-sm" : "bg-white text-slate-400 border border-slate-200 hover:border-brand-primary/30"
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                  <input 
                                    placeholder="Others..."
                                    className="text-[9px] font-bold uppercase tracking-widest bg-white border border-slate-200 rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-brand-primary w-32"
                                    value={formData.microbiology?.otherResistance || ''}
                                    onChange={e => setFormData({...formData, microbiology: { ...formData.microbiology!, otherResistance: e.target.value }})}
                                  />
                               </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Status & Justification</h4>
                    </div>

                    <div className="col-span-full space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Immunocompromising Conditions</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl">
                             {[
                               'Malignancy', 'Chronic liver disease', 'Connective tissue disease', 
                               'Chronic pulmonary disease', 'Immunocompromised state', 
                               'Chronic kidney disease', 'Chronic steroid use', 
                               'Diabetes mellitus (poorly controlled)', 'Others'
                             ].map(cond => (
                               <label key={cond} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-primary"
                                    checked={formData.immunocompromisingCondition?.includes(cond)}
                                    onChange={e => {
                                      const current = formData.immunocompromisingCondition || [];
                                      const updated = e.target.checked ? [...current, cond] : current.filter(i => i !== cond);
                                      setFormData({...formData, immunocompromisingCondition: updated});
                                    }}
                                  />
                                  <span className="text-[10px] font-bold text-slate-600">{cond}</span>
                               </label>
                             ))}
                          </div>
                          {formData.immunocompromisingCondition?.includes('Others') && (
                             <input 
                               className="text-input mt-3"
                               placeholder="Specify other conditions..."
                               value={formData.immunocompromisingOthers || ''}
                               onChange={e => setFormData({...formData, immunocompromisingOthers: e.target.value})}
                             />
                          )}
                       </div>
                    </div>

                    <div className="col-span-full space-y-4">
                       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Clinical Justification <span className="text-rose-500">*</span></label>
                       <textarea 
                         required
                         className="text-input h-32" 
                         placeholder="Document suspected pathogen, culture results, and failure of first-line therapies..."
                         value={formData.justification}
                         onChange={e => setFormData({...formData, justification: e.target.value, diagnosis: e.target.value})}
                       />
                    </div>
                    <div className="col-span-full border-b border-slate-100 pb-4 mt-8 mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand-primary">Requesting Physician Info</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Requesting Physician Name <span className="text-rose-500">*</span></label>
                          <input 
                            required
                            className="text-input" 
                            placeholder="e.g. Dr. Charlie Mignonette Bala"
                            value={formData.requestingPhysician}
                            onChange={e => setFormData({...formData, requestingPhysician: e.target.value})}
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number <span className="text-rose-500">*</span></label>
                          <input 
                            required
                            className="text-input" 
                            placeholder="Mobile or Local Number"
                            value={formData.prescriberContact}
                            onChange={e => setFormData({...formData, prescriberContact: e.target.value})}
                          />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                   <div className="hidden sm:flex flex-col gap-0.5 text-left w-full">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged by</p>
                      <p className="text-xs font-bold text-slate-700">{user?.email}</p>
                   </div>
                   <div className="flex gap-4 w-full sm:w-auto">
                    <button 
                      type="button"
                      onClick={() => { setIsAdding(false); setEditingId(null); resetForm(); }}
                      className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors border border-slate-200 sm:border-none rounded-2xl sm:rounded-none"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] sm:flex-none btn-primary px-10 py-4 shadow-xl shadow-teal-900/10 font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-transform"
                    >
                      {editingId ? 'Update Antimicrobial Order' : 'Process Antimicrobial Order'}
                    </button>
                   </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AMSDashboard({ stats }: { stats: any }) {
  return (
    <div className="p-4 space-y-8 h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Common Indication', value: stats.commonIndication, sub: 'Top Driver', icon: Fingerprint, color: 'text-indigo-500' },
          { label: 'Primary Infection Focus', value: stats.commonFocus, sub: 'Clinical Target', icon: Target, color: 'text-rose-500' },
          { label: 'Top Restricted Drug', value: stats.commonAntibiotic, sub: 'Most Prescribed', icon: FlaskConical, color: 'text-amber-500' },
          { label: 'Top Unit', value: stats.wardWithMostRequests, sub: 'By Volume', icon: SteppedAreaChartIcon, color: 'text-teal-500' },
          { label: 'Top Dept', value: stats.deptWithMostRequests, sub: 'By Volume', icon: LayoutDashboard, color: 'text-blue-500' },
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className={cn("p-2 rounded-xl bg-white shadow-sm", item.color)}>
              {item.icon ? <item.icon className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-sm font-black text-slate-800 truncate max-w-[120px]">{item.value}</p>
              <p className="text-[9px] font-bold text-slate-500 italic uppercase opacity-60">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request Distribution by Ward</h4>
            <FileText className="w-4 h-4 text-slate-300" />
          </div>
          <div className="space-y-3">
            {stats.wardRequests.slice(0, 8).map((ward: any) => {
              const total = stats.wardRequests.reduce((acc: number, curr: any) => acc + curr.count, 0);
              const percent = total > 0 ? Math.round((ward.count / total) * 100) : 0;
              return (
                <div key={ward.name}>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-600">{ward.name}</span>
                    <span className="text-slate-900">{ward.count} ({percent}%)</span>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
            {stats.wardRequests.length === 0 && <p className="text-[10px] text-slate-400 italic">No request data found.</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infectious Indication Analysis</h4>
              <AlertTriangle className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-3">
               <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100">
                  {Object.entries(stats.indications).map(([name, count], idx) => {
                    const colors = ['bg-teal-500', 'bg-rose-500', 'bg-indigo-500'];
                    const total = Object.values(stats.indications).reduce((a: any, b: any) => a + b, 0) as number;
                    const width = total > 0 ? ((count as number) / total) * 100 : 0;
                    if (width === 0) return null;
                    return (
                      <div key={name} className={cn("h-full transition-all duration-500", colors[idx % colors.length])} style={{ width: `${width}%` }} />
                    );
                  })}
               </div>
               <div className="flex flex-wrap gap-4">
                  {Object.entries(stats.indications).map(([name, count], idx) => {
                    const colors = ['text-teal-500', 'text-rose-500', 'text-indigo-500'];
                    const total = Object.values(stats.indications).reduce((a: any, b: any) => a + b, 0) as number;
                    const percent = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                    return (
                      <div key={name} className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", colors[idx % colors.length].replace('text', 'bg'))} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{name} ({percent}%)</span>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Focus Analysis</h4>
             <div className="flex flex-wrap gap-2">
                {Object.entries(stats.focusOfInfection).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([focus, count]: [string, any]) => (
                  <span key={focus} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-bold">
                    {focus}: {count}
                  </span>
                ))}
                {Object.keys(stats.focusOfInfection).length === 0 && <p className="text-[9px] text-slate-400 italic">No focus data recorded.</p>}
             </div>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-2xl text-white">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-teal-400" />
              <h5 className="text-[10px] font-bold uppercase tracking-widest">Rapid Response Protocol</h5>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Restricted antimicrobials require mandatory review within 72h. Document clinical justification for all manual overrides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple icons fallback
function LayoutDashboard(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>; }
function SteppedAreaChartIcon(props: any) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15h4v3H7z"/><path d="M13 9h4v9h-4z"/></svg>; }
