const fs = require('fs');
let file = fs.readFileSync('src/components/NSI.tsx', 'utf8');

if (!file.includes('const [toast,')) {
    file = file.replace('const [searchTerm, setSearchTerm] = useState(\'\');', 'const [toast, setToast] = useState<{ message: string, type: \'success\' | \'error\' } | null>(null);\n  const showToast = (message: string, type: \'success\' | \'error\' = \'success\') => {\n    setToast({ message, type });\n    setTimeout(() => setToast(null), 3000);\n  };\n  const [searchTerm, setSearchTerm] = useState(\'\');');
}

file = file.replace(/alert\("Delete failed. Try again."\);/g, 'showToast("Delete failed. Try again.", "error");');
file = file.replace(/alert\("Log deleted."\);/g, 'showToast("Record deleted.");');

file = file.replace(/setIsAdding\(false\);\n\s*setEditingId\(null\);\n\s*setFormData\(initialFormState\);/, 'setIsAdding(false);\n      setEditingId(null);\n      setFormData(initialFormState);\n      showToast("Report saved successfully");');

file = file.replace(/setSelectedReport\(null\);\n\s*\} catch \(error\)/, 'setSelectedReport(null);\n      showToast("Validation saved");\n    } catch (error)');

if (!file.includes('<AnimatePresence>\\n        {toast')) {
    file = file.replace(/<\/div>\n    <\/div>\n  \);\n}/, `</AnimatePresence>\n      <AnimatePresence>\n        {toast && (\n          <motion.div\n            initial={{ opacity: 0, y: 50 }}\n            animate={{ opacity: 1, y: 0 }}\n            exit={{ opacity: 0, y: 50 }}\n            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"\n          >\n            <div className={cn(\n              "w-2 h-2 rounded-full animate-pulse",\n              toast.type === 'success' ? "bg-emerald-400" : "bg-rose-400"\n            )} />\n            <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>\n          </motion.div>\n        )}\n      </AnimatePresence>\n    </div>\n  );\n}`);
}

fs.writeFileSync('src/components/NSI.tsx', file);
