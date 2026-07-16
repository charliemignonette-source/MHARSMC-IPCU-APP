import React, { useState, useEffect } from "react";
import {
  Trash2,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ChevronRight,
  Activity,
  Stethoscope,
  ClipboardList,
  Layers,
  XCircle,
  RotateCw,
  Mail,
  Calendar,
  Microscope,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  query,
  where,
  doc,
  limit,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { db, handleFirestoreError, safeOnSnapshot, OperationType, safeAddDoc, safeUpdateDoc, safeDeleteDoc, safeGetDoc } from "../lib/firebase";
const addDoc = safeAddDoc;
const updateDoc = safeUpdateDoc;
const deleteDoc = safeDeleteDoc;
const getDoc = safeGetDoc;
import {
  UserProfile,
  HAICase,
  AMSRequest,
  Audit,
  BOCLog,
  Role,
  IPCUAction,
  NSIReport,
  OutbreakReport,
} from "../types";
import { cn, formatDate } from "../lib/utils";
import {
  UNITS,
  DEVICES,
  NSI_CONSTANTS,
  IPCU_REASONING_GROUPS,
  IPCU_ACTION_GROUPS,
  MONITORING_METHODS,
} from "../constants";

type ValidationType =
  | "HAI"
  | "AUDIT"
  | "BUNDLE"
  | "NSI"
  | "OUTBREAK";

interface PendingItem {
  id: string;
  type: ValidationType;
  patientName?: string;
  unit: string;
  subType: string;
  dateFlagged: string;
  riskLevel?: string;
  patientId?: string;
  bundleType?: string;
  date?: string;
  isDaily?: boolean;
  dayNumber?: number;
  originalData: any;
}

export default function IPCUValidationConsole({
  user,
}: {
  user: UserProfile | null;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"pending" | "history">(
    "pending",
  );
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [validatedHistory, setValidatedHistory] = useState<any[]>([]);

  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  // States for Sections 4-7
  const [confirmedHAI, setConfirmedHAI] = useState<HAICase[]>([]);
  const [validatedAudits, setValidatedAudits] = useState<Audit[]>([]);
  const [validatedBundles, setValidatedBundles] = useState<BOCLog[]>([]);
  const [verifiedDailyDays, setVerifiedDailyDays] = useState<any[]>([]);
  const [validatedNSI, setValidatedNSI] = useState<NSIReport[]>([]);
  const [validatedOutbreaks, setValidatedOutbreaks] = useState<
    OutbreakReport[]
  >([]);
  const [isGroupedHistory, setIsGroupedHistory] = useState(true);

  useEffect(() => {
    // 1. Fetch Pending HAI Cases
    const qHAI = query(
      collection(db, "hai_cases"),
      where("status", "==", "PENDING"), limit(50),
    );
    const unsubHAI = safeOnSnapshot(qHAI, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as HAICase;
        return {
          id: d.id,
          type: "HAI" as ValidationType,
          patientName: data.patientName,
          unit: data.unit,
          subType: data.type,
          dateFlagged: data.triggerDate,
          riskLevel: data.riskLevel,
          originalData: data,
        };
      });
      updatePendingList("HAI", items, "hai_cases");
    });

    // 3. Fetch Pending Audits
    const qAudits = query(
      collection(db, "audits"),
      where("isValidated", "==", false), limit(50),
    );
    const unsubAudits = safeOnSnapshot(qAudits, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as Audit;
        return {
          id: d.id,
          type: "AUDIT" as ValidationType,
          unit: data.unit,
          subType: data.type,
          dateFlagged: data.timestamp && !isNaN(new Date(data.timestamp).getTime()) ? new Date(data.timestamp).toLocaleDateString() : 'N/A',
          originalData: data,
        };
      });
      updatePendingList("AUDIT", items, "audits");
    });

    // 4. Fetch Pending Bundle Audits (boc_logs)
    const qBundles = query(
      collection(db, "boc_logs"),
      where("isValidated", "==", false), limit(50),
    );
    const unsubBundles = safeOnSnapshot(qBundles, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as BOCLog;
        return {
          id: d.id,
          type: "AUDIT" as ValidationType,
          patientName: data.patientName,
          unit: data.unit,
          subType: `Audit: ${data.bundleType}`,
          dateFlagged: data.date,
          originalData: data,
        };
      });
      updatePendingList("AUDIT", items, "boc_logs");
    });

    // 5. Fetch Pending Daily Bundle Monitoring Days
    const qClinicalBundles = query(
      collection(db, "bundle_monitorings"),
      where("hasUnverifiedDays", "==", true), limit(50),
    );
    const unsubClinicalBundles = safeOnSnapshot(qClinicalBundles, (snap) => {
      const items: PendingItem[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const days = data.monitoringDays || [];
        
        const unverifiedDaysByType = days.reduce((acc: any, day: any, index: number) => {
          if (!day.isVerifiedByIPCU) {
            if (!acc[day.bundleType]) acc[day.bundleType] = [];
            acc[day.bundleType].push({ ...day, dayIndex: index });
          }
          return acc;
        }, {});

        Object.keys(unverifiedDaysByType).forEach((bundleType) => {
          const groupDays = unverifiedDaysByType[bundleType];
          items.push({
            id: `${docSnap.id}-${bundleType}`,
            type: "BUNDLE" as ValidationType,
            patientName: data.patientName || "Unknown",
            unit: data.unit || "Unknown",
            subType: `Daily: ${bundleType} (${groupDays.length} day${groupDays.length > 1 ? 's' : ''})`,
            dateFlagged: groupDays[groupDays.length - 1].date,
            riskLevel: groupDays.some((d: any) =>
              Object.values(d.clinicalCriteria || {}).some(
                (v) => v === true,
              ),
            )
              ? "RED"
              : undefined,
            originalData: { ...groupDays[groupDays.length - 1], patientId: docSnap.id, isGrouped: true, groupDays },
            patientId: docSnap.id,
            bundleType: bundleType,
          });
        });
      });
      updatePendingList("BUNDLE", items, "bundle_monitorings");
    });

    // 6. Fetch Pending NSI Reports
    const qNSI = query(
      collection(db, "nsi_reports"),
      where("status", "==", "PENDING"), limit(50),
    );
    const unsubNSI = safeOnSnapshot(qNSI, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as NSIReport;
        return {
          id: d.id,
          type: "NSI" as ValidationType,
          patientName: data.staff.name,
          unit: data.incident.unit,
          subType: data.incident.exposureType,
          dateFlagged: data.incident.date,
          originalData: data,
        };
      });
      updatePendingList("NSI", items, "nsi_reports");
    });

    // 6. Fetch Pending Outbreaks
    const qOutbreaks = query(
      collection(db, "outbreaks"),
      where("status", "in", ["Suspected", "Under Investigation"]), limit(50),
    );
    const unsubOutbreaks = safeOnSnapshot(qOutbreaks, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data() as OutbreakReport;
        return {
          id: d.id,
          type: "OUTBREAK" as ValidationType,
          unit: data.epidemiology?.unitsAffected || "Multiple",
          subType: (data.type || []).join(", "),
          dateFlagged: data.detectedAt,
          originalData: data,
        };
      });
      updatePendingList("OUTBREAK", items, "outbreaks");
    });

    // History Queries (Validated MTD)
    const qConfirmedHAI = query(
      collection(db, "hai_cases"),
      where("status", "==", "CONFIRMED"), limit(50),
    );
    const unsubConfirmedHAI = safeOnSnapshot(qConfirmedHAI, (snap) => {
      setConfirmedHAI(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as HAICase),
      );
    });

    const qValidatedAudits = query(
      collection(db, "audits"),
      where("isValidated", "==", true), limit(50),
    );
    const unsubValidatedAudits = safeOnSnapshot(qValidatedAudits, (snap) => {
      setValidatedAudits(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Audit),
      );
    });

    const qValidatedBundles = query(
      collection(db, "boc_logs"),
      where("isValidated", "==", true), limit(50),
    );
    const unsubValidatedBundles = safeOnSnapshot(qValidatedBundles, (snap) => {
      setValidatedBundles(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BOCLog),
      );
    });

    // 7. Fetch Verified Daily Monitoring Days
    const qVerifiedDaily = query(collection(db, "bundle_monitorings"));
    const unsubVerifiedDaily = safeOnSnapshot(qVerifiedDaily, (snap) => {
      const allVerified: any[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const days = data.monitoringDays || [];
            days.forEach((day: any, index: number) => {
              if (day.isVerifiedByIPCU) {
                allVerified.push({
                  id: `${docSnap.id}-${index}-${day.date}-${day.bundleType}`,
                  patientId: docSnap.id,
                  patientName: data.patientName,
                  unit: data.unit,
                  bundleType: day.bundleType,
                  compliance: day.complianceScores?.overall || day.compliancePercentage,
                  date: day.date,
                  verifiedAt: day.verifiedAtIPCU,
                  verifiedBy: day.verifiedByIPCUName,
                  clinicalAccuracy: day.clinicalAccuracy,
                  complianceAccuracy: day.complianceAccuracy,
                  notes: day.verificationNote,
                  isDaily: true,
                  dayNumber: day.dayNumber,
                });
              }
            });
      });
      setVerifiedDailyDays(allVerified);
    });

    const qValidatedNSI = query(
      collection(db, "nsi_reports"),
      where("status", "!=", "PENDING"), limit(50),
    );
    const unsubValidatedNSI = safeOnSnapshot(qValidatedNSI, (snap) => {
      setValidatedNSI(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as NSIReport),
      );
    });

    const qValidatedOutbreaks = query(
      collection(db, "outbreaks"),
      where("status", "in", ["Confirmed", "Closed", "Controlled"]), limit(50),
    );
    const unsubValidatedOutbreaks = safeOnSnapshot(qValidatedOutbreaks, (snap) => {
      setValidatedOutbreaks(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OutbreakReport),
      );
    });

    return () => {
      unsubHAI();
      unsubAudits();
      unsubBundles();
      unsubVerifiedDaily();
      unsubNSI();
      unsubOutbreaks();
      unsubConfirmedHAI();
      unsubValidatedAudits();
      unsubValidatedBundles();
      unsubValidatedNSI();
      unsubValidatedOutbreaks();
    };
  }, []);

  const [pendingMap, setPendingMap] = useState<
    Record<ValidationType, PendingItem[]>
  >({
    HAI: [],
    AUDIT: [],
    BUNDLE: [],
    NSI: [],
    OUTBREAK: [],
  });

  const handleDelete = async (item: any, silent = false) => {
    if (!user) {
      if (!silent) alert("Please log in to perform this action.");
      return;
    }

    if (user.role !== "ADMIN" && user.role !== "IPCN") {
      if (!silent) alert("Insufficient permissions: Only IPCN/Admin can delete records.");
      return;
    }

    console.log("IPCU Delete Request for item:", item);

    // Sample/Demo Item Detection
    const isSample =
      item.isSample === true ||
      item.originalData?.isSample === true ||
      (typeof item.id === "string" && item.id.startsWith("SAMPLE_")) ||
      (typeof item.id === "string" && item.id.includes("demo"));

    if (isSample) {
      if (!silent) alert("This is sample data and cannot be deleted.");
      return;
    }

    // Identify collection
    const targetCollection =
      item.type === "HAI"
        ? "hai_cases"
        : item.type === "NSI"
          ? "nsi_reports"
          : item.type === "OUTBREAK"
            ? "outbreaks"
            : item.type === "BUNDLE"
              ? item.isDaily || item.dayNumber || item.originalData?.isDaily
                ? "bundle_monitorings"
                : "boc_logs"
              : item.type === "AUDIT"
                ? item.originalData?.bundleType || item.bundleType
                  ? "boc_logs"
                  : "audits"
                : "audits";

    // Target ID resolution
    const targetId =
      item.type === "BUNDLE"
        ? (item.patientId || item.originalData?.patientId || (typeof item.id === "string" ? item.id.split("-")[0] : null))
        : (item.id || item.originalData?.id);

    console.log(`Resolved Target ID: ${targetId} for type: ${item.type} in collection: ${targetCollection}`);

    if (!targetId) {
      console.warn("Deletion failed: Could not resolve target ID", item);
      if (!silent) alert("Delete failed. Try again (ID Error).");
      return;
    }

    // Identifiable name for confirmation
    const entityName = item.patientName || item.entityName || item.staffName || item.subType || "this record";
    const recordDate = item.date || item.dateFlagged || (item.verifiedAt?.toDate?.() ? formatDate(item.verifiedAt.toDate()) : item.verifiedAt) || "";

    // Special handling for Daily Bundle entries (array items)
    if (item.type === "BUNDLE" && (item.isDaily || item.dayNumber || item.originalData?.isDaily || item.originalData?.dayNumber || item.originalData?.isGrouped)) {
      try {
        const docRef = doc(db, "bundle_monitorings", targetId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const days = data.monitoringDays || [];
          
          let updatedDays = days;
          
          if (item.originalData?.isGrouped && item.originalData?.groupDays) {
            const targetTypeStr = String(item.bundleType || item.originalData?.bundleType || "");
            // the logic here is to remove unverified entries of this bundle type (the ones that were grouped)
            updatedDays = days.filter((d: any) => String(d.bundleType) !== targetTypeStr || d.isVerifiedByIPCU);
            
            if (days.length === updatedDays.length) {
              console.warn("No match found in array filter.", { targetTypeStr });
              if (!silent) alert("Delete failed: Record not found in document.");
              return;
            }
          } else {
            // Stringify both sides to ensure matching regardless of Timestamp/String mix
            const targetDateStr = String(item.date || item.originalData?.date || "");
            const targetTypeStr = String(item.bundleType || item.originalData?.bundleType || "");

            updatedDays = days.filter(
              (d: any) =>
                !(
                  String(d.date) === targetDateStr &&
                  String(d.bundleType) === targetTypeStr
                ),
            );
            
            if (days.length === updatedDays.length) {
              console.warn("No match found in array filter. Check date format.", { targetDateStr, targetTypeStr });
              if (!silent) alert("Delete failed: Record not found in document.");
              return;
            }
          }

          await updateDoc(docRef, { monitoringDays: updatedDays });
          if (!silent) alert("Log deleted.");
        } else {
          if (!silent) alert(`Delete failed. Record source (${targetId}) not found.`);
        }
      } catch (e) {
        console.warn("IPCU Array Remove Error:", e);
        if (!silent) alert("Delete failed. See console for details.");
      }
      return;
    }

    // Standard Document Deletion
    try {
      await deleteDoc(doc(db, targetCollection, targetId));
      if (!silent) alert("Log deleted.");
    } catch (e) {
      console.warn("IPCU Delete Error:", e);
      handleFirestoreError(
        e,
        OperationType.DELETE,
        `${targetCollection}/${targetId}`,
      );
      if (!silent) alert("Delete failed. Try again.");
    }
  };

  const handleReset = async (item: any, silent = false) => {
    if (!user || (user.role !== "ADMIN" && user.role !== "IPCN")) return;

    // Identify collection
    const targetCollection =
      item.type === "HAI"
        ? "hai_cases"
        : item.type === "NSI"
          ? "nsi_reports"
          : item.type === "OUTBREAK"
            ? "outbreaks"
            : item.type === "BUNDLE"
              ? item.isDaily || item.dayNumber || item.originalData?.isDaily
                ? "bundle_monitorings"
                : "boc_logs"
              : item.type === "AUDIT"
                ? item.originalData?.bundleType || item.bundleType
                  ? "boc_logs"
                  : "audits"
                : "audits";

    const targetId =
      item.patientId ||
      item.originalData?.patientId ||
      item.id?.split("-")[0] ||
      item.originalData?.id ||
      item.id;

    try {
      if (item.type === "BUNDLE" && (item.isDaily || item.dayNumber || item.originalData?.isDaily || item.originalData?.dayNumber)) {
        const docRef = doc(db, "bundle_monitorings", targetId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const days = data.monitoringDays || [];
          const updatedDays = days.map((d: any) => {
            if (
              d.date === (item.date || item.dateFlagged || item.originalData?.date) &&
              d.bundleType === (item.bundleType || item.originalData?.bundleType)
            ) {
              return {
                ...d,
                isVerifiedByIPCU: false,
                verifiedByIPCU: null,
                verifiedByIPCUName: null,
                verifiedAtIPCU: null,
              };
            }
            return d;
          });
          await updateDoc(docRef, { monitoringDays: updatedDays });
        }
      } else {
        const updatePayload: any = {
          isValidated: false,
          status: "PENDING",
        };

        if (targetCollection === "outbreaks") {
          updatePayload.status = "Suspected";
          updatePayload.validation = null;
        } else if (targetCollection === "nsi_reports") {
          updatePayload.validation = null;
        } else if (targetCollection === "boc_logs") {
          updatePayload.verification = null;
        }

        await updateDoc(doc(db, targetCollection, targetId), updatePayload);
      }
      if (!silent) alert("Validation reset successfully.");
    } catch (e) {
      console.warn("IPCU Reset Error:", e);
      if (!silent) alert("Reset failed. Check permissions.");
    }
  };

  const updatePendingList = (type: ValidationType, items: PendingItem[], sourceId: string) => {
    setPendingMap((prev) => {
      // Create a unique key for each source to avoid overwriting (e.g., AUDIT_audits, AUDIT_boc_logs)
      const internalKey = `${type}_${sourceId}`;
      const newMap = { ...prev, [internalKey]: items };
      
      // Flatten all items for the total count and sorting
      const allPending = (
        Object.values(newMap || {}).flat() as PendingItem[]
      ).sort((a, b) => {
        const dateA = new Date(
          a.originalData.timestamp ||
            a.originalData.createdAt?.toDate?.() ||
            a.dateFlagged,
        ).getTime();
        const dateB = new Date(
          b.originalData.timestamp ||
            b.originalData.createdAt?.toDate?.() ||
            b.dateFlagged,
        ).getTime();
        return dateB - dateA;
      });
      setPendingItems(allPending);
      return newMap;
    });
  };

  const openValidation = (item: PendingItem) => {
    setSelectedItem(item);
    setIsValidationModalOpen(true);
  };

  const handleValidationSubmit = async (decision: any) => {
    if (!selectedItem || !user) return;

    console.log(
      "Validating item:",
      selectedItem.id,
      "of type:",
      selectedItem.type,
    );
    const { id, type } = selectedItem;
    let collectionName = "";
    let updateData: any = {
      isValidated: true,
      validatedBy: user.uid,
      validatorName: user.name,
      validatedAt: serverTimestamp(),
      ...decision,
    };
    if (type !== "OUTBREAK") {
      delete updateData.unitsAffected;
      delete updateData.dateClosed;
    }
    console.log("Initial updateData:", updateData);

    if (type === "HAI") {
      collectionName = "hai_cases";
    } else if (type === "AUDIT") {
      // Check if it's from boc_logs or audits
      collectionName = selectedItem.originalData.bundleType
        ? "boc_logs"
        : "audits";
      updateData.validationStatus = decision.status;
    } else if (type === "BUNDLE") {
      // Manual update for clinical bundle monitoring array
      const { patientId, dayIndex, isGrouped, groupDays } = selectedItem.originalData;
      try {
        const patientRef = doc(db, "bundle_monitorings", patientId);
        // We need to fetch the current patient doc to update the array correctly
        // Since we are in a listener-driven UI, we might have it in local state if we tracked it,
        // but here we just perform an atomic-like update or fetch-then-update.
        // For simplicity and accuracy in rules, we fetch then update.
        const docSnap = await getDoc(patientRef);
        if (docSnap.exists()) {
          const pData = docSnap.data() as any;
          const days = [...(pData.monitoringDays || [])];
          
          let validatedCount = 0;
          
          if (isGrouped && groupDays && decision.targetDayIndex !== undefined) {
            const targetIndex = decision.targetDayIndex;
            if (days[targetIndex]) {
              days[targetIndex] = {
                ...days[targetIndex],
                isVerifiedByIPCU: true,
                verifiedAtIPCU: new Date().toISOString(),
                verifiedByIPCUId: user.uid,
                verifiedByIPCUName: user.name,
                verificationNote: decision.notes,
                clinicalAccuracy: decision.clinicalAccuracy || "Accurate",
                complianceAccuracy: decision.complianceAccuracy || "Accurate",
              };
              validatedCount = 1;
            }
          } else if (isGrouped && groupDays) {
            groupDays.forEach((gd: any) => {
              if (days[gd.dayIndex]) {
                days[gd.dayIndex] = {
                  ...days[gd.dayIndex],
                  isVerifiedByIPCU: true,
                  verifiedAtIPCU: new Date().toISOString(),
                  verifiedByIPCUId: user.uid,
                  verifiedByIPCUName: user.name,
                  verificationNote: decision.notes,
                  clinicalAccuracy: decision.clinicalAccuracy || "Accurate",
                  complianceAccuracy: decision.complianceAccuracy || "Accurate",
                };
                validatedCount++;
              }
            });
          } else if (days[dayIndex]) {
            days[dayIndex] = {
              ...days[dayIndex],
              isVerifiedByIPCU: true,
              verifiedAtIPCU: new Date().toISOString(),
              verifiedByIPCUId: user.uid,
              verifiedByIPCUName: user.name,
              verificationNote: decision.notes,
              clinicalAccuracy: decision.clinicalAccuracy || "Accurate",
              complianceAccuracy: decision.complianceAccuracy || "Accurate",
            };
            validatedCount = 1;
          }
          
          if (validatedCount > 0) {
            const stillUnverified = days.some((d: any) => !d.isVerifiedByIPCU);
            await updateDoc(patientRef, {
              monitoringDays: days,
              updatedAt: serverTimestamp(),
              hasUnverifiedDays: stillUnverified,
            });

            // Log IPCU Action
            await addDoc(collection(db, "ipcu_actions"), {
              patientName: pData.patientName,
              hospNo: pData.hospitalNo,
              unit: pData.unit,
              haiType: "Daily Bundle",
              action: `Verified ${validatedCount} Day(s) - ${decision.clinicalAccuracy || "Accurate"}`,
              staffId: user.uid,
              staffName: user.name,
              date: new Date().toISOString().split("T")[0],
              createdAt: serverTimestamp(),
            });
          }
        }
        setIsValidationModalOpen(false);
        setSelectedItem(null);
        return;
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, "bundle_monitorings");
        return;
      }
    } else if (type === "NSI") {
      collectionName = "nsi_reports";
      updateData = {
        ...updateData,
        status: decision.status,
        validation: {
          classification: decision.classification,
          rootCauses: decision.rootCauses,
          contributingFactors: decision.contributingFactors,
          decision: decision.status,
          correctiveActions: decision.correctiveActions,
          validatorName: user.name,
          validatorId: user.uid,
          validatedAt: serverTimestamp(),
        },
      };
    } else if (type === "OUTBREAK") {
      collectionName = "outbreaks";
      updateData = {
        ...updateData,
        status:
          decision.status === "VALIDATED"
            ? "Confirmed"
            : decision.status === "REJECTED"
              ? "Closed"
              : "Under Investigation",
        dateClosed: decision.dateClosed || "",
        epidemiology: {
          ...(selectedItem.originalData.epidemiology || {}),
          unitsAffected: decision.unitsAffected || "Multiple"
        },
        validation: {
          decision:
            decision.status === "VALIDATED"
              ? "Confirmed Outbreak"
              : decision.status === "REJECTED"
                ? "Not an Outbreak"
                : "Needs More Data",
          basis: decision.basis,
          notes: decision.notes,
          validatorName: user.name,
          validatorId: user.uid,
          validatedAt: serverTimestamp(),
        },
      };
      // Remove unitsAffected from root
      delete updateData.unitsAffected;
    }

    try {
      console.log(
        "Final update call to",
        collectionName,
        "id:",
        id,
        "with data:",
        {
          ...updateData,
          isValidated: true,
          updatedAt: serverTimestamp(),
        },
      );
      await updateDoc(doc(db, collectionName, id), {
        ...updateData,
        isValidated: true,
        updatedAt: serverTimestamp(),
      });
      console.log("Update successful!");

      setIsValidationModalOpen(false);
      setSelectedItem(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, collectionName);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
            IPCU Validation Console
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
            Central Verification Agency • MHARSMC
          </p>
        </div>
      </div>

      {/* Modern Switcher */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex bg-white p-2 w-fit rounded-3xl shadow-sm border border-slate-100">
          {[
            {
              id: "pending",
              label: "Case Verification Queue",
              icon: Clock,
              count: pendingItems.length,
            },
            { id: "history", label: "Validation Archives", icon: ClipboardList },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "px-8 py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-3",
                  activeSubTab === tab.id
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                    : "text-slate-400 hover:text-slate-500",
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black",
                      activeSubTab === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeSubTab === "history" && (
          <button
            onClick={() => setIsGroupedHistory(!isGroupedHistory)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-xs font-bold text-slate-700"
          >
            {isGroupedHistory ? (
              <>
                <Layers className="w-4 h-4 text-emerald-500" />
                <span>Grouped View Active</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 text-slate-400" />
                <span>Show Grouped View</span>
              </>
            )}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "pending" ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-12"
          >
            {/* Pending Validations */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Cases Requiring Validation
                </h3>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="bento-card bg-white overflow-hidden shadow-2xl shadow-slate-200/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border-spacing-0 min-w-[800px] lg:min-w-0">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">
                          Flagged Entity
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">
                          Context / Unit
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">
                          Trigger Metrics
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">
                          Priority
                        </th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">
                          Verification
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-900 mb-0.5">
                                {item.patientName || item.subType}
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                {item.type === "HAI" && (
                                  <Activity className="w-2.5 h-2.5 text-rose-500" />
                                )}
                                {item.type === "AUDIT" && (
                                  <ClipboardList className="w-2.5 h-2.5 text-emerald-500" />
                                )}
                                {item.type === "BUNDLE" && (
                                  <Layers className="w-2.5 h-2.5 text-amber-500" />
                                )}
                                {item.type === "NSI" && (
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                )}
                                {item.type === "OUTBREAK" && (
                                  <AlertOctagon className="w-2.5 h-2.5 text-rose-700" />
                                )}
                                {item.type} • {item.subType}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700">
                                {item.unit}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                {item.dateFlagged}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.type === "HAI" &&
                                item.originalData.triggeredCriteria?.map(
                                  (c: string) => (
                                    <span
                                      key={c}
                                      className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold uppercase rounded"
                                    >
                                      {c}
                                    </span>
                                  ),
                                )}
                              {item.type === "AUDIT" && (
                                <span className="text-[10px] font-bold text-emerald-600">
                                  Compliance:{" "}
                                  {Math.round(
                                    ((item.originalData.score || 0) /
                                      (item.originalData.total || 1)) *
                                      100,
                                  )}
                                  %
                                </span>
                              )}
                              {item.type === "BUNDLE" && (
                                <span
                                  className={cn(
                                    "text-[10px] font-black uppercase",
                                    (item.originalData.complianceScores?.overall ??
                                      item.originalData.compliancePercentage) ===
                                      100
                                      ? "text-emerald-600"
                                      : "text-rose-600",
                                  )}
                                >
                                  {isNaN(
                                    item.originalData.complianceScores
                                      ?.overall ??
                                      item.originalData.compliancePercentage,
                                  )
                                    ? "0"
                                    : Math.round(
                                        item.originalData.complianceScores
                                          ?.overall ??
                                          item.originalData.compliancePercentage,
                                      )}
                                  % Compliance
                                </span>
                              )}
                              {item.type === "OUTBREAK" && (
                                <span className="text-[10px] font-bold text-rose-600 italic">
                                  Attack Rate:{" "}
                                  {item.originalData.epidemiology?.attackRate ||
                                    "N/A"}
                                  %
                                </span>
                              )}
                              {item.type === "NSI" && (
                                <span className="text-[10px] font-bold text-slate-600 tracking-tight">
                                  {item.originalData.staff.position}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-2.5 h-2.5 rounded-full shadow-sm",
                                  item.riskLevel === "RED"
                                    ? "bg-rose-500"
                                    : item.riskLevel === "YELLOW"
                                      ? "bg-amber-400"
                                      : "bg-slate-900",
                                )}
                              />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {item.riskLevel === 'RED' ? 'HIGH' : item.riskLevel === 'YELLOW' ? 'MODERATE' : item.riskLevel === 'BLUE' ? 'LOW' : (item.riskLevel || 'Standard')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleDelete(item);
                                }}
                                className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg transition-colors hover:bg-rose-50"
                                title="Delete Case"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openValidation(item)}
                                className="px-4 py-2 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-900 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                              >
                                Review Case
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                                <ShieldCheck className="w-10 h-10" />
                              </div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                                Queue is Empty
                              </p>
                              <p className="text-[10px] text-slate-300 font-bold max-w-[200px] leading-relaxed uppercase">
                                Institutional biosecurity is currently within
                                optimal parameters.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-12"
          >
            {/* Confirmed HAI Events */}
            <HistorySection
              title="Confirmed HAI Primary Events"
              icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
              headers={[
                "Patient",
                "Unit",
                "HAI Type",
                "Device Days",
                "Validator",
              ]}
              items={confirmedHAI.map((c) => [
                c.patientName,
                c.unit,
                <span className="text-xs font-black text-rose-600 italic">
                  {c.type}
                </span>,
                `${c.deviceDays} Days`,
                <span className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800">
                    {c.validatorName || "System"}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {c.validatedAt?.toDate?.()?.toLocaleDateString() ||
                      (c.validatedAt && !isNaN(new Date(c.validatedAt).getTime()) ? new Date(c.validatedAt).toLocaleDateString() : "-")}
                  </span>
                </span>,
              ])}
              onDelete={(i) =>
                handleDelete({ ...confirmedHAI[i], type: "HAI" })
              }
              onReset={(i) =>
                handleReset({ ...confirmedHAI[i], type: "HAI" })
              }
            />

            {/* Validated IPC Audits */}
            <HistorySection
              title={isGroupedHistory ? "Validated IPC Biosecurity Audits (Grouped)" : "Validated IPC Biosecurity Audits"}
              icon={<ClipboardList className="w-5 h-5 text-emerald-500" />}
              headers={[
                "Audit Type",
                "Unit",
                isGroupedHistory ? "Average Compliance" : "Compliance",
                "Monitoring",
                isGroupedHistory ? "Records" : "Validator",
                "Date",
              ]}
              items={(() => {
                const auditsArray = isGroupedHistory ? (Object.values(validatedAudits.reduce((acc, a) => {
                  const key = `${a.type}-${a.unit}`;
                  if (!acc[key]) {
                    acc[key] = { ...a, group: [a], totalScore: a.score };
                  } else {
                    acc[key].group.push(a);
                    acc[key].totalScore += a.score;
                    if (a.timestamp && new Date(a.timestamp).getTime() > new Date(acc[key].timestamp).getTime()) {
                      acc[key].timestamp = a.timestamp;
                    }
                  }
                  return acc;
                }, {} as any)) as any[]).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : validatedAudits;
                
                if (isGroupedHistory) {
                  return auditsArray.map((a: any) => [
                    a.type.replace(/_/g, " "),
                    a.unit,
                    <span className="text-xs font-black text-emerald-600">
                      {Math.round(a.totalScore / a.group.length)}%
                    </span>,
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none">
                        Multiple Methods
                      </span>
                    </span>,
                    <span className="text-xs font-bold text-slate-500">{a.group.length} Reports</span>,
                    "Latest: " + (a.timestamp && !isNaN(new Date(a.timestamp).getTime()) ? new Date(a.timestamp).toLocaleDateString() : '-'),
                  ]);
                }

                return auditsArray.map((a: any) => [
                  a.type.replace(/_/g, " "),
                  a.unit,
                  <span className="text-xs font-black text-emerald-600">
                    {a.score}%
                  </span>,
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none">
                      {a.monitoringMethod || "N/A"}
                    </span>
                    {a.monitoringStatus && (
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase",
                          a.monitoringStatus === "PASS"
                            ? "text-emerald-500"
                            : "text-rose-500",
                        )}
                      >
                        {a.monitoringStatus === "PASS"
                          ? "Success"
                          : "Discrepancy"}
                      </span>
                    )}
                  </span>,
                  a.validatorName || "-",
                  a.timestamp && !isNaN(new Date(a.timestamp).getTime()) ? new Date(a.timestamp).toLocaleDateString() : '-',
                ]);
              })()}
              onDelete={(i) => {
                if (isGroupedHistory) {
                  const grouped = (Object.values(validatedAudits.reduce((acc, a) => {
                    const key = `${a.type}-${a.unit}`;
                    if (!acc[key]) acc[key] = { ...a, group: [a], timestamp: a.timestamp };
                    else {
                      acc[key].group.push(a);
                      if (a.timestamp && new Date(a.timestamp).getTime() > new Date(acc[key].timestamp).getTime()) acc[key].timestamp = a.timestamp;
                    }
                    return acc;
                  }, {} as any)) as any[]).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const target = grouped[i];
                  if (window.confirm(`Delete all ${target.group.length} records in this group?`)) {
                    target.group.forEach((a: any) => handleDelete({ ...a, type: "AUDIT" }, true));
                  }
                } else {
                  handleDelete({ ...validatedAudits[i], type: "AUDIT" });
                }
              }}
              onReset={(i) => {
                if (isGroupedHistory) {
                  const grouped = (Object.values(validatedAudits.reduce((acc, a) => {
                    const key = `${a.type}-${a.unit}`;
                    if (!acc[key]) acc[key] = { ...a, group: [a], timestamp: a.timestamp };
                    else {
                      acc[key].group.push(a);
                      if (a.timestamp && new Date(a.timestamp).getTime() > new Date(acc[key].timestamp).getTime()) acc[key].timestamp = a.timestamp;
                    }
                    return acc;
                  }, {} as any)) as any[]).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const target = grouped[i];
                  if (window.confirm(`Reset validation for all ${target.group.length} records in this group?`)) {
                    target.group.forEach((a: any) => handleReset({ ...a, type: "AUDIT" }, true));
                  }
                } else {
                  handleReset({ ...validatedAudits[i], type: "AUDIT" });
                }
              }}
            />

            {/* Validated Bundle Discrepancies */}
            <HistorySection
              title={isGroupedHistory ? "Validated Bundle Compliance Logs (Grouped)" : "Validated Bundle Compliance Logs"}
              icon={<Layers className="w-5 h-5 text-amber-500" />}
              headers={[
                "Patient",
                "Unit",
                "Type",
                isGroupedHistory ? "Records" : "Status",
                "Monitoring",
                "IPCU Decision",
              ]}
              items={(() => {
                const combined = [
                  ...validatedBundles.map((b) => ({
                    data: [
                      b.patientName,
                      b.unit,
                      `Audit: ${b.bundleType || "Care Bundle"}`,
                      <span
                        key="status"
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          b.compliancePercentage === 100
                            ? "text-emerald-500"
                            : "text-rose-500",
                        )}
                      >
                        {b.compliancePercentage}% Reported
                      </span>,
                      <span key="monitoring" className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none">
                          {b.monitoringMethod || "N/A"}
                        </span>
                        {b.monitoringStatus && (
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase",
                              b.monitoringStatus === "PASS"
                                ? "text-emerald-500"
                                : "text-rose-500",
                            )}
                          >
                            {b.monitoringStatus === "PASS"
                              ? "Success"
                              : "Discrepancy"}
                          </span>
                        )}
                      </span>,
                      <span
                        key="decision"
                        className={cn(
                          "px-2 py-1 rounded-xl text-[9px] font-black uppercase",
                          b.verification?.finalDecision === "Compliant"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-rose-50 text-rose-600",
                        )}
                      >
                        {b.verification?.finalDecision || "Validated"}
                      </span>,
                    ],
                    date: b.validatedAt?.toDate?.()
                      ? b.validatedAt.toDate().getTime()
                      : b.validatedAt
                        ? new Date(b.validatedAt).getTime()
                        : 0,
                    original: { ...b, type: "AUDIT" },
                  })),
                  ...verifiedDailyDays.map((d) => ({
                    data: [
                      d.patientName,
                      d.unit,
                      `Daily: ${d.bundleType} (D${d.dayNumber})`,
                      <span
                        key="status"
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          d.compliance === 100
                            ? "text-emerald-500"
                            : "text-rose-500",
                        )}
                      >
                        {isNaN(d.compliance) ? "0" : Math.round(d.compliance)}%
                        Compliance
                      </span>,
                      <span key="monitoring" className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none">
                          Clinical Review
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          {d.clinicalAccuracy}
                        </span>
                      </span>,
                      <div key="decision" className="flex flex-col gap-1">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase w-fit">
                          Verified
                        </span>
                        <span className="text-[8px] text-slate-400 uppercase font-black">
                          {d.verifiedBy} •{" "}
                          {d.verifiedAt && !isNaN(new Date(d.verifiedAt).getTime())
                            ? new Date(d.verifiedAt).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>,
                    ],
                    date: d.verifiedAt?.toDate?.()
                      ? d.verifiedAt.toDate().getTime()
                      : d.verifiedAt
                        ? new Date(d.verifiedAt).getTime()
                        : 0,
                    original: { ...d, type: "BUNDLE" },
                  })),
                ].sort((a: any, b: any) => b.date - a.date);
                
                if (isGroupedHistory) {
                  const grouped = (Object.values(combined.reduce((acc, item) => {
                    let baseType = item.data[2] as string;
                    if (baseType.startsWith("Daily:")) {
                        baseType = baseType.replace(/ \(D\d+\)/, "");
                    }
                    const key = `${item.data[0]}-${item.data[1]}-${baseType}`;
                    if (!acc[key]) {
                      acc[key] = { ...item, group: [item], baseType };
                    } else {
                      acc[key].group.push(item);
                      if (item.date > acc[key].date) {
                         acc[key].date = item.date;
                         // Keep the latest decision block
                         acc[key].data[5] = item.data[5];
                      }
                    }
                    return acc;
                  }, {} as any)) as any[]).sort((a: any, b: any) => b.date - a.date);

                  return grouped.map((g: any) => [
                    g.data[0], // Patient
                    g.data[1], // Unit
                    g.baseType,
                    <span className="text-xs font-bold text-slate-500">{g.group.length} Days/Records</span>,
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight leading-none">
                        Grouped View
                      </span>
                    </span>,
                    g.data[5] // Latest decision
                  ]);
                }
                
                return combined.map((item) => item.data);
              })()}
              onDelete={(i) => {
                const combined = [
                  ...validatedBundles.map((b) => ({
                    date: b.validatedAt?.toDate?.()
                      ? b.validatedAt.toDate().getTime()
                      : b.validatedAt
                        ? new Date(b.validatedAt).getTime()
                        : 0,
                    original: { ...b, type: "AUDIT" },
                    data: [b.patientName, b.unit, b.bundleType]
                  })),
                  ...verifiedDailyDays.map((d) => ({
                    date: d.verifiedAt?.toDate?.()
                      ? d.verifiedAt.toDate().getTime()
                      : d.verifiedAt
                        ? new Date(d.verifiedAt).getTime()
                        : 0,
                    original: { ...d, type: "BUNDLE" },
                    data: [d.patientName, d.unit, `Daily: ${d.bundleType} (D${d.dayNumber})`]
                  })),
                ].sort((a: any, b: any) => b.date - a.date);

                if (isGroupedHistory) {
                  const grouped = (Object.values(combined.reduce((acc, item) => {
                    let baseType = item.data[2] as string;
                    if (baseType.startsWith("Daily:")) baseType = baseType.replace(/ \(D\d+\)/, "");
                    const key = `${item.data[0]}-${item.data[1]}-${baseType}`;
                    if (!acc[key]) acc[key] = { ...item, group: [item], baseType };
                    else {
                      acc[key].group.push(item);
                      if (item.date > acc[key].date) acc[key].date = item.date;
                    }
                    return acc;
                  }, {} as any)) as any[]).sort((a: any, b: any) => b.date - a.date);
                  
                  const target = grouped[i];
                  if (window.confirm(`Delete all ${target.group.length} bundle records in this group?`)) {
                    target.group.forEach((b: any) => handleDelete(b.original, true));
                  }
                } else {
                  handleDelete(combined[i].original);
                }
              }}
              onReset={(i) => {
                const combined = [
                  ...validatedBundles.map((b) => ({
                    date: b.validatedAt?.toDate?.()
                      ? b.validatedAt.toDate().getTime()
                      : b.validatedAt
                        ? new Date(b.validatedAt).getTime()
                        : 0,
                    original: { ...b, type: "AUDIT" },
                    data: [b.patientName, b.unit, b.bundleType]
                  })),
                  ...verifiedDailyDays.map((d) => ({
                    date: d.verifiedAt?.toDate?.()
                      ? d.verifiedAt.toDate().getTime()
                      : d.verifiedAt
                        ? new Date(d.verifiedAt).getTime()
                        : 0,
                    original: { ...d, type: "BUNDLE" },
                    data: [d.patientName, d.unit, `Daily: ${d.bundleType} (D${d.dayNumber})`]
                  })),
                ].sort((a: any, b: any) => b.date - a.date);

                if (isGroupedHistory) {
                  const grouped = (Object.values(combined.reduce((acc, item) => {
                    let baseType = item.data[2] as string;
                    if (baseType.startsWith("Daily:")) baseType = baseType.replace(/ \(D\d+\)/, "");
                    const key = `${item.data[0]}-${item.data[1]}-${baseType}`;
                    if (!acc[key]) acc[key] = { ...item, group: [item], baseType };
                    else {
                      acc[key].group.push(item);
                      if (item.date > acc[key].date) acc[key].date = item.date;
                    }
                    return acc;
                  }, {} as any)) as any[]).sort((a: any, b: any) => b.date - a.date);
                  
                  const target = grouped[i];
                  if (window.confirm(`Reset validation for all ${target.group.length} bundle records in this group?`)) {
                    target.group.forEach((b: any) => handleReset(b.original, true));
                  }
                } else {
                  handleReset(combined[i].original);
                }
              }}
            />

            {/* Validated NSI Reports */}
            <HistorySection
              title="Validated Sharps Exposure Records"
              icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
              headers={[
                "Staff Name",
                "Unit",
                "Exposure",
                "Classification",
                "Result",
              ]}
              items={validatedNSI.map((n) => [
                n.staff.name,
                n.incident.unit,
                n.incident.exposureType,
                <span className="text-[10px] font-black uppercase text-slate-400">
                  {n.validation?.classification || "-"}
                </span>,
                <span
                  className={cn(
                    "px-2 py-1 rounded-xl text-[9px] font-black uppercase",
                    n.status === "VALIDATED"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600",
                  )}
                >
                  {n.status}
                </span>,
              ])}
              onDelete={(i) =>
                handleDelete({ ...validatedNSI[i], type: "NSI" })
              }
              onReset={(i) =>
                handleReset({ ...validatedNSI[i], type: "NSI" })
              }
            />

            {/* Validated Outbreaks */}
            <HistorySection
              title="Institutional Outbreak Archives"
              icon={<ShieldAlert className="w-5 h-5 text-slate-900" />}
              headers={[
                "Outbreak Type",
                "Affected Units",
                "Total Cases",
                "Status",
                "Closure Date",
              ]}
              items={validatedOutbreaks.map((o) => [
                (o.type || []).join(", "),
                o.epidemiology?.unitsAffected || "Ward",
                o.lineList?.length || 0,
                <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase">
                  {o.status}
                </span>,
                o.dateClosed || "-",
              ])}
              onDelete={(i) =>
                handleDelete({ ...validatedOutbreaks[i], type: "OUTBREAK" })
              }
              onReset={(i) =>
                handleReset({ ...validatedOutbreaks[i], type: "OUTBREAK" })
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isValidationModalOpen && selectedItem && (
          <ValidationModal
            item={selectedItem}
            user={user}
            onClose={() => setIsValidationModalOpen(false)}
            onSubmit={handleValidationSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistorySection({
  title,
  icon,
  headers,
  items,
  onDelete,
  onReset,
}: {
  title: string;
  icon: React.ReactNode;
  headers: string[];
  items: any[][];
  onDelete?: (index: number) => void;
  onReset?: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-2">
        {icon}
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
          {title}
        </h3>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="bento-card bg-white overflow-hidden shadow-xl shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400"
                  >
                    {h}
                  </th>
                ))}
                {(onDelete || onReset) && (
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-6 py-4 text-xs font-bold text-slate-700"
                    >
                      {cell}
                    </td>
                  ))}
                  {(onDelete || onReset) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onReset && (
                          <button
                            onClick={() => onReset(i)}
                            className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-all"
                            title="Reset Validation"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(i)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={headers.length + (onDelete ? 1 : 0)}
                    className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest"
                  >
                    No validation records for this category
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ValidationModal({ item, user, onClose, onSubmit }: any) {
  const isGroupedBundle = item.type === "BUNDLE" && item.originalData?.isGrouped;
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);

  const currentBundleData = isGroupedBundle
    ? item.originalData.groupDays[selectedGroupIdx]
    : item.originalData;

  const [decision, setDecision] = useState<any>({
    status:
      item.type === "HAI"
        ? "CONFIRMED"
        : item.type === "NSI"
          ? "VALIDATED"
          : "VALIDATED",
    reason: "",
    notes: "",
    basis: [],
    rootCauses: [],
    contributingFactors: [],
    correctiveActions: [],
    classification: "Significant Exposure",
    monitoringMethod: "",
    monitoringStatus: "", // 'PASS' | 'FAIL'
    clinicalAccuracy: "Accurate",
    complianceAccuracy: "Accurate",
    unitsAffected: item.type === "OUTBREAK" ? item.originalData?.epidemiology?.unitsAffected || "Multiple" : "",
    dateClosed: item.type === "OUTBREAK" ? item.originalData?.dateClosed || "" : "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isGroupedBundle) {
        await onSubmit({ ...decision, targetDayIndex: currentBundleData.dayIndex });
      } else {
        await onSubmit(decision);
      }
    } catch (err) {
      console.warn("Submission error:", err);
      alert(err instanceof Error ? err.message : "An error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full h-full sm:h-auto sm:max-w-4xl bg-white sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[100vh] sm:max-h-[90vh]"
      >
        <div className="p-4 sm:p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-2 sm:p-3 rounded-2xl",
                item.type === "HAI" ? "bg-rose-500" : "bg-brand-primary",
              )}
            >
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-black uppercase tracking-tight italic leading-tight">
                IPCU Validation Protocol
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Ref: {item.id.slice(0, 8)} • Verification Stage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 shrink-0"
          >
            <XCircle className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <div className="flex-1 p-4 sm:p-10 overflow-y-auto space-y-8 sm:space-y-10">
              {/* Source Data Review */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-brand-primary" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">
                      Case Submission Details
                    </h4>
                  </div>
                  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          {item.type === "AUDIT" &&
                          [
                            "HH_AVAILABILITY",
                            "PPE_AVAILABILITY",
                            "ENV_CLEANING",
                          ].includes(item.originalData.type)
                            ? "Audit Target (Unit)"
                            : item.originalData.type === "SAFE_INJECTION"
                              ? "Audit Target (Unit + Staff)"
                              : ["AUDIT", "BUNDLE", "NSI"].includes(item.type)
                                ? "HCW / Staff Identifier"
                                : "Patient Name"}
                        </p>
                        <p className="text-xs font-bold text-slate-900 uppercase">
                          {item.type === "AUDIT"
                            ? [
                                "HH_AVAILABILITY",
                                "PPE_AVAILABILITY",
                                "ENV_CLEANING",
                              ].includes(item.originalData.type)
                              ? `Institutional Audit: ${item.unit || item.originalData.unit}`
                              : item.originalData.type === "SAFE_INJECTION"
                                ? `Unit: ${item.unit || item.originalData.unit}${item.originalData.staffIdentifier ? ` • ${item.originalData.staffIdentifier}` : ""}`
                                : item.originalData.staffIdentifier ||
                                  (["1", "Nurse"].includes(
                                    item.originalData.profession,
                                  )
                                    ? "Nurse"
                                    : ["2", "Auxiliary"].includes(
                                          item.originalData.profession,
                                        )
                                      ? "Auxiliary"
                                      : ["3", "MD"].includes(
                                            item.originalData.profession,
                                          )
                                        ? "Medical Doctor"
                                        : item.originalData.profession ||
                                          "Staff Member")
                            : item.patientName || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Location / Unit
                        </p>
                        <p className="text-xs font-bold text-slate-900">
                          {item.unit || item.originalData.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Type
                        </p>
                        <p className="text-xs font-black text-rose-500 uppercase italic">
                          {item.subType}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          Date Logged
                        </p>
                        <p className="text-xs font-bold text-slate-900">
                          {item.dateFlagged}
                        </p>
                      </div>
                    </div>

                    {item.originalData.remarks && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                        <p className="text-[9px] font-black text-amber-900 uppercase mb-1">
                          Original Remarks
                        </p>
                        <p className="text-xs text-amber-700 italic">
                          "{item.originalData.remarks}"
                        </p>
                      </div>
                    )}

                    {item.type === "NSI" && (
                      <div className="pt-4 border-t border-slate-50 space-y-4">
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                          <p className="text-[10px] font-black text-rose-900 uppercase mb-1">
                            Exposure Context
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            {item.originalData.incident.exposureType} using{" "}
                            {item.originalData.incident.deviceInvolved}
                          </p>
                          <p className="text-[10px] text-rose-500 font-medium italic mt-1">
                            Activity: {item.originalData.incident.activity}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                              Source Risk
                            </p>
                            <p className="text-[10px] font-bold text-slate-600">
                              {(item.originalData.source?.risks || []).join(
                                ", ",
                              ) || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                              Staff Position
                            </p>
                            <p className="text-[10px] font-bold text-slate-600">
                              {item.originalData.staff.position}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                            Narrative Description
                          </p>
                          <p className="text-[10px] text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-3">
                            {item.originalData.description?.narrative ||
                              "No description provided."}
                          </p>
                        </div>
                      </div>
                    )}

                    {item.type === "OUTBREAK" && (
                      <div className="pt-4 border-t border-slate-50 space-y-4">
                        <div className="p-4 bg-slate-900 rounded-2xl text-white">
                          <p className="text-[10px] font-black text-white/50 uppercase mb-1">
                            Investigation Summary
                          </p>
                          <p className="text-xs font-bold font-mono">
                            {(item.originalData.type || []).join(", ")} Cluster
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                            <div className="flex justify-between border-b border-white/10 pb-1">
                              <span className="text-white/40 uppercase">
                                Attack Rate
                              </span>
                              <span className="font-bold">
                                {item.originalData.epidemiology?.attackRate}%
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-1">
                              <span className="text-white/40 uppercase">
                                Total Cases
                              </span>
                              <span className="font-bold">
                                {item.originalData.epidemiology?.totalCases}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase">
                            Detection Criteria
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(item.originalData.triggerCriteria || []).map(
                              (c: string) => (
                                <span
                                  key={c}
                                  className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-600 uppercase italic"
                                >
                                  {c}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                        {item.originalData.lineList &&
                          item.originalData.lineList.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase">
                                Line List Summary (
                                {item.originalData.lineList.length} cases)
                              </p>
                              <div className="max-h-[120px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                {item.originalData.lineList.map(
                                  (c: any, i: number) => (
                                    <div
                                      key={i}
                                      className="p-2 bg-white border border-slate-100 rounded-xl text-[10px] flex justify-between"
                                    >
                                      <span className="font-bold text-slate-900">
                                        {c.patientName}
                                      </span>
                                      <span className="text-slate-400 italic">
                                        Onset: {c.onSetDate}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {item.type === "HAI" && (
                      <div className="pt-4 border-t border-slate-50 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                              Device/Procedure
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {item.originalData.deviceType ||
                                item.originalData.procedureType ||
                                "N/A"}
                            </p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                              Device Days
                            </p>
                            <p className="text-xs font-bold text-slate-700">
                              {item.originalData.deviceDays} Days
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                            Triggered Symptoms
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.originalData.triggeredCriteria?.map(
                              (c: string) => (
                                <span
                                  key={c}
                                  className="px-2 py-1 bg-rose-50 rounded-lg text-[9px] font-bold text-rose-600 uppercase tracking-tight italic"
                                >
                                  {c}
                                </span>
                              ),
                            )}
                            {item.originalData.triggeredLabs?.map(
                              (l: string) => (
                                <span
                                  key={l}
                                  className="px-2 py-1 bg-blue-50 rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-tight italic"
                                >
                                  {l}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {item.type === "AUDIT" && (
                      <div className="pt-4 border-t border-slate-50 space-y-4">
                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                          <div>
                            <p className="text-[10px] font-black text-emerald-900 uppercase">
                              Audit Score Result
                            </p>
                            <p className="text-2xl font-black text-emerald-600">
                              {item.originalData.score}/
                              {item.originalData.total}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-900 uppercase">
                              Compliance
                            </p>
                            <p className="text-2xl font-black text-emerald-600">
                              {Math.round(
                                (item.originalData.score /
                                  item.originalData.total) *
                                  100,
                              )}
                              %
                            </p>
                          </div>
                        </div>

                        {item.originalData.details && (
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase">
                              Checklist Findings Review
                            </p>
                            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                              {item.subType === "ENV_CLEANING" &&
                                item.originalData.details.surfaces && (
                                  <div className="grid grid-cols-1 gap-1">
                                    {Object.entries(
                                      item.originalData?.details?.surfaces ||
                                        {},
                                    ).map(([key, value]: [string, any]) => (
                                      <div
                                        key={key}
                                        className="flex justify-between items-center p-2 bg-white border border-slate-50 rounded-xl"
                                      >
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                                          {key
                                            .replace(/([A-Z])/g, " $1")
                                            .toLowerCase()}
                                        </span>
                                        <span
                                          className={cn(
                                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                            value === "cleaned"
                                              ? "bg-emerald-50 text-emerald-600"
                                              : value === "notCleaned"
                                                ? "bg-rose-50 text-rose-600"
                                                : "bg-slate-50 text-slate-400",
                                          )}
                                        >
                                          {value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                              {item.subType === "HH_COMPLIANCE" &&
                                item.originalData.details?.hhObs && (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-slate-900 rounded-2xl">
                                      <p className="text-[10px] font-black text-white/50 uppercase mb-2">
                                        Moments Observed
                                      </p>
                                      <div className="grid grid-cols-1 gap-2">
                                        {/* New Format (Array of entries) */}
                                        {item.originalData.details.hhObs
                                          .entries &&
                                        Array.isArray(
                                          item.originalData.details.hhObs
                                            .entries,
                                        )
                                          ? item.originalData.details.hhObs.entries.map(
                                              (entry: any, i: number) => (
                                                <div
                                                  key={i}
                                                  className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5"
                                                >
                                                  <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-white/70 uppercase">
                                                      Opportunity {i + 1}
                                                    </span>
                                                    <span className="text-[8px] text-slate-400 uppercase tracking-tighter">
                                                      {entry.indications.join(
                                                        ", ",
                                                      )}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <span
                                                      className={cn(
                                                        "text-[9px] font-black uppercase px-2 py-1 rounded-lg",
                                                        entry.action ===
                                                          "rub" ||
                                                          entry.action ===
                                                            "wash"
                                                          ? "bg-emerald-500/20 text-emerald-400"
                                                          : "bg-rose-500/20 text-rose-400",
                                                      )}
                                                    >
                                                      {entry.action === "rub"
                                                        ? "Hand Rub"
                                                        : entry.action ===
                                                            "wash"
                                                          ? "Hand Wash"
                                                          : "Missed"}
                                                    </span>
                                                    {entry.gloves && (
                                                      <span className="bg-blue-500/20 text-blue-400 px-1.5 py-1 rounded text-[8px] font-bold uppercase">
                                                        Gloves
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              ),
                                            )
                                          : /* Old Format (indications object) */
                                            Object.entries(
                                              item.originalData?.details?.hhObs
                                                ?.indications || {},
                                            ).map(
                                              ([key, active]: [string, any]) =>
                                                active && (
                                                  <div
                                                    key={key}
                                                    className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5"
                                                  >
                                                    <span className="text-[10px] font-bold text-white/70 uppercase">
                                                      {key === "befPat"
                                                        ? "Before touch Patient"
                                                        : key === "befAsept"
                                                          ? "Before Clean/Aseptic"
                                                          : key === "aftBF"
                                                            ? "After Body Fluid"
                                                            : key === "aftPat"
                                                              ? "After touch Patient"
                                                              : "After Surroundings"}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                      <span
                                                        className={cn(
                                                          "text-[9px] font-black uppercase px-2 py-1 rounded-lg",
                                                          item.originalData
                                                            .details.hhObs
                                                            .actions?.[key] ===
                                                            "hr" ||
                                                            item.originalData
                                                              .details.hhObs
                                                              .actions?.[
                                                              key
                                                            ] === "hw"
                                                            ? "bg-emerald-500/20 text-emerald-400"
                                                            : "bg-rose-500/20 text-rose-400",
                                                        )}
                                                      >
                                                        {item.originalData
                                                          .details.hhObs
                                                          .actions?.[key] ||
                                                          "Missed"}
                                                      </span>
                                                      {item.originalData.details
                                                        .hhObs.momentsGloves?.[
                                                        key
                                                      ] && (
                                                        <span className="bg-blue-500/20 text-blue-400 px-1.5 py-1 rounded text-[8px] font-bold uppercase">
                                                          Gloves
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ),
                                            )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                              {[
                                "HH_AVAILABILITY",
                                "PPE_AVAILABILITY",
                                "PPE_COMPLIANCE",
                                "SAFE_INJECTION",
                              ].includes(item.subType) && (
                                <div className="grid grid-cols-1 gap-1">
                                  {Object.entries(
                                    item.originalData?.details || {},
                                  ).filter(([section]) => {
                                      if (item.subType === 'HH_AVAILABILITY') return ['sink', 'abhr', 'posters'].includes(section);
                                      if (item.subType === 'PPE_AVAILABILITY') return ['ppe', 'posters'].includes(section);
                                      if (item.subType === 'PPE_COMPLIANCE') return ['ppeCompliance'].includes(section);
                                      if (item.subType === 'SAFE_INJECTION') return ['safeInjection'].includes(section);
                                      return false;
                                  }).map(
                                    ([section, data]: [string, any]) =>
                                      typeof data === "object" &&
                                      !Array.isArray(data) &&
                                      Object.entries(data || {}).map(
                                        ([key, value]) =>
                                          typeof value === "boolean" && (
                                            <div
                                              key={`${section}-${key}`}
                                              className="flex justify-between items-center p-2 bg-white border border-slate-50 rounded-xl"
                                            >
                                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                {section !== 'ppeCompliance' && section !== 'safeInjection' ? `${section.replace(/([A-Z])/g, " $1")} - ` : ''}
                                                {key
                                                  .replace(/([A-Z])/g, " $1")
                                                  .toLowerCase()}
                                              </span>
                                              <div
                                                className={cn(
                                                  "w-2 h-2 rounded-full shrink-0",
                                                  value
                                                    ? "bg-emerald-500"
                                                    : "bg-rose-500",
                                                )}
                                              />
                                            </div>
                                          ),
                                      ),
                                  )}
                                </div>
                              )}

                              {(item.subType === 'HH_AVAILABILITY' || item.subType === 'PPE_AVAILABILITY') && item.originalData.details?.inventory && (
                                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inventory & Replenishment Audit</p>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-slate-400">AUDITED INVENTORY?</span>
                                    <span className={cn(
                                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                      item.originalData.details.inventory.audited ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                      {item.originalData.details.inventory.audited ? "YES" : "NO"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-slate-400">INVENTORY STATUS:</span>
                                    <span className={cn(
                                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                                      item.originalData.details.inventory.status === "Adequate" ? "bg-emerald-50 text-emerald-600" : item.originalData.details.inventory.status === "Low" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                      {item.originalData.details.inventory.status}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-slate-400">REPLENISHED DURING VISIT?</span>
                                    <span className="text-[9px] font-black text-slate-700 uppercase">
                                      {item.originalData.details.inventory.replenished === 'Yes' ? 'YES, REPLENISHED' : item.originalData.details.inventory.replenished === 'No' ? 'NO, LEFT UNREPLENISHED' : item.originalData.details.inventory.replenished === 'Requested' ? 'REQUESTED / ORDERED' : 'NOT NEEDED'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-slate-400">ASSIGNED PERSONNEL:</span>
                                    <span className="text-[9px] font-bold text-slate-700 uppercase">
                                      {item.originalData.details.inventory.assignedPersonnel || "NONE SPECIFIED"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {item.type === "BUNDLE" && (
                      <div className="pt-4 border-t border-slate-50 space-y-6">
                        {isGroupedBundle && item.originalData.groupDays && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                SELECT DAY TO REVIEW ({selectedGroupIdx + 1}/{item.originalData.groupDays.length})
                              </p>
                            </div>
                            <div className="flex gap-2 p-1 overflow-x-auto pb-3 custom-scrollbar snap-x">
                                {item.originalData.groupDays.map((d: any, idx: number) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedGroupIdx(idx)}
                                      className={cn(
                                          "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all snap-center",
                                          selectedGroupIdx === idx 
                                            ? "bg-amber-100 text-amber-800 shadow-sm border border-amber-200" 
                                            : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent"
                                      )}
                                    >
                                        Day {d.dayNumber}
                                    </button>
                                ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-4 bg-teal-50 rounded-3xl border border-teal-100">
                          <div>
                            <p className="text-[10px] font-black text-teal-900 uppercase">
                              Reported Compliance
                            </p>
                            <p className="text-2xl font-black text-teal-600">
                              {currentBundleData.complianceScores?.overall || 0}
                              %
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-teal-900 uppercase">
                              Day Number
                            </p>
                            <p className="text-2xl font-black text-teal-600">
                              {currentBundleData.dayNumber}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Reported Clinical Criteria
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(
                              currentBundleData.clinicalCriteria || {},
                            ).map(([key, val]: [string, any]) => (
                              <div
                                key={key}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-2xl border transition-all",
                                  (val === true || val === 'Present')
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : val === 'No Entry' 
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-slate-50 border-slate-200 text-slate-500",
                                )}
                              >
                                <span className="text-[9px] font-black uppercase tracking-tight truncate flex-1 pr-2">
                                  {key}
                                </span>
                                {(val === true || val === 'Present') ? (
                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-amber-200 rounded text-amber-800 shrink-0">Present</span>
                                ) : (val === false || val === 'Absent') ? (
                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-slate-200 rounded text-slate-600 shrink-0">Absent</span>
                                ) : (val === 'No Entry') ? (
                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-rose-200 rounded text-rose-800 shrink-0">No Entry</span>
                                ) : (
                                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-slate-100 rounded text-slate-400 shrink-0">Unspecified</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            Bundle Checklist Items
                          </p>
                          <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.entries(
                              currentBundleData.bundleChecklist || {},
                            ).map(([key, val]) => (
                              <div
                                key={key}
                                className="flex justify-between items-center p-3 bg-white border border-slate-50 rounded-2xl"
                              >
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tight max-w-[70%]">
                                  {key}
                                </span>
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest",
                                    val === "Done"
                                      ? "bg-emerald-50 text-emerald-600"
                                      : val === "Not Done"
                                        ? "bg-rose-50 text-rose-600"
                                        : "bg-slate-50 text-slate-400",
                                  )}
                                >
                                  {val as any}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* IPCU Final Decision */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">
                      Validation Protocol Decision
                    </h4>
                  </div>

                  <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-8 shadow-2xl shadow-slate-900/20">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Classification Select
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {(item.type === "HAI"
                          ? [
                              {
                                id: "CONFIRMED",
                                label: "Confirmed HAI Event",
                                color: "text-rose-400",
                              },
                              {
                                id: "NOT_HAI",
                                label: "Does Not Meet Criteria",
                                color: "text-emerald-400",
                              },
                              {
                                id: "NEEDS_MORE_DATA",
                                label: "Insufficient Evidence",
                                color: "text-amber-400",
                              },
                            ]
                          : item.type === "NSI"
                              ? [
                                  {
                                    id: "VALIDATED",
                                    label: "Validated NSI Case",
                                    color: "text-emerald-400",
                                  },
                                  {
                                    id: "NOT_NSI",
                                    label: "Not an Exposure Event",
                                    color: "text-rose-400",
                                  },
                                  {
                                    id: "NEEDS_MORE_DATA",
                                    label: "Pending Lab Review",
                                    color: "text-amber-400",
                                  },
                                ]
                              : item.type === "OUTBREAK"
                                ? [
                                    {
                                      id: "VALIDATED",
                                      label: "Confirmed Outbreak",
                                      color: "text-rose-400",
                                    },
                                    {
                                      id: "REJECTED",
                                      label: "Pseudo-outbreak/Cluster",
                                      color: "text-emerald-400",
                                    },
                                    {
                                      id: "NEEDS_MORE_DATA",
                                      label: "Pending Line List",
                                      color: "text-amber-400",
                                    },
                                  ]
                                : [
                                    {
                                      id: "VALIDATED",
                                      label: "Findings Verified",
                                      color: "text-emerald-400",
                                    },
                                    {
                                      id: "REJECTED",
                                      label: "Findings Discarded",
                                      color: "text-rose-400",
                                    },
                                  ]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDecision({ ...decision, status: opt.id })
                            }
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                              decision.status === opt.id
                                ? "bg-white/10 border-white/40 ring-4 ring-white/5"
                                : "bg-transparent border-white/5 hover:border-white/20",
                            )}
                          >
                            <span
                              className={cn(
                                "text-xs font-black uppercase tracking-widest",
                                decision.status === opt.id
                                  ? opt.color
                                  : "text-slate-400",
                              )}
                            >
                              {opt.label}
                            </span>
                            {decision.status === opt.id && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason & Corrective Actions */}
              <div className="p-10 bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {item.type === "NSI" ? (
                    <>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Exposure Classification
                          </label>
                          <div className="flex gap-2">
                            {["Significant", "Non-significant"].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setDecision({
                                    ...decision,
                                    classification: `${c} Exposure`,
                                  })
                                }
                                className={cn(
                                  "flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                  decision.classification === `${c} Exposure`
                                    ? "bg-rose-500 text-white border-transparent"
                                    : "bg-white text-slate-400 border-slate-100",
                                )}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Root Cause Determination
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {NSI_CONSTANTS.ROOT_CAUSES.map((r) => (
                              <label
                                key={r}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                  decision.rootCauses.includes(r)
                                    ? "bg-rose-50 border-rose-100 text-rose-700"
                                    : "bg-slate-50 border-transparent text-slate-400",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={decision.rootCauses.includes(r)}
                                  onChange={(e) => {
                                    const newList = e.target.checked
                                      ? [...decision.rootCauses, r]
                                      : decision.rootCauses.filter(
                                          (rc: string) => rc !== r,
                                        );
                                    setDecision({
                                      ...decision,
                                      rootCauses: newList,
                                    });
                                  }}
                                  className="hidden"
                                />
                                <span className="text-[9px] font-black uppercase tracking-tight">
                                  {r}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Contributing Factors
                          </label>
                          <div className="grid grid-cols-1 gap-2">
                            {NSI_CONSTANTS.CONTRIBUTING_FACTORS.map((f) => (
                              <label
                                key={f}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                  decision.contributingFactors.includes(f)
                                    ? "bg-blue-50 border-blue-100 text-blue-700"
                                    : "bg-slate-50 border-transparent text-slate-400",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={decision.contributingFactors.includes(
                                    f,
                                  )}
                                  onChange={(e) => {
                                    const newList = e.target.checked
                                      ? [...decision.contributingFactors, f]
                                      : decision.contributingFactors.filter(
                                          (cf: string) => cf !== f,
                                        );
                                    setDecision({
                                      ...decision,
                                      contributingFactors: newList,
                                    });
                                  }}
                                  className="hidden"
                                />
                                <span className="text-[9px] font-black uppercase tracking-tight">
                                  {f}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Corrective Actions
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {NSI_CONSTANTS.CORRECTIVE_ACTIONS.map((a) => (
                              <label
                                key={a}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                                  decision.correctiveActions.includes(a)
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-slate-50 border-transparent text-slate-400",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={decision.correctiveActions.includes(
                                    a,
                                  )}
                                  onChange={(e) => {
                                    const newList = e.target.checked
                                      ? [...decision.correctiveActions, a]
                                      : decision.correctiveActions.filter(
                                          (ca: string) => ca !== a,
                                        );
                                    setDecision({
                                      ...decision,
                                      correctiveActions: newList,
                                    });
                                  }}
                                  className="hidden"
                                />
                                <span className="text-[9px] font-black uppercase tracking-tight">
                                  {a}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : item.type === "OUTBREAK" ? (
                    <>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Basis for Decision
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            "Epidemiologic Link",
                            "Lab Confirmation",
                            "Above Baseline",
                            "Environmental Findings",
                            "No Evidence of Transmission",
                          ].map((b) => (
                            <label
                              key={b}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                                decision.basis.includes(b)
                                  ? "bg-rose-50 border-rose-100 text-rose-900"
                                  : "bg-slate-50 border-slate-100 text-slate-500",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={decision.basis.includes(b)}
                                onChange={(e) => {
                                  const newList = e.target.checked
                                    ? [...decision.basis, b]
                                    : decision.basis.filter(
                                        (bi: string) => bi !== b,
                                      );
                                  setDecision({ ...decision, basis: newList });
                                }}
                                className="w-5 h-5 rounded-lg text-rose-600"
                              />
                              <span className="text-[10px] font-black uppercase tracking-tight">
                                {b}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Affected Unit(s)
                        </label>
                        <select
                          value={decision.unitsAffected}
                          onChange={(e) =>
                            setDecision({ ...decision, unitsAffected: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                        >
                          <option value="Multiple">Multiple</option>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Closure Date (if applicable)
                        </label>
                        <input
                          type="date"
                          value={decision.dateClosed || ""}
                          onChange={(e) =>
                            setDecision({ ...decision, dateClosed: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Validator Narrative
                        </label>
                        <textarea
                          value={decision.notes || ""}
                          onChange={(e) =>
                            setDecision({ ...decision, notes: e.target.value })
                          }
                          placeholder="Detailed clinical justification for case status change..."
                          className="w-full h-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-xs font-medium outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {item.type === "AUDIT" &&
                        item.originalData.type === "ENV_CLEANING" && (
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Monitoring Method
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {MONITORING_METHODS.map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  onClick={() =>
                                    setDecision({
                                      ...decision,
                                      monitoringMethod: method,
                                    })
                                  }
                                  className={cn(
                                    "px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tight border transition-all text-center",
                                    decision.monitoringMethod === method
                                      ? "bg-slate-900 text-white border-transparent"
                                      : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100",
                                  )}
                                >
                                  {method}
                                </button>
                              ))}
                            </div>

                            {decision.monitoringMethod && (
                              <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDecision({
                                      ...decision,
                                      monitoringStatus: "PASS",
                                    })
                                  }
                                  className={cn(
                                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    decision.monitoringStatus === "PASS"
                                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                      : "text-slate-400 hover:bg-slate-100",
                                  )}
                                >
                                  Passed
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDecision({
                                      ...decision,
                                      monitoringStatus: "FAIL",
                                    })
                                  }
                                  className={cn(
                                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    decision.monitoringStatus === "FAIL"
                                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                                      : "text-slate-400 hover:bg-slate-200",
                                  )}
                                >
                                  Failed
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      {item.type === "BUNDLE" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Clinical Signs Accuracy
                            </label>
                            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                              {["Accurate", "Inaccurate"].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    setDecision({
                                      ...decision,
                                      clinicalAccuracy: s,
                                    })
                                  }
                                  className={cn(
                                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    decision.clinicalAccuracy === s
                                      ? "bg-brand-primary text-white shadow-lg shadow-teal-500/20"
                                      : "text-slate-400 hover:bg-slate-100",
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Bundle Compliance Accuracy
                            </label>
                            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                              {["Accurate", "Correction Needed"].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    setDecision({
                                      ...decision,
                                      complianceAccuracy: s,
                                    })
                                  }
                                  className={cn(
                                    "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    decision.complianceAccuracy === s
                                      ? "bg-brand-primary text-white shadow-lg shadow-teal-500/20"
                                      : "text-slate-400 hover:bg-slate-100",
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Clinical Reasoning / Decision Foundation
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none"
                          value={decision.reason}
                          onChange={(e) =>
                            setDecision({ ...decision, reason: e.target.value })
                          }
                        >
                          <option value="">
                            Select Pre-defined Rationale...
                          </option>
                          {IPCU_REASONING_GROUPS.map((group) => (
                            <optgroup
                              key={group.category}
                              label={group.category}
                            >
                              {group.options.map((opt) => (
                                <option key={opt.value} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <textarea
                          placeholder="Clinical notes / Addendum..."
                          className="w-full h-32 bg-slate-50 border border-slate-200 rounded-3xl p-5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
                          value={decision.notes || ""}
                          onChange={(e) =>
                            setDecision({ ...decision, notes: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Corrective Actions & Directives
                        </label>
                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {IPCU_ACTION_GROUPS.map((group) => (
                            <div key={group.category} className="space-y-3">
                              <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-50 pb-1">
                                {group.category}
                              </h4>
                              <div className="grid grid-cols-1 gap-2">
                                {group.options.map((action) => (
                                  <label
                                    key={action}
                                    className={cn(
                                      "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                                      decision.correctiveActions.includes(
                                        action,
                                      )
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                                        : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100",
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500/20"
                                      checked={decision.correctiveActions.includes(
                                        action,
                                      )}
                                      onChange={(e) => {
                                        const newList = e.target.checked
                                          ? [
                                              ...decision.correctiveActions,
                                              action,
                                            ]
                                          : decision.correctiveActions.filter(
                                              (a: string) => a !== action,
                                            );
                                        setDecision({
                                          ...decision,
                                          correctiveActions: newList,
                                        });
                                      }}
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-tight leading-tight">
                                      {action}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Validator Info & Footer */}
            <div className="shrink-0 p-4 sm:p-8 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 hidden sm:flex">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 border border-slate-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Logged Validator
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    {user?.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 md:flex-none px-6 sm:px-8 py-3 sm:py-4 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !decision.status}
                  className="flex-1 md:flex-none px-8 sm:px-12 py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? "Finalizing..." : isGroupedBundle ? "Validate Selected Day" : "Submit Validation"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
