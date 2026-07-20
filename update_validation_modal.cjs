const fs = require('fs');

let code = fs.readFileSync('src/components/Audits.tsx', 'utf8');

const targetStr = `              <form onSubmit={handleValidateSubmit} className="p-6 space-y-6">`;
const replacement = `              <div className="overflow-y-auto custom-scrollbar flex-1">
                 <div className="p-6 bg-slate-50 border-b border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Audit Details</span>
                    <AuditDetailsViewer type={selectedAuditForValidation.type} details={selectedAuditForValidation.details} />
                 </div>
                 <form onSubmit={handleValidateSubmit} className="p-6 space-y-6">`;

const formEndStr = `                 <button type="submit" className="w-full py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-teal-900/10 active:scale-95 transition-all">Submit IPCN Validation</button>
              </form>`;
const replacementEnd = formEndStr + `\n              </div>`;

code = code.replace(targetStr, replacement);
code = code.replace(formEndStr, replacementEnd);

fs.writeFileSync('src/components/Audits.tsx', code);
console.log("Updated Validation Modal successfully!");
