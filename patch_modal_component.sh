cat << 'MODAL' >> src/components/Outbreak.tsx

function OutbreakValidationModal({ report, onClose, onSubmit, user }: any) {
  const [remarks, setRemarks] = useState(report?.validation?.notes || "");
  const [status, setStatus] = useState(report?.validation?.decision || "Confirmed Outbreak");

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-6 bg-slate-900/10 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        <div className="p-4 sm:p-6 bg-brand-primary border-b border-teal-700 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
             <ShieldCheck className="w-5 h-5" />
             <h3 className="text-sm sm:text-lg font-bold uppercase tracking-tight">IPCU Outbreak Verification</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-teal-700 rounded-full transition-colors"><XCircle className="w-6 h-6" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(report, { remarks, status }); }} className="flex-1 overflow-hidden flex flex-col bg-slate-50">
          <div className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <span className="text-[10px] font-black text-brand-primary uppercase">Outbreak Report</span>
              <h4 className="text-sm font-bold text-slate-900">{report.epidemiology?.syndrome || "Unknown Syndrome"} • {report.epidemiology?.unitsAffected || "Unknown Unit"}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporter: {report.reportedBy}</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Decision Status</label>
                  <div className="flex flex-col gap-2">
                     {["Confirmed Outbreak", "Not an Outbreak", "Needs More Data"].map((s) => (
                       <button key={s} type="button" onClick={() => setStatus(s)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border", status === s ? (s === 'Confirmed Outbreak' ? "bg-rose-500 border-rose-500 text-white" : s === 'Not an Outbreak' ? "bg-emerald-500 border-emerald-500 text-white" : "bg-amber-500 border-amber-500 text-white") : "bg-white border-slate-200 text-slate-400")}>{s}</button>
                     ))}
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Validator Remarks</label>
                  <textarea 
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-brand-primary min-h-[120px]" 
                    placeholder="Enter validation remarks, recommended actions, etc..." 
                    value={remarks} 
                    onChange={e => setRemarks(e.target.value)} 
                    required
                  />
               </div>
            </div>

          </div>
          <div className="p-4 sm:p-6 bg-white border-t border-slate-100 shrink-0">
            <button type="submit" className="w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Submit Verification</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
MODAL
