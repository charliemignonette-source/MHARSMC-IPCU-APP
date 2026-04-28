import React, { useState } from 'react';
import { 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  Microscope, 
  Activity, 
  Database, 
  AlertCircle,
  X,
  Stethoscope,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpCircle,
  FlaskConical,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type ViewMode = 'MENU' | 'SPECIMEN' | 'UNIT' | 'OVERALL' | 'ANTIMICROBIAL_STEWARDSHIP';

const ABX_GLOSSARY = [
  { term: '3GC', full: '3rd Generation Cephalosporins', examples: 'Ceftriaxone, Cefotaxime, Ceftazidime' },
  { term: '4GC', full: '4th Generation Cephalosporins', examples: 'Cefepime' },
  { term: 'TZP', full: 'Piperacillin-Tazobactam', examples: 'Tazocin' },
  { term: 'MEM', full: 'Meropenem', examples: 'Meronem' },
  { term: 'SXT', full: 'Sulfamethoxazole-Trimethoprim', examples: 'Bactrim, Septra' },
  { term: 'FEP', full: 'Cefepime', examples: 'Maxipime' },
  { term: 'CAZ', full: 'Ceftazidime', examples: 'Fortum' },
  { term: 'CRO', full: 'Ceftriaxone', examples: 'Rocephin' },
  { term: 'AMK', full: 'Amikacin', examples: 'Amikin' },
  { term: 'ESBL', full: 'Extended-Spectrum Beta-Lactamase', note: 'Resistance mechanism against most 3GCs' },
];

const EMPIRIC_GUIDE = [
  {
    infection: 'Urinary Tract Infection (UTI)',
    pathogens: 'E. coli, Klebsiella, Proteus',
    recommendations: [
      { agent: 'Nitrofurantoin', status: 'GREEN ✔', note: 'First-line for cystitis if Susceptibility >90%' },
      { agent: 'Carbapenems', status: 'GREEN ✔', note: 'Reserved for suspected ESBL-producing organisms' },
      { agent: 'Ciprofloxacin', status: 'RED ✖', note: 'High resistance (~56%). Avoid for empiric use.' }
    ]
  },
  {
    infection: 'Respiratory / HAP / VAP',
    pathogens: 'Pseudomonas, Acinetobacter, S. aureus',
    recommendations: [
      { agent: 'Piperacillin-Tazobactam', status: 'YELLOW ⚠', note: 'Moderate susceptibility. Consider for Pseudomonas.' },
      { agent: 'Cefepime', status: 'YELLOW ⚠', note: 'Empiric coverage for GNRs. Check local ICU rates.' },
      { agent: 'Vancomycin', status: 'GREEN ✔', note: 'Add if MRSA risk factors are present.' }
    ]
  },
  {
    infection: 'Bloodstream / Sepsis',
    pathogens: 'S. aureus, GNRs, Candida (Blood only)',
    recommendations: [
      { agent: 'Meropenem + Vancomycin', status: 'GREEN ✔', note: 'Broad spectrum for high-risk septic shock.' },
      { agent: 'Fluconazole/Echinocandin', status: 'ORANGE ⬆', note: 'Mandatory if Candida isolated from blood.' }
    ]
  },
  {
    infection: 'Skin & Soft Tissue (SSTI)',
    pathogens: 'S. aureus (MRSA risk), GNRs (if complex)',
    recommendations: [
      { agent: 'Cloxacillin/Oxacillin', status: 'GREEN ✔', note: 'First-line for MSSA (~85% susceptible).' },
      { agent: 'Clindamycin', status: 'YELLOW ⚠', note: 'Check local MRSA rates (~66-75% susceptible).' },
      { agent: 'Vancomycin', status: 'GREEN ✔', note: 'If MRSA suspected or severe necrotizing.' }
    ]
  }
];
type SpecimenType = 'BLOOD' | 'URINE' | 'RESPIRATORY' | 'EXUDATES';
type UnitType = 'ICU' | 'PICU' | 'NICU';

interface PathogenData {
  name: string;
  total: number;
  patterns: {
    drug: string;
    value: number;
    flag?: string;
  }[];
  mechanisms?: string[];
}

const PATHOGENS: PathogenData[] = [
  {
    name: 'Klebsiella pneumoniae',
    total: 474,
    mechanisms: ['ESBL ⬆'],
    patterns: [
      { drug: 'TZP', value: 78.5 },
      { drug: 'MEM', value: 85.1 },
      { drug: 'CAZ', value: 39.5 },
      { drug: 'FEP', value: 45.1 },
      { drug: 'CRO', value: 41.5 }
    ]
  },
  {
    name: 'Escherichia coli',
    total: 493,
    mechanisms: ['ESBL ⬆'],
    patterns: [
      { drug: 'TZP', value: 81.5 },
      { drug: 'MEM', value: 87.7 },
      { drug: 'IPM', value: 80.8 },
      { drug: 'CAZ', value: 48.9 },
      { drug: 'CRO', value: 50.1 },
      { drug: 'NIT', value: 90.2 }
    ]
  },
  {
    name: 'Acinetobacter baumannii',
    total: 161,
    mechanisms: ['Carbapenem-resistant ⬆'],
    patterns: [
      { drug: 'Carbapenems', value: 16 },
      { drug: 'FEP', value: 32 },
      { drug: 'CAZ', value: 25 }
    ]
  },
  {
    name: 'Staphylococcus aureus',
    total: 168,
    mechanisms: ['MRSA ~40% ⬆'],
    patterns: [
      { drug: 'OXA', value: 84.7 },
      { drug: 'CLI', value: 70.6 },
      { drug: 'SXT', value: 88.2 },
      { drug: 'VAN', value: 100 },
      { drug: 'LNZ', value: 100 }
    ]
  },
  {
    name: 'Enterobacter cloacae complex',
    total: 112,
    patterns: [
      { drug: 'FEP', value: 69.2 },
      { drug: 'CAZ', value: 52.5 },
      { drug: 'MEM', value: 88.5 }
    ]
  },
  {
    name: 'Pseudomonas aeruginosa',
    total: 101,
    patterns: [
      { drug: 'CAZ', value: 75.5 },
      { drug: 'FEP', value: 73.6 },
      { drug: 'TZP', value: 92.4 },
      { drug: 'MEM', value: 72.1 }
    ]
  },
  {
    name: 'Proteus mirabilis',
    total: 17,
    patterns: [
      { drug: 'CRO', value: 100 },
      { drug: 'CAZ', value: 85.7 },
      { drug: 'FEP', value: 85.7 },
      { drug: 'MEM', value: 100 },
      { drug: 'CIP', value: 57.1 }
    ]
  }
];

const DATA_BY_SPECIMEN: Record<SpecimenType, PathogenData[]> = {
  BLOOD: [
    { name: 'Staphylococcus aureus', total: 90, patterns: [{ drug: 'OXA', value: 84.7 }, { drug: 'CLI', value: 66.2 }, { drug: 'SXT', value: 86.9 }, { drug: 'VAN', value: 100 }, { drug: 'LNZ', value: 100 }] },
    { name: 'Klebsiella pneumoniae', total: 84, patterns: [{ drug: 'TZP', value: 79.5 }, { drug: 'CAZ', value: 43.6 }, { drug: 'FEP', value: 42.5 }, { drug: 'CRO', value: 48.7 }, { drug: 'MEM', value: 90.2 }, { drug: 'IPM', value: 57.5 }] },
    { name: 'Escherichia coli', total: 51, patterns: [{ drug: 'TZP', value: 82.6 }, { drug: 'CAZ', value: 50 }, { drug: 'FEP', value: 68.2 }, { drug: 'CRO', value: 52.9 }, { drug: 'MEM', value: 94.1 }, { drug: 'IPM', value: 88.9 }] },
    { name: 'Acinetobacter baumannii', total: 69, patterns: [{ drug: 'Carbapenems', value: 17.5 }, { drug: 'FEP', value: 41.7 }, { drug: 'CAZ', value: 30.2 }] },
    { name: 'Enterobacter cloacae', total: 26, patterns: [{ drug: 'FEP', value: 76.9 }, { drug: 'CAZ', value: 83.3 }, { drug: 'MEM', value: 100 }] },
    { name: 'Pseudomonas aeruginosa', total: 17, patterns: [{ drug: 'CAZ', value: 90.9 }, { drug: 'FEP', value: 88.9 }, { drug: 'TZP', value: 90.9 }, { drug: 'MEM', value: 81.8 }] }
  ],
  URINE: [
    { name: 'Escherichia coli', total: 235, patterns: [{ drug: 'NIT', value: 90.2 }, { drug: 'MEM', value: 92.7 }, { drug: 'IPM', value: 78.7 }, { drug: 'CAZ', value: 47.5 }, { drug: 'CRO', value: 44.2 }, { drug: 'CIP', value: 44.4 }] },
    { name: 'Klebsiella pneumoniae', total: 79, patterns: [{ drug: 'TZP', value: 56.3 }, { drug: 'CAZ', value: 35.3 }, { drug: 'FEP', value: 36 }, { drug: 'CRO', value: 34.6 }, { drug: 'MEM', value: 82.4 }, { drug: 'IPM', value: 61 }] },
    { name: 'Proteus mirabilis', total: 17, patterns: [{ drug: 'CRO', value: 100 }, { drug: 'CAZ', value: 85.7 }, { drug: 'FEP', value: 85.7 }, { drug: 'MEM', value: 100 }, { drug: 'CIP', value: 57.1 }] },
    { name: 'Enterobacter cloacae', total: 20, patterns: [{ drug: 'FEP', value: 66.7 }, { drug: 'CAZ', value: 22.2 }, { drug: 'MEM', value: 87.5 }] }
  ],
  EXUDATES: [
    { name: 'Klebsiella pneumoniae', total: 266, patterns: [{ drug: 'TZP', value: 77.1 }, { drug: 'CAZ', value: 49.5 }, { drug: 'FEP', value: 58.1 }, { drug: 'MEM', value: 81 }] },
    { name: 'Escherichia coli', total: 189, patterns: [{ drug: 'TZP', value: 80.3 }, { drug: 'CAZ', value: 48.8 }, { drug: 'FEP', value: 55.2 }, { drug: 'MEM', value: 76.4 }] },
    { name: 'Staphylococcus aureus', total: 73, patterns: [{ drug: 'OXA', value: 89.3 }, { drug: 'CLI', value: 75 }, { drug: 'SXT', value: 89.5 }, { drug: 'VAN', value: 100 }] },
    { name: 'Pseudomonas aeruginosa', total: 68, patterns: [{ drug: 'CAZ', value: 60.6 }, { drug: 'FEP', value: 58.3 }, { drug: 'TZP', value: 93.9 }, { drug: 'MEM', value: 62.5 }] },
    { name: 'Acinetobacter baumannii', total: 20, patterns: [{ drug: 'Carbapenems', value: 10 }] },
    { name: 'Enterobacter cloacae', total: 66, patterns: [{ drug: 'FEP', value: 64 }, { drug: 'CAZ', value: 52 }, { drug: 'MEM', value: 78 }] }
  ],
  RESPIRATORY: [
    { name: 'Pseudomonas aeruginosa', total: 28, patterns: [{ drug: 'CAZ', value: 70.6 }, { drug: 'FEP', value: 70.6 }, { drug: 'TZP', value: 93.3 }, { drug: 'MEM', value: 81.8 }, { drug: 'IPM', value: 81.8 }, { drug: 'AMK', value: 86.7 }, { drug: 'CIP', value: 61.5 }] },
    { name: 'Klebsiella pneumoniae', total: 283, patterns: [{ drug: 'TZP', value: 53.7 }, { drug: 'CAZ', value: 34.3 }, { drug: 'FEP', value: 36.1 }, { drug: 'CRO', value: 11.2 }, { drug: 'MEM', value: 87 }, { drug: 'IPM', value: 82.4 }, { drug: 'AMK', value: 87.2 }] },
    { name: 'Acinetobacter baumannii', total: 112, patterns: [{ drug: 'CAZ', value: 0 }, { drug: 'FEP', value: 0 }, { drug: 'TZP', value: 0 }, { drug: 'MEM', value: 4 }, { drug: 'IPM', value: 4 }, { drug: 'AMK', value: 60 }, { drug: 'CIP', value: 36.9 }] },
    { name: 'Escherichia coli', total: 48, patterns: [{ drug: 'TZP', value: 55.6 }, { drug: 'CAZ', value: 56 }, { drug: 'FEP', value: 53.8 }, { drug: 'CRO', value: 46.2 }, { drug: 'MEM', value: 60.9 }, { drug: 'IPM', value: 82.9 }, { drug: 'AMK', value: 76.9 }] },
    { name: 'Enterobacter cloacae', total: 42, patterns: [{ drug: 'FEP', value: 82.4 }, { drug: 'CAZ', value: 82.4 }, { drug: 'TZP', value: 79.2 }, { drug: 'MEM', value: 100 }, { drug: 'IPM', value: 100 }, { drug: 'AMK', value: 94.1 }] },
    { name: 'Enterobacter gergoviae', total: 25, patterns: [{ drug: 'FEP', value: 88 }, { drug: 'CAZ', value: 88 }, { drug: 'MEM', value: 89.5 }, { drug: 'IPM', value: 68 }, { drug: 'AMK', value: 59.1 }] },
    { name: 'Klebsiella pneumoniae (ozaenae)', total: 24, patterns: [{ drug: 'CAZ', value: 83.3 }, { drug: 'FEP', value: 79.2 }, { drug: 'MEM', value: 75 }, { drug: 'IPM', value: 66.7 }] }
  ]
};

const DATA_BY_UNIT: Record<UnitType, PathogenData[]> = {
  ICU: [
    { name: 'Acinetobacter baumannii', total: 45, patterns: [{ drug: 'Carbapenems', value: 7 }, { drug: 'CAZ', value: 7.9 }, { drug: 'FEP', value: 14.7 }] },
    { name: 'Klebsiella pneumoniae', total: 45, patterns: [{ drug: 'TZP', value: 33 }, { drug: 'CAZ', value: 23 }, { drug: 'FEP', value: 36.7 }, { drug: 'MEM', value: 78.6 }] },
    { name: 'Escherichia coli', total: 18, patterns: [{ drug: 'MEM', value: 100 }, { drug: 'IPM', value: 75 }, { drug: 'CAZ', value: 0 }, { drug: 'FEP', value: 0 }] },
    { name: 'Pseudomonas aeruginosa', total: 12, patterns: [{ drug: 'CAZ', value: 80 }, { drug: 'FEP', value: 80 }, { drug: 'TZP', value: 60 }, { drug: 'MEM', value: 57 }] },
    { name: 'Staphylococcus aureus', total: 5, patterns: [{ drug: 'OXA', value: 80 }, { drug: 'VAN', value: 100 }] }
  ],
  PICU: [
    { name: 'Klebsiella pneumoniae', total: 9, patterns: [{ drug: 'CAZ', value: 75 }, { drug: 'FEP', value: 0 }, { drug: 'MEM', value: 50 }] },
    { name: 'Escherichia coli', total: 8, patterns: [{ drug: 'MEM', value: 100 }, { drug: 'CAZ', value: 57 }, { drug: 'FEP', value: 57 }] },
    { name: 'Acinetobacter baumannii', total: 7, patterns: [{ drug: 'Carbapenems', value: 16.5 }] },
    { name: 'Pseudomonas aeruginosa', total: 7, patterns: [{ drug: 'CAZ', value: 60 }, { drug: 'FEP', value: 60 }, { drug: 'MEM', value: 60 }] }
  ],
  NICU: [
    { name: 'Klebsiella pneumoniae', total: 20, patterns: [{ drug: 'CAZ', value: 33 }, { drug: 'FEP', value: 0 }, { drug: 'MEM', value: 50 }] },
    { name: 'Klebsiella aerogenes', total: 15, patterns: [{ drug: 'FEP', value: 100 }, { drug: 'CAZ', value: 100 }, { drug: 'MEM', value: 100 }] },
    { name: 'Serratia marcescens', total: 7, patterns: [{ drug: 'FEP', value: 100 }, { drug: 'CAZ', value: 100 }] },
    { name: 'Staphylococcus aureus', total: 5, patterns: [{ drug: 'OXA', value: 40 }, { drug: 'VAN', value: 100 }] },
    { name: 'Pseudomonas aeruginosa', total: 4, patterns: [{ drug: 'CAZ', value: 0 }, { drug: 'FEP', value: 0 }, { drug: 'MEM', value: 50 }] }
  ]
};

const SPECIMEN_MAP: Record<SpecimenType, string[]> = {
  BLOOD: ['Staphylococcus aureus', 'Klebsiella pneumoniae', 'Escherichia coli', 'Acinetobacter baumannii', 'Enterobacter cloacae', 'Pseudomonas aeruginosa', 'Candida spp.'],
  URINE: ['Escherichia coli', 'Klebsiella pneumoniae', 'Proteus mirabilis', 'Enterobacter cloacae'],
  RESPIRATORY: ['Pseudomonas aeruginosa', 'Klebsiella pneumoniae', 'Acinetobacter baumannii', 'Escherichia coli', 'Enterobacter cloacae', 'Enterobacter gergoviae', 'Klebsiella pneumoniae (ozaenae)'],
  EXUDATES: ['Klebsiella pneumoniae', 'Escherichia coli', 'Staphylococcus aureus', 'Pseudomonas aeruginosa', 'Acinetobacter baumannii', 'Enterobacter cloacae']
};

const SPECIMEN_TOTALS: Record<SpecimenType, number> = {
  BLOOD: 10698,
  URINE: 1766,
  RESPIRATORY: 1617,
  EXUDATES: 3885
};

export default function Antibiogram() {
  const [view, setView] = useState<ViewMode>('MENU');
  const [specimen, setSpecimen] = useState<SpecimenType | null>(null);
  const [unit, setUnit] = useState<UnitType | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleBack = () => {
    setView('MENU');
    setSpecimen(null);
    setUnit(null);
    setExpanded(null);
  };

  const getStatus = (val: number) => {
    if (val >= 90) return { color: 'text-emerald-700 bg-emerald-100 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, label: 'GREEN ✔' };
    if (val >= 70) return { color: 'text-amber-700 bg-amber-100 border-amber-200', icon: <AlertTriangle className="w-3 h-3" />, label: 'YELLOW ⚠' };
    return { color: 'text-rose-700 bg-rose-100 border-rose-200', icon: <XCircle className="w-3 h-3" />, label: 'RED ✖' };
  };

  const PathogenCard = ({ pathogen }: { pathogen: PathogenData | string; key?: React.Key }) => {
    let data = typeof pathogen === 'string' 
      ? PATHOGENS.find(p => p.name === pathogen) 
      : pathogen;

    // Check for specimen specific data if in specimen view
    if (specimen && typeof pathogen === 'string') {
      const specimenData = DATA_BY_SPECIMEN[specimen]?.find(p => p.name === pathogen);
      if (specimenData) data = specimenData;
    }

    // Check for unit specific data if in unit view
    if (unit && typeof pathogen === 'string') {
      const unitData = DATA_BY_UNIT[unit]?.find(p => p.name === pathogen);
      if (unitData) data = unitData;
    }
    
    if (pathogen === 'Candida spp.') {
      return (
        <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-purple-600" />
            <h4 className="text-xs font-black text-purple-900 uppercase italic">Candida spp.</h4>
          </div>
          <p className="text-[10px] text-purple-700 font-medium leading-relaxed">
            Always clinically significant in blood. Requires antifungal therapy. Not part of bacterial susceptibility panel.
          </p>
        </div>
      );
    }

    if (!data) return null;

    const isExpanded = expanded === data.name;

    return (
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
        <button 
          onClick={() => setExpanded(isExpanded ? null : data.name)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900 italic uppercase leading-none">{data.name}</h3>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data.total} Isolates</span>
               {data.mechanisms?.map(m => (
                 <span key={m} className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full text-[8px] font-black uppercase tracking-tighter">
                   {m}
                 </span>
               ))}
            </div>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-5 pb-5 pt-0"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-50 pt-4">
                {data.patterns.map((p, i) => {
                  const status = getStatus(p.value);
                  return (
                    <div key={i} className={cn("p-3 rounded-2xl border flex flex-col gap-1", status.color)}>
                      <span className="text-[8px] font-black uppercase tracking-tight opacity-70 truncate">{p.drug}</span>
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-black">{p.value}%</span>
                         {status.icon}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const SectionHeader = ({ title, onBack }: { title: string, onBack: () => void }) => (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 hover:bg-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{title}</h2>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in duration-500">
      {/* Dynamic Header */}
      <div className="text-center space-y-4 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-brand-primary/20">
          <Database className="w-3 h-3" />
          2025 Clinical Antibiogram
        </div>
        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">Guard Dashboard</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Institutional Resistance Data Summary</p>
      </div>

      <AnimatePresence mode="wait">
        {view === 'MENU' && (
          <motion.div 
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Quick Legend for User */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               {[
                 { label: 'Green', text: 'Empiric Choice', color: 'bg-emerald-500', icon: '✔' },
                 { label: 'Yellow', text: 'Caution/Dose', color: 'bg-amber-500', icon: '⚠' },
                 { label: 'Red', text: 'Avoid Empiric', color: 'bg-rose-500', icon: '✖' },
                 { label: 'Orange', text: 'Resistance Flag', color: 'bg-orange-500', icon: '⬆' }
               ].map(l => (
                 <div key={l.label} className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-2xl">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white font-black", l.color)}>{l.icon}</div>
                    <div className="flex flex-col">
                       <span className="text-[8px] font-black uppercase text-slate-400 leading-none">{l.label}</span>
                       <span className="text-[9px] font-bold text-slate-900 leading-tight">{l.text}</span>
                    </div>
                 </div>
               ))}
            </div>

            {/* Resistance Mechanism Rates - Now static on main dashboard */}
            <div className="space-y-4">
               <div className="flex items-center gap-3 px-4">
                  <ArrowUpCircle className="w-5 h-5 text-orange-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest text-center">Resistance Mechanism Rates</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'ESBL Rate', value: '~38%', note: 'E. coli + Klebsiella', status: 'ORANGE ⬆' },
                    { label: 'MRSA Rate', value: '~42%', note: 'Staphylococcus aureus', status: 'ORANGE ⬆' },
                    { label: 'CRE Rate', value: '~11%', note: 'Carbapenem-resistant', status: 'ORANGE ⬆' }
                  ].map((rate, r) => (
                    <div key={r} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-center">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{rate.label}</div>
                      <div className="text-3xl font-black text-slate-900">{rate.value}</div>
                      <div className="text-[8px] font-black text-orange-500 uppercase">{rate.status}</div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'SPECIMEN', label: 'Filter by Specimen Type', icon: Microscope, color: 'bg-indigo-600' },
                { id: 'UNIT', label: 'Filter by High-Risk Unit', icon: ShieldAlert, color: 'bg-rose-600' },
                { id: 'OVERALL', label: 'Top Clinical Pathogens', icon: Activity, color: 'bg-emerald-600' },
                { id: 'ANTIMICROBIAL_STEWARDSHIP', label: 'Antimicrobial Stewardship', icon: Stethoscope, color: 'bg-teal-600' }
              ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setView(btn.id as ViewMode)}
                className="p-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex items-center gap-5 group"
              >
                <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl text-white shadow-lg", btn.color)}>
                  <btn.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    {btn.id === 'ANTIMICROBIAL_STEWARDSHIP' ? 'Antimicrobial Stewardship' : 'Insight'}
                  </p>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{btn.label}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-brand-primary transition-colors" />
              </button>
            ))}
            </div>

            {/* Antibiotic Identification - Footnote style legened */}
            <div className="pt-8 px-4">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 border-r border-slate-200 pr-4 mr-2">
                  <FlaskConical className="w-3 h-3 text-slate-400" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Legend:</span>
                </div>
                {ABX_GLOSSARY.map((g, gi) => (
                  <div key={gi} className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-[8px] font-black text-slate-900 uppercase">{g.term}</span>
                    <span className="text-[8px] font-medium text-slate-500 uppercase">({g.full})</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {view === 'SPECIMEN' && (
          <motion.div key="specimen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SectionHeader title="Select Specimen Type" onBack={handleBack} />
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(SPECIMEN_MAP).map(type => (
                <button
                  key={type}
                  onClick={() => { setSpecimen(type as SpecimenType); setExpanded(null); }}
                  className={cn(
                    "p-5 rounded-3xl border transition-all text-center flex flex-col items-center gap-1",
                    specimen === type ? "bg-slate-900 text-white border-slate-900 shadow-xl" : "bg-white border-slate-100 text-slate-900"
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">{type}</p>
                  <p className="text-[8px] font-black opacity-40">{SPECIMEN_TOTALS[type as SpecimenType]} TOTAL</p>
                </button>
              ))}
            </div>
            {specimen && (
              <div className="space-y-4 pt-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Significant Pathogens ({specimen})</h4>
                <div className="grid grid-cols-1 gap-4">
                  {SPECIMEN_MAP[specimen].map(pathogen => <PathogenCard key={pathogen} pathogen={pathogen} />)}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'OVERALL' && (
          <motion.div key="overall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SectionHeader title="Top Clinical Pathogens" onBack={handleBack} />
            <div className="grid grid-cols-1 gap-4">
              {PATHOGENS.map(pathogen => <PathogenCard key={pathogen.name} pathogen={pathogen} />)}
            </div>
          </motion.div>
        )}


        {view === 'UNIT' && (
          <motion.div key="unit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SectionHeader title="Select High-Risk Unit" onBack={handleBack} />
            <div className="grid grid-cols-3 gap-3">
              {(['ICU', 'PICU', 'NICU'] as UnitType[]).map(u => (
                <button
                  key={u}
                  onClick={() => { setUnit(u); setExpanded(null); }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-[10px] font-black uppercase",
                    unit === u ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-100 text-slate-900"
                  )}
                >
                  {u}
                </button>
              ))}
            </div>

            {unit && (
              <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {unit === 'ICU' && (
                  <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl space-y-6 border-b-4 border-rose-600">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-6 h-6 text-rose-500" />
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">ICU Resistance Alerts</h3>
                        <p className="text-[10px] text-slate-400 font-bold italic">Warning: ICU isolates show significantly higher resistance than ward isolates</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { name: 'A. baumannii', note: 'Carbapenem-R ✖', status: 'RED ✖' },
                        { name: 'K. pneumoniae', note: 'High ESBL prevalence ⬆', status: 'ORANGE ⬆' },
                        { name: 'P. aeruginosa', note: 'MDR Risk ~30% ⚠', status: 'YELLOW ⚠' },
                        { name: 'S. aureus', note: 'MRSA rate >40% ⬆', status: 'ORANGE ⬆' }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/10">
                          <span className="text-[11px] font-black italic">{item.name}</span>
                          <span className={cn(
                            "text-[10px] font-black px-2 py-1 rounded-lg bg-opacity-10",
                            item.status.includes('RED') ? 'text-rose-400 bg-rose-400' : 
                            item.status.includes('YELLOW') ? 'text-amber-400 bg-amber-400' : 'text-orange-400 bg-orange-400'
                          )}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                    {unit} Clinically Significant Pathogens
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {DATA_BY_UNIT[unit]?.map(pathogen => (
                      <PathogenCard key={pathogen.name} pathogen={pathogen} />
                    ))}
                    {/* Footnote for Candida in unit view */}
                    {unit && (
                      <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-purple-600" />
                        <span className="text-[10px] text-purple-700 font-bold uppercase italic">
                          Candida spp. ({unit === 'ICU' ? '8' : unit === 'PICU' ? '2' : '3'} Blood Isolates) included
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {view === 'ANTIMICROBIAL_STEWARDSHIP' && (
          <motion.div key="antimicrobial_stewardship" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <SectionHeader title="Antimicrobial Stewardship" onBack={handleBack} />
            
            {/* 1. Traffic Light Rules */}
            <div className="p-8 bg-rose-50 rounded-[3rem] border border-rose-100 space-y-8">
               <div className="flex items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                  <div>
                    <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">Traffic Light Rules</h3>
                    <p className="text-[10px] font-bold text-rose-600">Empiric selection based on susceptibility %</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 bg-white rounded-[2rem] border border-rose-100 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">GREEN ✔ (≥90%)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">Recommended. High probability of clinical success. Optimal for empiric use.</p>
                  </div>
                  <div className="p-5 bg-white rounded-[2rem] border border-rose-100 space-y-3">
                    <div className="flex items-center gap-2 text-amber-500">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">YELLOW ⚠ (70-89%)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">Use with caution. Consider loading dose or combination therapy.</p>
                  </div>
                  <div className="p-5 bg-white rounded-[2rem] border border-rose-100 space-y-3">
                    <div className="flex items-center gap-2 text-rose-600">
                      <XCircle className="w-5 h-5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">RED ✖ (&lt;70%)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">Avoid. High resistance risk. Not appropriate for empiric MONOTHERAPY.</p>
                  </div>
               </div>
            </div>

            {/* 2. Empiric Choice Guide */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-4">
                <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Empiric Choice Guide</h3>
              </div>
              <div className="space-y-4">
                {EMPIRIC_GUIDE.map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm space-y-4">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.infection}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase italic">Common Pathogens: {item.pathogens}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       {item.recommendations.map((rec, rIdx) => (
                         <div key={rIdx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-slate-900 uppercase">{rec.agent}</span>
                               <span className="text-[9px] text-slate-500 italic leading-tight">{rec.note}</span>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase whitespace-nowrap",
                              rec.status.includes('GREEN') ? 'bg-emerald-100 text-emerald-700' :
                              rec.status.includes('YELLOW') ? 'bg-amber-100 text-amber-700' :
                              rec.status.includes('RED') ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'
                            )}>
                               {rec.status}
                            </span>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Antibiotic Identification (Glossary) - REMOVED, now on main dashboard */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-6 bg-slate-50 rounded-3xl text-center space-y-2">
                  <Microscope className="w-6 h-6 text-brand-primary mx-auto" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-900">Pre-Culture Only</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-3xl text-center space-y-2">
                  <Activity className="w-6 h-6 text-brand-primary mx-auto" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-900">Daily Dose Optimization</p>
               </div>
               <div className="p-6 bg-slate-50 rounded-3xl text-center space-y-2">
                  <ShieldAlert className="w-6 h-6 text-brand-primary mx-auto" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-900">Stewardship Approval Required</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
