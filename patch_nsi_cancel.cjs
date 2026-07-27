const fs = require('fs');
let file = fs.readFileSync('src/components/NSI.tsx', 'utf8');

file = file.replace(
  '<button \n                  type="submit"', 
  '<button type="button" onClick={() => { setIsAdding(false); setEditingId(null); setFormData(initialFormState); }} className="flex-1 bg-slate-100 text-slate-500 rounded-2xl py-5 text-[12px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all">Cancel</button>\n                <button \n                  type="submit"'
);

fs.writeFileSync('src/components/NSI.tsx', file);
