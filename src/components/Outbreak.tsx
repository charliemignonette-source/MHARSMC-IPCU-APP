import React, { useState, useEffect } from "react";
import {
  AlertOctagon,
  Calendar,
  Clock,
  MapPin,
  UserPlus,
  Plus,
  Trash2,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Microscope,
  Send,
  Save,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  ChevronRight,
  Download,
  Users,
  FileText,
  BarChart3,
} from "lucide-react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  UserProfile,
  OutbreakReport,
  OutbreakCase,
  OutbreakStatus,
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { UNITS } from "../constants";

const REPORTING_SOURCES = [
  "Unit Staff",
  "Laboratory",
  "Physician",
  "IPCU",
  "Other",
];

const OUTBREAK_TYPES = [
  "HAI Cluster",
  "Gastroenteritis",
  "Respiratory Cluster",
  "Febrile Cluster",
  "MDRO Cluster",
  "Foodborne",
  "Environmental",
  "Other",
];

const TRIGGER_CRITERIA = [
  "Two or more similar cases in the unit",
  "Increase above expected baseline",
  "Unusual clinical presentation",
  "Unexpected severity or death",
  "Staff illness cluster",
  "Environmental concern (water, equipment, room)",
  "Procedure-linked concern",
  "Other",
];

const UNIT_CHANGES = [
  "New staff / floating staff",
  "High census / overcrowding",
  "Equipment shortage",
  "Water supply issues",
  "Air-conditioning/HVAC issues",
  "Renovation / construction nearby",
  "New supplies or products introduced",
  "None noted",
];

const SHARED_EQUIPMENT = [
  "Thermometer",
  "Glucometer",
  "Ultrasound probe",
  "Stethoscope",
  "Suction machine",
  "Incubator/warmer",
  "Other",
];

const ATTACHMENTS = [
  "Lab results",
  "Medication/IV fluid list",
  "Device list",
  "Staffing schedule",
  "Cleaning logs",
  "Photos (if allowed)",
  "Other",
];

const TRANSMISSION_MODES = [
  "Contact",
  "Droplet",
  "Airborne",
  "Common Source",
  "Unknown",
  "Other",
];

const CONTROL_MEASURES = [
  "Informed charge nurse",
  "Informed Infection Prevention & Control",
  "Isolated/cohort affected patients",
  "Ensured dedicated equipment",
  "Hand Hygiene Reinforcement",
  "PPE Reinforcement",
  "Enhanced Cleaning",
  "Terminal Cleaning",
  "Device Audit",
  "Environmental Correction",
  "Staff Education",
  "Flagged charts for monitoring",
  "Other",
];

const STATUS_COLORS: Record<OutbreakStatus, string> = {
  Suspected: "bg-amber-100 text-amber-700",
  "Under Investigation": "bg-blue-100 text-blue-700",
  Confirmed: "bg-rose-100 text-rose-700",
  Controlled: "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-700",
};

export default function Outbreak({ user }: { user: UserProfile | null }) {
  const [view, setView] = useState<"LIST" | "FORM">("LIST");
  const [reports, setReports] = useState<OutbreakReport[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeReport, setActiveReport] = useState<OutbreakReport | null>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number | null>(
    null,
  );

  const [formData, setFormData] = useState<Partial<OutbreakReport>>({
    detectedAt: format(new Date(), "yyyy-MM-dd"),
    detectedTime: format(new Date(), "HH:mm"),
    reportingSrc: [],
    type: [],
    triggerCriteria: [],
    lineList: [],
    unitLevelInfo: {
      recentChanges: [],
      sharedEquipment: [],
    },
    staffingPatterns: {},
    initialObservations: {},
    personnelNotified: {},
    attachments: [],
    epidemiology: {
      indexCase: "",
      totalCases: 0,
      attackRate: "",
      unitsAffected: "",
      possibleSource: "",
      transmissionMode: [],
    },
    findings: {
      envSwabbing: {
        status: "Not Indicated",
        results: "",
        organism: "",
        collectionDate: "",
      },
      waterTesting: {
        status: "Not Indicated",
        results: "",
        organism: "",
        collectionDate: "",
      },
      labAlerts: { organism: "", resistancePattern: "" },
    },
    controlMeasures: {
      actions: [],
      dateImplemented: format(new Date(), "yyyy-MM-dd"),
      responsibleUnit: "",
    },
    status: "Suspected",
    investigationTeam: [],
    conclusion: "",
    recommendations: "",
  });

  useEffect(() => {
    if (!user) return;
    const baseQuery = collection(db, "outbreaks");
    let q;
    const isIPCU = user.role === "ADMIN" || user.role === "IPCN";
    if (isIPCU) {
      q = query(baseQuery, orderBy("createdAt", "desc"));
    } else {
      q = query(baseQuery, where("reporterId", "==", user.uid));
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as OutbreakReport,
        );
        const sortedData = data.sort((a, b) => {
          const timeA = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setReports(sortedData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "outbreaks");
      },
    );
    return unsub;
  }, [user]);

  const handleAddCase = () => {
    const newCase: OutbreakCase = {
      patientName: "",
      hospNo: "",
      ageService: "",
      unit: UNITS[0],
      roomBed: "",
      onSetDate: format(new Date(), "yyyy-MM-dd"),
      symptoms: "",
      labResults: "",
      devices: "",
      fluids: "",
      nurseAssignment: "",
      outcome: "Ongoing",
    };
    setFormData({
      ...formData,
      lineList: [...(formData.lineList || []), newCase],
    });
  };

  const handleRemoveCase = (index: number) => {
    const newList = [...(formData.lineList || [])];
    newList.splice(index, 1);
    setFormData({ ...formData, lineList: newList });
  };

  const handleCaseUpdate = (
    index: number,
    field: keyof OutbreakCase,
    value: string,
  ) => {
    const newList = [...(formData.lineList || [])];
    newList[index] = { ...newList[index], [field]: value };
    setFormData({ ...formData, lineList: newList });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const deepStripUndefined = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(deepStripUndefined);
      if (obj !== null && typeof obj === "object") {
        const newObj: any = {};
        for (const key in obj) {
          if (obj[key] !== undefined) {
            newObj[key] = deepStripUndefined(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    };

    try {
      const { id, ...rawCleanData } = formData;
      const cleanData = deepStripUndefined(rawCleanData);

      if (activeReport?.id) {
        // Update existing
        await updateDoc(doc(db, "outbreaks", activeReport.id), {
          ...cleanData,
          updatedAt: serverTimestamp(),
        });
      } else {
        // New report
        await addDoc(collection(db, "outbreaks"), {
          ...cleanData,
          reportedBy: user.name || "Unknown",
          reporterId: user.uid,
          reporterEmail: user.email || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setView("LIST");
      resetForm();
    } catch (error) {
      console.error("Submit error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert("Failed to save report: " + errorMessage);
      handleFirestoreError(
        error,
        activeReport?.id ? OperationType.UPDATE : OperationType.CREATE,
        "outbreaks",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setActiveReport(null);
    setFormData({
      detectedAt: format(new Date(), "yyyy-MM-dd"),
      detectedTime: format(new Date(), "HH:mm"),
      reportingSrc: [],
      type: [],
      triggerCriteria: [],
      lineList: [],
      unitLevelInfo: {
        recentChanges: [],
        sharedEquipment: [],
      },
      staffingPatterns: {},
      initialObservations: {},
      personnelNotified: {},
      attachments: [],
      epidemiology: {
        indexCase: "",
        totalCases: 0,
        attackRate: "",
        unitsAffected: "",
        possibleSource: "",
        transmissionMode: [],
      },
      findings: {
        envSwabbing: {
          status: "Not Indicated",
          results: "",
          organism: "",
          collectionDate: "",
        },
        waterTesting: {
          status: "Not Indicated",
          results: "",
          organism: "",
          collectionDate: "",
        },
        labAlerts: { organism: "", resistancePattern: "" },
      },
      controlMeasures: {
        actions: [],
        dateImplemented: format(new Date(), "yyyy-MM-dd"),
        responsibleUnit: "",
      },
      status: "Suspected",
      investigationTeam: [],
      conclusion: "",
      recommendations: "",
    });
  };

  const generateReport = (report: OutbreakReport) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header - MHARSMC Branding
    doc.setFillColor(15, 118, 110); // Brand Teal
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Mayor Hilarion A. Ramiro Sr. Medical Center", pageWidth / 2, 15, {
      align: "center",
    });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Infection Prevention and Control Unit (IPCU)",
      pageWidth / 2,
      22,
      { align: "center" },
    );
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL OUTBREAK INVESTIGATION REPORT", pageWidth / 2, 32, {
      align: "center",
    });

    // Administrative Data
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Report ID: ${report.id || "Draft"}`, 15, 50);
    doc.text(`Status: ${report.status}`, pageWidth - 15, 50, {
      align: "right",
    });
    doc.text(`Investigation Date: ${report.detectedAt}`, 15, 55);
    doc.text(`Reporter: ${report.reportedBy}`, pageWidth - 15, 55, {
      align: "right",
    });

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 60, pageWidth - 15, 60);

    // Section 1: Epidemiology Analytics
    doc.setFontSize(12);
    doc.setTextColor(15, 118, 110);
    doc.text("1. EPIDEMIOLOGICAL SUMMARY & ANALYTICS", 15, 70);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const epiData = [
      ["Outbreak Type", (report.type || []).join(", ")],
      ["Attack Rate", `${report.epidemiology?.attackRate || "0"}%`],
      ["Total Cases", report.epidemiology?.totalCases?.toString() || "0"],
      [
        "Population at Risk",
        report.epidemiology?.populationAtRisk?.toString() || "N/A",
      ],
      ["Index Case", report.epidemiology?.indexCase || "Unknown"],
      ["Affected Units", report.epidemiology?.unitsAffected || "N/A"],
      [
        "Possible Source",
        report.epidemiology?.possibleSource || "Under Investigation",
      ],
      [
        "Transmission Mode",
        (report.epidemiology?.transmissionMode || []).join(", "),
      ],
    ];

    autoTable(doc, {
      startY: 75,
      head: [["Metric", "Value"]],
      body: epiData,
      theme: "striped",
      headStyles: { fillColor: [51, 65, 85] },
    });

    // Section 2: Case Line List
    doc.setFontSize(12);
    doc.setTextColor(15, 118, 110);
    const lineListY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("2. CASE LINE LISTING", 15, lineListY);

    const cases = (report.lineList || []).map((c) => [
      c.patientName,
      c.hospNo,
      c.unit,
      c.onSetDate,
      c.symptoms,
      c.outcome,
    ]);

    autoTable(doc, {
      startY: lineListY + 5,
      head: [
        ["Patient Name", "Hosp No", "Unit", "Onset", "Symptoms", "Outcome"],
      ],
      body:
        cases.length > 0 ? cases : [["No cases recorded", "", "", "", "", ""]],
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    });

    // Section 2.5: Detailed Case Findings
    const detailedCases = (report.lineList || []).filter(
      (c) =>
        c.detailsOfOnset ||
        c.pathologyDetails ||
        c.exposureClassification ||
        c.labResults ||
        c.devices ||
        c.fluids ||
        c.nurseAssignment ||
        c.ageService ||
        c.wardUnitBed,
    );
    if (detailedCases.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setTextColor(15, 118, 110);
      doc.text("2.5 DETAILED CASE INVESTIGATION SUMMARIES", 15, 20);

      let currentY = 30;
      detailedCases.forEach((c, i) => {
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Case ${i + 1}: ${c.patientName} (${c.hospNo})`, 15, currentY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const summaries = [
          `• Adm Details: DOB: ${c.dob || "N/A"}, Age/Service: ${c.ageService || "N/A"}, Adm Date: ${c.admissionDate || "N/A"}, Ward/Unit/Bed: ${c.wardUnitBed || "N/A"}`,
          `• Devices: ${c.devices || "N/A"}, Fluids: ${c.fluids || "N/A"}, Nurse: ${c.nurseAssignment || "N/A"}`,
          `• Onset/Isolation: Onset: ${c.detailsOfOnset?.onsetDateTime || "N/A"}, Isolation: ${c.detailsOfOnset?.isolationDateTime || "N/A"}`,
          `• Lab Results: ${c.labResults || "N/A"}`,
          `• Pathology: Specimen Date: ${c.pathologyDetails?.dateOfPositiveSpecimen || "N/A"}, Lab #: ${c.pathologyDetails?.labNumber || "N/A"}, Organism: ${c.pathologyDetails?.organismsIsolated || "N/A"}`,
          `• Exposure: facility: ${c.exposureClassification?.healthcareAssociatedFacility || "N/A"}, community: ${c.exposureClassification?.healthcareAssociatedCommunity || "N/A"}`,
        ];

        summaries.forEach((line, lineIdx) => {
          doc.text(line, 20, currentY + 5 + lineIdx * 4);
        });

        currentY += 35;
      });
    }

    // Section 3: Findings & Controls
    let findingsY = 0;
    if (detailedCases.length > 0) {
      doc.addPage();
      findingsY = 20;
    } else {
      findingsY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (findingsY > 250) doc.addPage();

    doc.setFontSize(12);
    doc.setTextColor(15, 118, 110);
    doc.text(
      "3. INVESTIGATION FINDINGS & CONTROL MEASURES",
      15,
      findingsY > 250 ? 20 : findingsY,
    );

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const startY = findingsY > 250 ? 30 : findingsY + 10;
    doc.text("Laboratory & Environmental Data:", 15, startY);
    doc.setFont("helvetica", "normal");
    doc.text(
      `- Alert Organism: ${report.findings?.labAlerts.organism || "N/A"}`,
      20,
      startY + 5,
    );
    doc.text(
      `- Resistance: ${report.findings?.labAlerts.resistancePattern || "N/A"}`,
      20,
      startY + 10,
    );
    let currentYVal = startY + 15;
    doc.text(
      `- Env. Swabbing: ${report.findings?.envSwabbing.status}`,
      20,
      currentYVal,
    );
    currentYVal += 5;
    if (
      report.findings?.envSwabbing.status &&
      report.findings.envSwabbing.status !== "Not Indicated"
    ) {
      doc.text(
        `  Results: ${report.findings.envSwabbing.results || "N/A"}, Organism: ${report.findings.envSwabbing.organism || "N/A"}, Date: ${report.findings.envSwabbing.collectionDate || "N/A"}`,
        25,
        currentYVal,
      );
      currentYVal += 5;
    }

    doc.text(
      `- Water Testing: ${report.findings?.waterTesting.status}`,
      20,
      currentYVal,
    );
    currentYVal += 5;
    if (
      report.findings?.waterTesting.status &&
      report.findings.waterTesting.status !== "Not Indicated"
    ) {
      doc.text(
        `  Results: ${report.findings.waterTesting.results || "N/A"}, Organism: ${report.findings.waterTesting.organism || "N/A"}, Date: ${report.findings.waterTesting.collectionDate || "N/A"}`,
        25,
        currentYVal,
      );
      currentYVal += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Implementation Status:", 15, currentYVal + 10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `- Date Implemented: ${report.controlMeasures?.dateImplemented}`,
      20,
      currentYVal + 15,
    );
    doc.text(
      `- Responsible Unit: ${report.controlMeasures?.responsibleUnit}`,
      20,
      currentYVal + 20,
    );
    doc.text(
      `- Actions: ${(report.controlMeasures?.actions || []).join(", ")}`,
      20,
      currentYVal + 25,
      { maxWidth: 170 },
    );

    // Section 4: Team, Conclusion & Recommendations
    const finalY = currentYVal + 40;
    if (finalY > 230) doc.addPage();
    const currY = finalY > 230 ? 20 : finalY;

    doc.setFontSize(12);
    doc.setTextColor(15, 118, 110);
    doc.text("4. CONCLUSION & RECOMMENDATIONS", 15, currY);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Conclusion:", 15, currY + 10);
    doc.setFont("helvetica", "normal");
    doc.text(report.conclusion || "No conclusion documented.", 15, currY + 15, {
      maxWidth: 180,
    });

    doc.setFont("helvetica", "bold");
    doc.text("Recommendations:", 15, currY + 35);
    doc.setFont("helvetica", "normal");
    doc.text(
      report.recommendations || "No recommendations documented.",
      15,
      currY + 40,
      { maxWidth: 180 },
    );

    doc.setFont("helvetica", "bold");
    doc.text("Investigation Team:", 15, currY + 65);
    doc.setFont("helvetica", "normal");
    doc.text(
      (report.investigationTeam || []).join("; ") || "N/A",
      15,
      currY + 70,
      { maxWidth: 180 },
    );

    // Section 5: Validation
    if (report.validation) {
       doc.addPage();
       doc.setFontSize(12);
       doc.setTextColor(15, 118, 110);
       doc.setFont("helvetica", "bold");
       doc.text("5. VALIDATION & SIGN-OFF", 15, 20);

       doc.setTextColor(0, 0, 0);
       doc.setFontSize(10);
       let currentY = 35;
       doc.text(`Decision: ${report.validation.decision}`, 15, currentY);
       currentY += 10;
       
       if (report.dateClosed) {
         doc.setFont("helvetica", "bold");
         doc.text(`Closure Date:`, 15, currentY);
         doc.setFont("helvetica", "normal");
         doc.text(`${format(new Date(report.dateClosed), "PPP")}`, 45, currentY);
         currentY += 10;
       }

       doc.setFont("helvetica", "bold");
       doc.text("Basis:", 15, currentY);
       currentY += 5;
       doc.setFont("helvetica", "normal");
       const basisText = report.validation.basis?.join(", ") || "N/A";
       const basisLines = doc.splitTextToSize(basisText, 180);
       doc.text(basisLines, 15, currentY);
       currentY += basisLines.length * 5 + 5;
       
       doc.setFont("helvetica", "bold");
       doc.text("Narrative/Notes:", 15, currentY);
       currentY += 6;
       doc.setFont("helvetica", "normal");
       const notesText = report.validation.notes || "No notes provided.";
       const paragraphs = notesText.split(/\r?\n/);
       paragraphs.forEach((p) => {
         if (p.trim() === "") {
           currentY += 5;
           return;
         }
         // Clean non-breaking spaces that can break jsPDF word wrapping
         const cleanP = p.replace(/\t/g, "    ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[\u00A0]/g, " ");
         const lines = doc.splitTextToSize(cleanP, 180);
         doc.text(lines, 15, currentY);
         currentY += lines.length * 5;
       });
       currentY += 7;

       doc.setFont("helvetica", "bold");
       doc.text("Validated By:", 15, currentY);
       currentY += 5;
       doc.setFont("helvetica", "normal");
       doc.text(report.validation.validatorName || "N/A", 15, currentY);
       currentY += 5;
       
       if (report.validation.validatedAt) {
          const vDate = report.validation.validatedAt.toDate ? report.validation.validatedAt.toDate() : new Date(report.validation.validatedAt);
          doc.text(`Date Validated: ${format(vDate, "PPP")}`, 15, currentY);
       }
    }

    // Save
    doc.save(`MHARSMC_Outbreak_Report_${report.detectedAt}.pdf`);
  };

  const handleDelete = async (
    id: string,
    reporterId?: string,
    status?: string,
  ) => {
    if (!user) {
      alert("Please log in to perform this action.");
      return;
    }
    const isOwner = user.uid === reporterId && status === "Suspected";
    if (user.role !== "ADMIN" && user.role !== "IPCN" && !isOwner) {
      alert(
        "Insufficient permissions: Only IPCN/Admin or the original reporter (if still Suspected) can delete reports.",
      );
      return;
    }

    // Sample/Demo Item Detection
    const isSample = id.startsWith("SAMPLE_") || id.includes("demo");
    if (isSample) {
      alert("This is sample data and cannot be deleted.");
      return;
    }

    try {
      await deleteDoc(doc(db, "outbreaks", id));
      alert("Log deleted.");
    } catch (err) {
      console.error("Delete error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Delete failed: " + errorMessage);
      handleFirestoreError(err, OperationType.DELETE, `outbreaks/${id}`);
    }
  };

  const toggleArrayItem = (
    field: keyof OutbreakReport | string,
    item: string,
    path?: string,
  ) => {
    if (path) {
      // Handle nested arrays like epidemiology.transmissionMode
      const [parent, child] = path.split(".");
      const current = (formData as any)[parent][child] as string[];
      const updated = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      setFormData({
        ...formData,
        [parent]: { ...(formData as any)[parent], [child]: updated },
      });
      return;
    }

    const current = (formData as any)[field] as string[];
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setFormData({ ...formData, [field]: updated });
  };

  const handleDetailedCaseUpdate = (
    idx: number,
    updates: Partial<OutbreakCase>,
  ) => {
    const newList = [...(formData.lineList || [])];
    newList[idx] = { ...newList[idx], ...updates };
    setFormData({ ...formData, lineList: newList });
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <div className="p-2 bg-brand-primary rounded-xl text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            Outbreak Management
          </h2>
          <p className="text-slate-500 text-[9px] sm:text-xs font-bold uppercase tracking-widest mt-1 ml-11">
            Surveillance, Detection & Investigation • MHARSMC
          </p>
        </div>
        <button
          onClick={() => {
            if (view === "LIST") setView("FORM");
            else {
              setView("LIST");
              resetForm();
            }
          }}
          className={cn(
            "w-full sm:w-auto px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2",
            view === "LIST"
              ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          )}
        >
          {view === "LIST" ? (
            <>
              <Plus className="w-4 h-4" /> New Report
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" /> Cancel
            </>
          )}
        </button>
      </div>
      {view === "LIST" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                placeholder="Search unit, type, or reporter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-xs font-bold w-full outline-none placeholder:text-slate-300"
              />
            </div>
            {(() => {
              const filtered = reports.filter((report) => {
                const s = searchTerm.toLowerCase();
                return (
                  (report.type || []).some((t) =>
                    t.toLowerCase().includes(s),
                  ) ||
                  report.epidemiology?.unitsAffected
                    ?.toLowerCase()
                    .includes(s) ||
                  report.reportedBy?.toLowerCase().includes(s) ||
                  report.status?.toLowerCase().includes(s)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <AlertOctagon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">
                      {searchTerm
                        ? `No results for "${searchTerm}"`
                        : "No active outbreaks reported"}
                    </p>
                  </div>
                );
              }

              return filtered.map((report) => (
                <motion.div
                  key={report.id}
                  layoutId={report.id}
                  className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-brand-primary/5 group-hover:text-brand-primary transition-colors">
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-slate-900 uppercase tracking-tight">
                            {(report.type || []).join(", ") ||
                              "Unspecified Type"}
                          </h3>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                              STATUS_COLORS[report.status],
                            )}
                          >
                            {report.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Detected: {report.detectedAt} •{" "}
                          {report.lineList?.length || 0} Cases
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(user?.role === "ADMIN" ||
                        user?.role === "IPCN" ||
                        (user?.uid === report.reporterId &&
                          report.status === "Suspected")) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(
                              report.id!,
                              report.reporterId,
                              report.status,
                            );
                          }}
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActiveReport(report);
                          setFormData(report);
                          setView("FORM");
                        }}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </button>
                      {user?.role !== "USER" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateReport(report);
                          }}
                          className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
                          title="Generate Final Report"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Attack Rate
                      </span>
                      <p className="text-xs font-bold text-slate-700">
                        {report.epidemiology?.attackRate || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1 sm:text-center sm:border-x border-slate-200 px-2 truncate">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Units
                      </span>
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {report.epidemiology?.unitsAffected || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1 sm:text-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Validation
                      </span>
                      <p className="text-[10px] font-black uppercase text-brand-primary">
                        {report.validation?.decision || "PENDING"}
                      </p>
                    </div>
                    {report.dateClosed && (
                      <div className="space-y-1 sm:text-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Closure Date
                        </span>
                        <p className="text-[10px] font-black uppercase text-slate-600">
                          {format(new Date(report.dateClosed), "MMM d, yyyy")}
                        </p>
                      </div>
                    )}
                    <div className="space-y-1 text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Reporter
                      </span>
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {report.reportedBy}
                      </p>
                    </div>
                  </div>

                  {report.validation?.notes && (
                    <div className="mt-4 p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FileText className="w-3 h-3 text-brand-primary" /> Validator Narrative Report
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {report.validation.notes}
                      </p>
                      {report.validation.validatorName && (
                         <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">
                           Verified By: {report.validation.validatorName}
                         </p>
                      )}
                    </div>
                  )}
                </motion.div>
              ));
            })()}
          </div>

          <div className="space-y-6">
            <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-brand-primary" />
                <h3 className="font-black uppercase tracking-widest text-xs">
                  Trigger Protocol
                </h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-brand-primary font-black uppercase tracking-widest mb-1">
                    Standard Definition
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed font-medium">
                    A cluster is defined as ≥2 epidemiologically linked cases
                    within a specific unit over 14 days.
                  </p>
                </div>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest text-center">
                  Contact IPCU Immediately for Lab Alerts
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-10"
          >
            {/* Header Summary */}
            <div className="p-8 bg-slate-900 rounded-[3rem] text-white shadow-xl shadow-slate-900/20 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white/10 rounded-[1.5rem]">
                    <FileText className="w-8 h-8 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight">
                      Investigation Profile
                    </h3>
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">
                      Mayor Hilarion A. Ramiro Sr. Medical Center
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeReport && user?.role !== "USER" && (
                    <button
                      type="button"
                      onClick={() =>
                        generateReport(activeReport as OutbreakReport)
                      }
                      className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <BarChart3 className="w-4 h-4" /> Download Analytics
                      Report
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date Detected
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-10 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                    value={formData.detectedAt}
                    onChange={(e) =>
                      setFormData({ ...formData, detectedAt: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Time Detected
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="time"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-10 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                    value={formData.detectedTime}
                    onChange={(e) =>
                      setFormData({ ...formData, detectedTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Current Status
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "Suspected",
                      "Under Investigation",
                      "Confirmed",
                      "Controlled",
                      "Closed",
                    ] as OutbreakStatus[]
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s })}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                        formData.status === s
                          ? "bg-slate-900 text-white border-transparent shadow-md"
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reporting & Identification */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Selection Groups */}
              <div className="space-y-8">
                <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                      Detection Source
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {REPORTING_SOURCES.map((src) => (
                      <div key={src} className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                            checked={formData.reportingSrc?.includes(src)}
                            onChange={() =>
                              toggleArrayItem("reportingSrc", src)
                            }
                          />
                          <span className="text-[11px] font-bold text-slate-700">
                            {src}
                          </span>
                        </label>
                        {src === "Other" &&
                          formData.reportingSrc?.includes("Other") && (
                            <input
                              placeholder="Specify source..."
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={formData.reportingSrcOther || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  reportingSrcOther: e.target.value,
                                })
                              }
                            />
                          )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                      Type of Outbreak
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {OUTBREAK_TYPES.map((t) => (
                      <div key={t} className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                            checked={formData.type?.includes(t)}
                            onChange={() => toggleArrayItem("type", t)}
                          />
                          <span className="text-[11px] font-bold text-slate-700">
                            {t}
                          </span>
                        </label>
                        {t === "Other" && formData.type?.includes("Other") && (
                          <input
                            placeholder="Specify type..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                            value={formData.typeOther || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                typeOther: e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trigger Criteria */}
              <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <AlertOctagon className="w-5 h-5 text-rose-500" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                    Trigger Criteria
                  </h3>
                </div>
                <div className="space-y-3">
                  {TRIGGER_CRITERIA.map((c) => (
                    <div key={c} className="space-y-2">
                      <label className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-brand-primary/30 transition-all group">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-slate-300 text-rose-500 focus:ring-rose-500/20"
                          checked={formData.triggerCriteria?.includes(c)}
                          onChange={() => toggleArrayItem("triggerCriteria", c)}
                        />
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 group-hover:text-slate-900">
                          {c}
                        </span>
                      </label>
                      {c === "Other" &&
                        formData.triggerCriteria?.includes("Other") && (
                          <input
                            placeholder="Specify trigger..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                            value={formData.triggerCriteriaOther || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                triggerCriteriaOther: e.target.value,
                              })
                            }
                          />
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Case Line List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">
                    Case Line List
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddCase}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Patient Name
                        </th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Hosp Number
                        </th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Unit
                        </th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Onset
                        </th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Symptoms
                        </th>
                        <th className="px-6 py-4 text-left text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Outcome
                        </th>
                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          Investigate
                        </th>
                        <th className="px-6 py-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.lineList || []).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-50 last:border-0 group"
                        >
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.patientName}
                              onChange={(e) =>
                                handleCaseUpdate(
                                  idx,
                                  "patientName",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.hospNo}
                              onChange={(e) =>
                                handleCaseUpdate(idx, "hospNo", e.target.value)
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.unit}
                              onChange={(e) =>
                                handleCaseUpdate(idx, "unit", e.target.value)
                              }
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.onSetDate}
                              onChange={(e) =>
                                handleCaseUpdate(
                                  idx,
                                  "onSetDate",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.symptoms}
                              onChange={(e) =>
                                handleCaseUpdate(
                                  idx,
                                  "symptoms",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="w-full bg-slate-50/50 rounded-xl px-3 py-2 text-[10px] font-black uppercase outline-none focus:bg-white focus:ring-1 focus:ring-brand-primary group-hover:bg-white"
                              value={row.outcome}
                              onChange={(e) =>
                                handleCaseUpdate(idx, "outcome", e.target.value)
                              }
                            >
                              <option>Ongoing</option>
                              <option>Recovered</option>
                              <option>Transferred</option>
                              <option>Expired</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCaseIndex(idx)}
                              className={cn(
                                "p-2 rounded-xl transition-all",
                                row.detailsOfOnset
                                  ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                              )}
                              title="Detailed Case Investigation"
                            >
                              <ClipboardList className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCase(idx)}
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rapid Assessment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Unit changes and Staffing */}
              <div className="space-y-8">
                <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                      Unit-Level Information
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Recent Changes
                    </p>
                    <div className="grid border border-slate-100 rounded-2xl p-4 gap-3 bg-slate-50">
                      {UNIT_CHANGES.map((change) => (
                        <label
                          key={change}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-brand-primary border-slate-300"
                            checked={formData.unitLevelInfo?.recentChanges?.includes(
                              change,
                            )}
                            onChange={() =>
                              toggleArrayItem(
                                "recentChanges",
                                change,
                                "unitLevelInfo.recentChanges",
                              )
                            }
                          />
                          <span className="text-[11px] font-bold text-slate-700">
                            {change}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                      Shared Equipment Used
                    </p>
                    <div className="grid grid-cols-2 border border-slate-100 rounded-2xl p-4 gap-3 bg-slate-50">
                      {SHARED_EQUIPMENT.map((eq) => (
                        <div key={eq}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-brand-primary border-slate-300"
                              checked={formData.unitLevelInfo?.sharedEquipment?.includes(
                                eq,
                              )}
                              onChange={() =>
                                toggleArrayItem(
                                  "sharedEquipment",
                                  eq,
                                  "unitLevelInfo.sharedEquipment",
                                )
                              }
                            />
                            <span className="text-[11px] font-bold text-slate-700">
                              {eq}
                            </span>
                          </label>
                          {eq === "Other" &&
                            formData.unitLevelInfo?.sharedEquipment?.includes(
                              "Other",
                            ) && (
                              <input
                                className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px]"
                                placeholder="Specify..."
                                value={
                                  formData.unitLevelInfo
                                    ?.sharedEquipmentOther || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    unitLevelInfo: {
                                      ...formData.unitLevelInfo!,
                                      sharedEquipmentOther: e.target.value,
                                    },
                                  })
                                }
                              />
                            )}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-4">
                      <div className="flex-1 min-w-[200px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                          Last Terminal Cleaning
                        </span>
                        <input
                          type="date"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                          value={
                            formData.unitLevelInfo?.lastTerminalCleaning || ""
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              unitLevelInfo: {
                                ...formData.unitLevelInfo!,
                                lastTerminalCleaning: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Missed Cleaning Logs?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                unitLevelInfo: {
                                  ...formData.unitLevelInfo!,
                                  missedCleaningLogs: "Yes",
                                },
                              })
                            }
                            className={cn(
                              "px-4 py-2 rounded-xl text-[10px] font-bold border",
                              formData.unitLevelInfo?.missedCleaningLogs ===
                                "Yes"
                                ? "bg-rose-50 text-rose-600 border-rose-200"
                                : "bg-white text-slate-500 border-slate-200",
                            )}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                unitLevelInfo: {
                                  ...formData.unitLevelInfo!,
                                  missedCleaningLogs: "No",
                                },
                              })
                            }
                            className={cn(
                              "px-4 py-2 rounded-xl text-[10px] font-bold border",
                              formData.unitLevelInfo?.missedCleaningLogs ===
                                "No"
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : "bg-white text-slate-500 border-slate-200",
                            )}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                      Staffing Patterns & Observations
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Nurses Assigned (Past 7 Days)
                      </label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 text-xs font-bold outline-none min-h-[60px]"
                        value={formData.staffingPatterns?.nursesAssigned || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            staffingPatterns: {
                              ...formData.staffingPatterns!,
                              nursesAssigned: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Any staff with symptoms/illness?
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              staffingPatterns: {
                                ...formData.staffingPatterns!,
                                staffWithSymptoms: "Yes",
                              },
                            })
                          }
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold border",
                            formData.staffingPatterns?.staffWithSymptoms ===
                              "Yes"
                              ? "bg-rose-50 text-rose-600 border-rose-200"
                              : "bg-white text-slate-500 border-slate-200",
                          )}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              staffingPatterns: {
                                ...formData.staffingPatterns!,
                                staffWithSymptoms: "No",
                              },
                            })
                          }
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold border",
                            formData.staffingPatterns?.staffWithSymptoms ===
                              "No"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-white text-slate-500 border-slate-200",
                          )}
                        >
                          No
                        </button>
                      </div>
                      {formData.staffingPatterns?.staffWithSymptoms ===
                        "Yes" && (
                        <input
                          placeholder="Describe symptoms..."
                          className="w-full mt-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs outline-none"
                          value={
                            formData.staffingPatterns
                              ?.staffSymptomsDescription || ""
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              staffingPatterns: {
                                ...formData.staffingPatterns!,
                                staffSymptomsDescription: e.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                      Attachments Included
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ATTACHMENTS.map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-brand-primary border-slate-300"
                          checked={formData.attachments?.includes(item)}
                          onChange={() => toggleArrayItem("attachments", item)}
                        />
                        <span className="text-[10px] font-bold text-slate-600">
                          {item}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Epidemiologic & Findings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                    Epidemiologic Summary
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Index Case
                      </label>
                      <span className="text-[8px] text-slate-400 font-medium leading-tight">
                        The first identified case in a group of related cases.
                      </span>
                    </div>
                    <input
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                      value={formData.epidemiology?.indexCase || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          epidemiology: {
                            ...formData.epidemiology!,
                            indexCase: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Total Cases
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                      value={formData.epidemiology?.totalCases || ""}
                      onChange={(e) => {
                        const total = parseInt(e.target.value) || 0;
                        const pop = formData.epidemiology?.populationAtRisk;
                        const ar = pop
                          ? ((total / pop) * 100).toFixed(2)
                          : formData.epidemiology?.attackRate || "";
                        setFormData({
                          ...formData,
                          epidemiology: {
                            ...formData.epidemiology!,
                            totalCases: total,
                            attackRate: ar,
                          },
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Population at Risk
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Denominator"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                      value={formData.epidemiology?.populationAtRisk || ""}
                      onChange={(e) => {
                        const pop = parseInt(e.target.value) || undefined;
                        const total = formData.epidemiology?.totalCases || 0;
                        const ar = pop
                          ? ((total / pop) * 100).toFixed(2)
                          : formData.epidemiology?.attackRate || "";
                        setFormData({
                          ...formData,
                          epidemiology: {
                            ...formData.epidemiology!,
                            populationAtRisk: pop,
                            attackRate: ar,
                          },
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Attack Rate (%)
                      </label>
                      <span className="text-[8px] text-slate-400 font-medium leading-tight">
                        Auto-computed if population provided
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                      value={formData.epidemiology?.attackRate || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          epidemiology: {
                            ...formData.epidemiology!,
                            attackRate: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Possible Source
                    </label>
                    <input
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                      value={formData.epidemiology?.possibleSource || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          epidemiology: {
                            ...formData.epidemiology!,
                            possibleSource: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Transmission Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRANSMISSION_MODES.map((m) => (
                      <div key={m} className="space-y-2">
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            toggleArrayItem(
                              "transmissionMode",
                              m,
                              "epidemiology.transmissionMode",
                            )
                          }
                          className={cn(
                            "w-full px-3 py-2.5 rounded-xl text-[10px] font-bold transition-all border",
                            formData.epidemiology?.transmissionMode.includes(m)
                              ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                              : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50",
                          )}
                        >
                          {m}
                        </button>
                        {m === "Other" &&
                          formData.epidemiology?.transmissionMode.includes(
                            "Other",
                          ) && (
                            <input
                              placeholder="Specify mode..."
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={
                                formData.epidemiology?.transmissionModeOther ||
                                ""
                              }
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  epidemiology: {
                                    ...formData.epidemiology!,
                                    transmissionModeOther: e.target.value,
                                  },
                                })
                              }
                            />
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center gap-3">
                  <Microscope className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                    Lab & Findings
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                            Env. Swabbing
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            Surface or zone swabbing performed
                          </p>
                        </div>
                        <select
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-brand-primary"
                          value={
                            formData.findings?.envSwabbing.status ||
                            "Not Indicated"
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              findings: {
                                ...formData.findings!,
                                envSwabbing: {
                                  ...formData.findings!.envSwabbing,
                                  status: e.target.value as any,
                                },
                              },
                            })
                          }
                        >
                          <option value="Done">Done</option>
                          <option value="Not Done">Not Done</option>
                          <option value="Pending">Pending</option>
                          <option value="Not Indicated">Not Indicated</option>
                        </select>
                      </div>
                      {formData.findings?.envSwabbing.status &&
                        formData.findings.envSwabbing.status !==
                          "Not Indicated" && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1.5 col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Results Description
                              </label>
                              <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.envSwabbing.results || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      envSwabbing: {
                                        ...formData.findings!.envSwabbing,
                                        results: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Target Organism
                              </label>
                              <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.envSwabbing.organism || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      envSwabbing: {
                                        ...formData.findings!.envSwabbing,
                                        organism: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Collection Date
                              </label>
                              <input
                                type="date"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.envSwabbing
                                    .collectionDate || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      envSwabbing: {
                                        ...formData.findings!.envSwabbing,
                                        collectionDate: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                            Water Testing
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            System testing performed
                          </p>
                        </div>
                        <select
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-brand-primary"
                          value={
                            formData.findings?.waterTesting.status ||
                            "Not Indicated"
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              findings: {
                                ...formData.findings!,
                                waterTesting: {
                                  ...formData.findings!.waterTesting,
                                  status: e.target.value as any,
                                },
                              },
                            })
                          }
                        >
                          <option value="Done">Done</option>
                          <option value="Not Done">Not Done</option>
                          <option value="Pending">Pending</option>
                          <option value="Not Indicated">Not Indicated</option>
                        </select>
                      </div>
                      {formData.findings?.waterTesting.status &&
                        formData.findings.waterTesting.status !==
                          "Not Indicated" && (
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1.5 col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Results Description
                              </label>
                              <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.waterTesting.results || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      waterTesting: {
                                        ...formData.findings!.waterTesting,
                                        results: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Target Organism
                              </label>
                              <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.waterTesting.organism || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      waterTesting: {
                                        ...formData.findings!.waterTesting,
                                        organism: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Collection Date
                              </label>
                              <input
                                type="date"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand-primary"
                                value={
                                  formData.findings?.waterTesting
                                    .collectionDate || ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    findings: {
                                      ...formData.findings!,
                                      waterTesting: {
                                        ...formData.findings!.waterTesting,
                                        collectionDate: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Alert Organism
                      </label>
                      <input
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                        value={formData.findings?.labAlerts.organism || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            findings: {
                              ...formData.findings!,
                              labAlerts: {
                                ...formData.findings!.labAlerts,
                                organism: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Resistance Pattern
                      </label>
                      <input
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                        value={
                          formData.findings?.labAlerts.resistancePattern || ""
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            findings: {
                              ...formData.findings!,
                              labAlerts: {
                                ...formData.findings!.labAlerts,
                                resistancePattern: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Control Measures */}
            <div className="p-8 bg-slate-100 rounded-[3rem] space-y-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                  Control Measures & Immediate Actions
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-wrap gap-2">
                  {CONTROL_MEASURES.map((m) => (
                    <div key={m} className="space-y-2">
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          toggleArrayItem(
                            "actions",
                            m,
                            "controlMeasures.actions",
                          )
                        }
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          formData.controlMeasures?.actions.includes(m)
                            ? "bg-white text-emerald-600 border-white shadow-md"
                            : "bg-slate-200/50 text-slate-500 border-transparent hover:bg-white/50",
                        )}
                      >
                        {m}
                      </button>
                      {m === "Other" &&
                        formData.controlMeasures?.actions.includes("Other") && (
                          <input
                            placeholder="Specify measure..."
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                            value={formData.controlMeasures?.actionsOther || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                controlMeasures: {
                                  ...formData.controlMeasures!,
                                  actionsOther: e.target.value,
                                },
                              })
                            }
                          />
                        )}
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Date Implemented
                    </label>
                    <input
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                      value={formData.controlMeasures?.dateImplemented || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          controlMeasures: {
                            ...formData.controlMeasures!,
                            dateImplemented: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Responsible Unit
                    </label>
                    <input
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                      value={formData.controlMeasures?.responsibleUnit || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          controlMeasures: {
                            ...formData.controlMeasures!,
                            responsibleUnit: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Investigation Team & Conclusion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                    Investigation Team
                  </h3>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Add name of team members (semicolon separated)
                  </p>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none min-h-[100px]"
                    placeholder="e.g. Dr. Jane Doe; Nurse John Smith; IPCU Team"
                    value={(formData.investigationTeam || []).join("; ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        investigationTeam: e.target.value
                          .split(";")
                          .map((n) => n.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className="p-8 bg-white rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-brand-primary" />
                  <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                    Final Conclusion
                  </h3>
                </div>
                <textarea
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none min-h-[100px]"
                  placeholder="State the final summary of the investigation..."
                  value={formData.conclusion || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, conclusion: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="p-8 bg-teal-50 rounded-[3rem] border border-teal-100 space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-primary" />
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">
                  Recommendations
                </h3>
              </div>
              <textarea
                className="w-full bg-white border border-teal-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none min-h-[150px] focus:ring-2 focus:ring-brand-primary/20"
                placeholder="Detailed recommendations for prevention and control..."
                value={formData.recommendations || ""}
                onChange={(e) =>
                  setFormData({ ...formData, recommendations: e.target.value })
                }
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-4 p-8 bg-white border-t border-slate-100 rounded-b-[3rem]">
              <button
                type="button"
                onClick={() => {
                  setView("LIST");
                  resetForm();
                }}
                className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-500 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Investigation Report
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </AnimatePresence>
      )}

      {/* Detailed Case Investigation Drawer */}
      <AnimatePresence>
        {selectedCaseIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCaseIndex(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-primary text-white rounded-2xl shadow-lg shadow-brand-primary/20">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Case Investigation Form
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Infection Prevention and Control Case Registry • MHARSMC
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCaseIndex(null)}
                  className="p-3 hover:bg-slate-200 rounded-2xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {(() => {
                  const caseData = formData.lineList![selectedCaseIndex];
                  return (
                    <>
                      {/* Section 1: Patient Identity */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black">
                            01
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                            Patient Details
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Patient Name
                            </label>
                            <input
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={caseData.patientName}
                              readOnly
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Date of Birth
                            </label>
                            <input
                              type="date"
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={caseData.dob || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  dob: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              UR (Hosp No)
                            </label>
                            <input
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={caseData.hospNo}
                              readOnly
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Ward / Unit / Bed
                            </label>
                            <input
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={caseData.wardUnitBed || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  wardUnitBed: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Admission Date
                            </label>
                            <input
                              type="date"
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={caseData.admissionDate || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  admissionDate: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Age / Service
                            </label>
                            <input
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={caseData.ageService || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  ageService: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Nurse Assignment
                            </label>
                            <input
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={caseData.nurseAssignment || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  nurseAssignment: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          <div className="space-y-1.5 col-span-2 md:col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Devices (CL, Vent, Cath, etc.)
                            </label>
                            <input
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={caseData.devices || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  devices: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5 col-span-2 md:col-span-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              IV Fluids / TPN
                            </label>
                            <input
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary/20"
                              value={caseData.fluids || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  fluids: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300"
                                checked={
                                  caseData.recentHospitalization
                                    ?.within3Months || false
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    recentHospitalization: {
                                      date: caseData.recentHospitalization
                                        ?.date,
                                      within3Months: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                Hospitalized within last 3 months?
                              </span>
                            </label>
                            {caseData.recentHospitalization?.within3Months && (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Date of admission
                                </label>
                                <input
                                  type="date"
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
                                  value={
                                    caseData.recentHospitalization?.date || ""
                                  }
                                  onChange={(e) =>
                                    handleDetailedCaseUpdate(
                                      selectedCaseIndex,
                                      {
                                        recentHospitalization: {
                                          within3Months: true,
                                          date: e.target.value,
                                        },
                                      },
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                          <div className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300"
                                checked={
                                  caseData.longTermCare?.fromFacility || false
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    longTermCare: {
                                      facilityName:
                                        caseData.longTermCare?.facilityName,
                                      fromFacility: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                From long-term care facility?
                              </span>
                            </label>
                            {caseData.longTermCare?.fromFacility && (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Name of facility
                                </label>
                                <input
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
                                  value={
                                    caseData.longTermCare?.facilityName || ""
                                  }
                                  onChange={(e) =>
                                    handleDetailedCaseUpdate(
                                      selectedCaseIndex,
                                      {
                                        longTermCare: {
                                          fromFacility: true,
                                          facilityName: e.target.value,
                                        },
                                      },
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Section 2: Onset & Isolation */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black">
                            02
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                            Symptom & Onset Timeline
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Symptom Onset (Date/Time)
                            </label>
                            <input
                              type="datetime-local"
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.detailsOfOnset?.onsetDateTime || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  detailsOfOnset: {
                                    ...(caseData.detailsOfOnset || {
                                      isolationDateTime: "",
                                      resolutionDate: "",
                                    }),
                                    onsetDateTime: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Isolation (Date/Time)
                            </label>
                            <input
                              type="datetime-local"
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.detailsOfOnset?.isolationDateTime || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  detailsOfOnset: {
                                    ...(caseData.detailsOfOnset || {
                                      onsetDateTime: "",
                                      resolutionDate: "",
                                    }),
                                    isolationDateTime: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Symptoms Resolved (Date)
                            </label>
                            <input
                              type="date"
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.detailsOfOnset?.resolutionDate || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  detailsOfOnset: {
                                    ...(caseData.detailsOfOnset || {
                                      onsetDateTime: "",
                                      isolationDateTime: "",
                                    }),
                                    resolutionDate: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      </section>

                      {/* Section 3: Antimicrobial Treatment */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black">
                            03
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                            Antimicrobial History
                          </h4>
                        </div>
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Treatment at time of onset (if relevant)
                            </label>
                            <textarea
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.antimicrobials?.atTimeOfOnset || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  antimicrobials: {
                                    ...(caseData.antimicrobials || {}),
                                    atTimeOfOnset: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Details of current treatment
                            </label>
                            <textarea
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.antimicrobials?.currentTreatment || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  antimicrobials: {
                                    ...(caseData.antimicrobials || {}),
                                    currentTreatment: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Treatment in month prior to onset
                            </label>
                            <textarea
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.antimicrobials?.monthPriorToOnset || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  antimicrobials: {
                                    ...(caseData.antimicrobials || {}),
                                    monthPriorToOnset: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                      </section>

                      {/* Section 4: Pathology Details */}
                      <section className="p-8 bg-blue-50/50 rounded-[3rem] border border-blue-100 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-black">
                            04
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 font-sans">
                            Lab & Pathology Details
                          </h4>
                        </div>
                        <div className="space-y-1.5 pt-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                            General Lab Results Summary
                          </label>
                          <textarea
                            className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 h-20"
                            value={caseData.labResults || ""}
                            onChange={(e) =>
                              handleDetailedCaseUpdate(selectedCaseIndex, {
                                labResults: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              Date of Positive Specimen
                            </label>
                            <input
                              type="date"
                              className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                              value={
                                caseData.pathologyDetails
                                  ?.dateOfPositiveSpecimen || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  pathologyDetails: {
                                    ...(caseData.pathologyDetails || {
                                      labNumber: "",
                                      organismsIsolated: "",
                                    }),
                                    dateOfPositiveSpecimen: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              Lab Number
                            </label>
                            <input
                              className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={caseData.pathologyDetails?.labNumber || ""}
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  pathologyDetails: {
                                    ...(caseData.pathologyDetails || {
                                      dateOfPositiveSpecimen: "",
                                      organismsIsolated: "",
                                    }),
                                    labNumber: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              Organisms Isolated
                            </label>
                            <textarea
                              className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.pathologyDetails?.organismsIsolated ||
                                ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  pathologyDetails: {
                                    ...(caseData.pathologyDetails || {
                                      dateOfPositiveSpecimen: "",
                                      labNumber: "",
                                    }),
                                    organismsIsolated: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                              Ribotyping (if available)
                            </label>
                            <input
                              className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                              value={
                                caseData.pathologyDetails?.ribotyping || ""
                              }
                              onChange={(e) =>
                                handleDetailedCaseUpdate(selectedCaseIndex, {
                                  pathologyDetails: {
                                    ...(caseData.pathologyDetails || {
                                      dateOfPositiveSpecimen: "",
                                      labNumber: "",
                                      organismsIsolated: "",
                                    }),
                                    ribotyping: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="p-4 bg-white rounded-2xl border border-blue-100 flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-blue-300"
                                checked={
                                  caseData.pathologyDetails?.sentForWGS?.done ||
                                  false
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    pathologyDetails: {
                                      ...(caseData.pathologyDetails || {
                                        dateOfPositiveSpecimen: "",
                                        labNumber: "",
                                        organismsIsolated: "",
                                      }),
                                      sentForWGS: {
                                        done: e.target.checked,
                                        date: caseData.pathologyDetails
                                          ?.sentForWGS?.date,
                                      },
                                    },
                                  })
                                }
                              />
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                Sent for Whole Genome Sequencing?
                              </span>
                            </label>
                            {caseData.pathologyDetails?.sentForWGS?.done && (
                              <input
                                type="date"
                                className="bg-blue-50 border-none rounded-lg px-3 py-1 text-xs font-bold"
                                value={
                                  caseData.pathologyDetails?.sentForWGS?.date ||
                                  ""
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    pathologyDetails: {
                                      ...(caseData.pathologyDetails || {
                                        dateOfPositiveSpecimen: "",
                                        labNumber: "",
                                        organismsIsolated: "",
                                      }),
                                      sentForWGS: {
                                        done: true,
                                        date: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Section 5: Exposure & Outcome */}
                      <section className="space-y-8">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black">
                            05
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                            Exposure & Results
                          </h4>
                        </div>
                        <div className="space-y-6">
                          <div className="p-6 bg-slate-50 rounded-[2.5rem] space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Exposure Classification
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold"
                                placeholder="Healthcare-associated (facility onset)"
                                value={
                                  caseData.exposureClassification
                                    ?.healthcareAssociatedFacility || ""
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    exposureClassification: {
                                      ...(caseData.exposureClassification ||
                                        {}),
                                      healthcareAssociatedFacility:
                                        e.target.value,
                                    },
                                  })
                                }
                              />
                              <input
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold"
                                placeholder="Healthcare-associated (community onset)"
                                value={
                                  caseData.exposureClassification
                                    ?.healthcareAssociatedCommunity || ""
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    exposureClassification: {
                                      ...(caseData.exposureClassification ||
                                        {}),
                                      healthcareAssociatedCommunity:
                                        e.target.value,
                                    },
                                  })
                                }
                              />
                              <input
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold"
                                placeholder="Community-associated"
                                value={
                                  caseData.exposureClassification
                                    ?.communityAssociated || ""
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    exposureClassification: {
                                      ...(caseData.exposureClassification ||
                                        {}),
                                      communityAssociated: e.target.value,
                                    },
                                  })
                                }
                              />
                              <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded"
                                    checked={
                                      caseData.exposureClassification
                                        ?.otherFacilityNotified?.done || false
                                    }
                                    onChange={(e) =>
                                      handleDetailedCaseUpdate(
                                        selectedCaseIndex,
                                        {
                                          exposureClassification: {
                                            ...(caseData.exposureClassification ||
                                              {}),
                                            otherFacilityNotified: {
                                              done: e.target.checked,
                                              date: caseData
                                                .exposureClassification
                                                ?.otherFacilityNotified?.date,
                                            },
                                          },
                                        },
                                      )
                                    }
                                  />
                                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                    Other facility notified?
                                  </span>
                                </label>
                                {caseData.exposureClassification
                                  ?.otherFacilityNotified?.done && (
                                  <input
                                    type="date"
                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-xs font-bold"
                                    value={
                                      caseData.exposureClassification
                                        ?.otherFacilityNotified?.date || ""
                                    }
                                    onChange={(e) =>
                                      handleDetailedCaseUpdate(
                                        selectedCaseIndex,
                                        {
                                          exposureClassification: {
                                            ...(caseData.exposureClassification ||
                                              {}),
                                            otherFacilityNotified: {
                                              done: true,
                                              date: e.target.value,
                                            },
                                          },
                                        },
                                      )
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="p-8 bg-emerald-50 rounded-[3rem] border border-emerald-100 space-y-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                              Case Outcome
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <label className="flex items-center gap-3 p-4 bg-white rounded-2xl cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 rounded text-emerald-500"
                                  checked={
                                    caseData.detailedOutcome
                                      ?.recoveredNoAdverse || false
                                  }
                                  onChange={(e) =>
                                    handleDetailedCaseUpdate(
                                      selectedCaseIndex,
                                      {
                                        detailedOutcome: {
                                          ...(caseData.detailedOutcome || {}),
                                          recoveredNoAdverse: e.target.checked,
                                        },
                                      },
                                    )
                                  }
                                />
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                  Recovered without adverse event
                                </span>
                              </label>
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-rose-500"
                                    checked={
                                      caseData.detailedOutcome?.admittedToICU
                                        ?.done || false
                                    }
                                    onChange={(e) =>
                                      handleDetailedCaseUpdate(
                                        selectedCaseIndex,
                                        {
                                          detailedOutcome: {
                                            ...(caseData.detailedOutcome || {}),
                                            admittedToICU: {
                                              done: e.target.checked,
                                              date: caseData.detailedOutcome
                                                ?.admittedToICU?.date,
                                            },
                                          },
                                        },
                                      )
                                    }
                                  />
                                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                                    Admitted to ICU?
                                  </span>
                                </label>
                                {caseData.detailedOutcome?.admittedToICU
                                  ?.done && (
                                  <div className="flex items-center gap-2 pl-8">
                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                      Date:
                                    </span>
                                    <input
                                      type="date"
                                      className="bg-emerald-100/50 border-none rounded-lg px-3 py-1 text-xs font-bold"
                                      value={
                                        caseData.detailedOutcome?.admittedToICU
                                          ?.date || ""
                                      }
                                      onChange={(e) =>
                                        handleDetailedCaseUpdate(
                                          selectedCaseIndex,
                                          {
                                            detailedOutcome: {
                                              ...(caseData.detailedOutcome ||
                                                {}),
                                              admittedToICU: {
                                                done: true,
                                                date: e.target.value,
                                              },
                                            },
                                          },
                                        )
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-rose-500"
                                    checked={
                                      caseData.detailedOutcome?.deathRelated
                                        ?.done || false
                                    }
                                    onChange={(e) =>
                                      handleDetailedCaseUpdate(
                                        selectedCaseIndex,
                                        {
                                          detailedOutcome: {
                                            ...(caseData.detailedOutcome || {}),
                                            deathRelated: {
                                              done: e.target.checked,
                                              date: caseData.detailedOutcome
                                                ?.deathRelated?.date,
                                            },
                                          },
                                        },
                                      )
                                    }
                                  />
                                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 font-sans">
                                    Death related to organism?
                                  </span>
                                </label>
                                {caseData.detailedOutcome?.deathRelated
                                  ?.done && (
                                  <div className="flex items-center gap-2 pl-8">
                                    <span className="text-[9px] font-black uppercase text-slate-400">
                                      Date:
                                    </span>
                                    <input
                                      type="date"
                                      className="bg-emerald-100/50 border-none rounded-lg px-3 py-1 text-xs font-bold"
                                      value={
                                        caseData.detailedOutcome?.deathRelated
                                          ?.date || ""
                                      }
                                      onChange={(e) =>
                                        handleDetailedCaseUpdate(
                                          selectedCaseIndex,
                                          {
                                            detailedOutcome: {
                                              ...(caseData.detailedOutcome ||
                                                {}),
                                              deathRelated: {
                                                done: true,
                                                date: e.target.value,
                                              },
                                            },
                                          },
                                        )
                                      }
                                    />
                                  </div>
                                )}
                              </div>
                              <textarea
                                className="w-full bg-white border border-emerald-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none md:col-span-2 min-h-[100px]"
                                placeholder="Additional comments on outcome..."
                                value={
                                  caseData.detailedOutcome
                                    ?.additionalComments || ""
                                }
                                onChange={(e) =>
                                  handleDetailedCaseUpdate(selectedCaseIndex, {
                                    detailedOutcome: {
                                      ...(caseData.detailedOutcome || {}),
                                      additionalComments: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </section>
                    </>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  onClick={() => setSelectedCaseIndex(null)}
                  className="px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  Done & Save Case Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
