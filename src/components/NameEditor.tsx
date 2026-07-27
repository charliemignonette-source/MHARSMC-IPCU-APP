import React, { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const COMMON_NAMES = [
  "DR. MISHELLE VONNABIE O. BALA",
  "DR. JULIE ROSE C. CAPUYAN",
  "BEA KATRINA M. CHAVEZ",
  "FEBE MAE S. CORONEL",
  "JADE LOUIE DICO",
  "JEDD KRIZEL T. JUMALON",
  "BELZARINO MACAMAY JR",
  "SYDAVE NATHANIEL MANUGAS",
  "MARY IRENE SAA",
  "JUNEDEEN MAE G. SALOMON",
  "NOREEN Y. SOLITANA",
  "MARY JOY R. YAP",
  "IBEN AL O. ZAMORA",
  "APRIL ROSE DE LEON"
];

interface NameEditorProps {
  currentName: string;
  onSave: (newName: string) => Promise<void>;
  canEdit: boolean;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  buttonClassName?: string;
  fallbackName?: string;
}

export function NameEditor({
  currentName,
  onSave,
  canEdit,
  className,
  textClassName,
  iconClassName,
  buttonClassName,
  fallbackName = "System"
}: NameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentName || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!value || value === currentName) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(value);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save name:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(false);
    setValue(currentName || "");
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)} onClick={e => e.stopPropagation()}>
        <input
          type="text"
          list="common-names"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave(e as any);
            if (e.key === 'Escape') handleCancel(e as any);
          }}
          className="text-xs font-bold border border-slate-300 rounded px-2 py-1 outline-none bg-white max-w-[200px] text-slate-900"
          autoFocus
          placeholder="Enter name..."
        />
        <datalist id="common-names">
          {COMMON_NAMES.map(n => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button onClick={handleSave} disabled={isSaving} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCancel} disabled={isSaving} className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={textClassName}>{currentName || fallbackName}</span>
      {canEdit && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setValue(currentName || "");
            setIsEditing(true);
          }}
          className={cn("p-1 transition-colors shrink-0", buttonClassName || "hover:bg-slate-200 rounded text-slate-400")}
          title="Edit Name"
        >
          <Edit3 className={cn("w-3.5 h-3.5", iconClassName)} />
        </button>
      )}
    </div>
  );
}
