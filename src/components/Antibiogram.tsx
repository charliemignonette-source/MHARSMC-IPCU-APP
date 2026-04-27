import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  TrendingUp, 
  AlertCircle,
  ChevronDown,
  Info,
  Beaker
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface OrganismData {
  organism: string;
  source: 'BLOOD' | 'URINE' | 'RESPIRATORY' | 'SURFACE';
  isolates: number;
  sensitivities: {
    [antibiotic: string]: number; // Percentage sensitive
  };
}

const ANTIGRAM_DATA: OrganismData[] = [
  {
    organism: 'Escherichia coli',
    source: 'BLOOD',
    isolates: 142,
    sensitivities: {
      'Amikacin': 98,
      'Gentamicin': 72,
      'Ceftriaxone': 45,
      'Ceftazidime': 43,
      'Cefepime': 48,
      'Piperacillin-Tazobactam': 82,
      'Meropenem': 99,
      'Imipenem': 99,
      'Ertapenem': 96,
      'Ciprofloxacin': 32,
      'Levofloxacin': 34,
      'Nitrofurantoin': 92,
      'Colistin': 100
    }
  },
  {
    organism: 'Klebsiella pneumoniae',
    source: 'BLOOD',
    isolates: 98,
    sensitivities: {
      'Amikacin': 88,
      'Gentamicin': 64,
      'Ceftriaxone': 22,
      'Ceftazidime': 24,
      'Cefepime': 26,
      'Piperacillin-Tazobactam': 58,
      'Meropenem': 84,
      'Imipenem': 82,
      'Ertapenem': 78,
      'Ciprofloxacin': 28,
      'Levofloxacin': 30,
      'Colistin': 98
    }
  },
  {
    organism: 'Pseudomonas aeruginosa',
    source: 'RESPIRATORY',
    isolates: 76,
    sensitivities: {
      'Amikacin': 92,
      'Gentamicin': 88,
      'Ceftazidime': 84,
      'Cefepime': 82,
      'Piperacillin-Tazobactam': 85,
      'Meropenem': 78,
      'Imipenem': 74,
      'Ciprofloxacin': 68,
      'Levofloxacin': 65,
      'Colistin': 100
    }
  },
  {
    organism: 'Acinetobacter baumannii',
    source: 'RESPIRATORY',
    isolates: 112,
    sensitivities: {
      'Amikacin': 24,
      'Gentamicin': 18,
      'Piperacillin-Tazobactam': 12,
      'Meropenem': 10,
      'Imipenem': 8,
      'Colistin': 96,
      'Tigecycline': 88
    }
  },
  {
    organism: 'Staphylococcus aureus (MSSA)',
    source: 'SURFACE',
    isolates: 64,
    sensitivities: {
      'Oxacillin': 100,
      'Cefazolin': 100,
      'Clindamycin': 88,
      'Erythromycin': 72,
      'Levofloxacin': 92,
      'Linezolid': 100,
      'Vancomycin': 100
    }
  },
  {
    organism: 'Staphylococcus aureus (MRSA)',
    source: 'BLOOD',
    isolates: 28,
    sensitivities: {
      'Oxacillin': 0,
      'Cefazolin': 0,
      'Clindamycin': 42,
      'Levofloxacin': 18,
      'Linezolid': 100,
      'Vancomycin': 100,
      'Teicoplanin': 100
    }
  },
];

const ANTIBIOTICS_LIST = [
  'Amikacin', 'Gentamicin', 'Ceftriaxone', 'Ceftazidime', 'Cefepime', 
  'Piperacillin-Tazobactam', 'Meropenem', 'Imipenem', 'Ertapenem',
  'Ciprofloxacin', 'Levofloxacin', 'Nitrofurantoin', 'Colistin',
  'Oxacillin', 'Linezolid', 'Vancomycin', 'Tigecycline'
];

export default function Antibiogram({ user }: { user: UserProfile | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');

  const filteredData = ANTIGRAM_DATA.filter(item => {
    const matchesSearch = item.organism.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = selectedSource === 'ALL' || item.source === selectedSource;
    return matchesSearch && matchesSource;
  });

  const getSensitivityColor = (value: number | undefined) => {
    if (value === undefined) return 'text-slate-300 bg-slate-50/50';
    if (value >= 90) return 'text-emerald-700 bg-emerald-50 font-bold';
    if (value >= 60) return 'text-amber-700 bg-amber-50';
    return 'text-rose-700 bg-rose-50 font-medium';
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cumulative Antibiogram</h1>
          <p className="text-xs text-slate-500 font-medium">Local antimicrobial sensitivity patterns (Jan-Dec 2025)</p>
        </div>
        <div className="flex items-center gap-2">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
             <Download className="w-3.5 h-3.5" />
             Export PDF
           </button>
           <div className="flex items-center gap-2 px-3 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest border border-brand-primary/20">
              <TrendingUp className="w-3.5 h-3.5" />
              Trend Updates Weekly
           </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search organisms (e.g. E. coli, Klebsiella)..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
           <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <select 
             className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs appearance-none focus:ring-2 focus:ring-brand-primary outline-none shadow-sm font-bold text-slate-700"
             value={selectedSource}
             onChange={(e) => setSelectedSource(e.target.value)}
           >
             <option value="ALL">All Sources</option>
             <option value="BLOOD">Blood Stream</option>
             <option value="URINE">Urinary Tract</option>
             <option value="RESPIRATORY">Respiratory</option>
             <option value="SURFACE">Surface/Wound</option>
           </select>
           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-center gap-2 shadow-sm">
           <Beaker className="w-4 h-4 text-brand-primary" />
           <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">N = {filteredData.reduce((acc, curr) => acc + curr.isolates, 0)} Isolate(s)</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="sticky left-0 z-20 bg-slate-50 py-5 px-6 border-b border-r border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest min-w-[240px]">Organism (Source)</th>
                <th className="py-5 px-4 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center whitespace-nowrap min-w-[70px]">Isolates</th>
                {ANTIBIOTICS_LIST.map(drug => (
                  <th key={drug} className="py-5 px-4 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center min-w-[100px] hover:bg-slate-100 transition-colors">
                    {drug}
                  </th>
                )) }
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-4 px-6 border-b border-r border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-900 italic">{item.organism}</span>
                      <div className="flex items-center gap-2 mt-1">
                         <span className={cn(
                           "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                           item.source === 'BLOOD' ? "bg-rose-100 text-rose-700" :
                           item.source === 'URINE' ? "bg-blue-100 text-blue-700" :
                           item.source === 'RESPIRATORY' ? "bg-amber-100 text-amber-700" :
                           "bg-slate-100 text-slate-600"
                         )}>
                           {item.source}
                         </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 border-b border-slate-100 text-center">
                    <span className="text-xs font-bold text-slate-500">{item.isolates}</span>
                  </td>
                  {ANTIBIOTICS_LIST.map(drug => {
                    const val = item.sensitivities[drug];
                    return (
                      <td key={drug} className="py-4 px-4 border-b border-slate-100 text-center">
                        <div className={cn(
                          "inline-flex items-center justify-center w-10 h-10 rounded-xl text-xs transition-transform group-hover:scale-110",
                          getSensitivityColor(val)
                        )}>
                          {val !== undefined ? `${val}` : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
         <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
               <Info className="w-4 h-4 text-brand-primary" />
               Guide to Sensitivity
            </h3>
            <div className="grid grid-cols-3 gap-2">
               <div className="flex flex-col p-2 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-black text-emerald-700 uppercase">≥ 90%</span>
                  <span className="text-[8px] font-bold text-emerald-600">Highly Sensitive</span>
               </div>
               <div className="flex flex-col p-2 bg-amber-50 rounded-xl border border-amber-100 text-center">
                  <span className="text-[10px] font-black text-amber-700 uppercase">60-89%</span>
                  <span className="text-[8px] font-bold text-amber-600">Consider Alternatives</span>
               </div>
               <div className="flex flex-col p-2 bg-rose-50 rounded-xl border border-rose-100 text-center">
                  <span className="text-[10px] font-black text-rose-700 uppercase">&lt; 60%</span>
                  <span className="text-[8px] font-bold text-rose-600">Poor Sensitivity</span>
               </div>
            </div>
         </div>

         <div className="p-6 bg-slate-900 rounded-3xl shadow-xl space-y-4">
            <h3 className="text-xs font-black uppercase text-white flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-amber-400" />
               Critical Alerts
            </h3>
            <div className="space-y-2">
               <div className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <p className="text-[10px] text-slate-300 leading-relaxed italic">
                    <span className="text-rose-400 font-bold not-italic">A. baumannii</span> shows critical resistance to carbapenems (10% sensitivity). Reserve Colistin/Tigecycline.
                  </p>
               </div>
               <div className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <p className="text-[10px] text-slate-300 leading-relaxed italic">
                    <span className="text-amber-400 font-bold not-italic">MRSA</span> incidence in blood cultures increased by 12% in Q4.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
