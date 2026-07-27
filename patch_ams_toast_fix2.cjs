const fs = require('fs');
let file = fs.readFileSync('src/components/AMS.tsx', 'utf8');

// The place where the regex incorrectly matched is:
// </AnimatePresence>    </div>  );})}
// wait, the regex replaced `</AnimatePresence>\n\s*<\/div>\n\s*\);\n\s*\}/` 
// with the AnimatePresence block.

// Let's remove the wrongly inserted AnimatePresence block and restore the map closing.
file = file.replace(/<AnimatePresence>\s*\{toast && \(\s*<motion\.div\s*initial=\{\{ opacity: 0, y: 50 \}\}\s*animate=\{\{ opacity: 1, y: 0 \}\}\s*exit=\{\{ opacity: 0, y: 50 \}\}\s*className="fixed bottom-6 left-1\/2 -translate-x-1\/2 z-\[200\] px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"\s*>\s*<div className=\{cn\(\s*"w-2 h-2 rounded-full animate-pulse",\s*toast\.type === 'success' \? "bg-emerald-400" : "bg-rose-400"\s*\)\} \/>\s*<span className="text-xs font-black uppercase tracking-widest">\{toast\.message\}<\/span>\s*<\/motion\.div>\s*\)\}\s*<\/AnimatePresence>\s*<\/div>\s*\);\s*\}/g, '</AnimatePresence>\n                                      </div>\n                                    );\n                                  })}');

fs.writeFileSync('src/components/AMS.tsx', file);
