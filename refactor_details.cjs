const fs = require('fs');

let code = fs.readFileSync('src/components/Audits.tsx', 'utf8');

const startStr = `            <div className="flex justify-between items-center border-b border-slate-200 pb-2">`;
const endStr = `          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}`;

const idxStart = code.indexOf(startStr);
const idxEnd = code.indexOf(endStr);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Could not find start or end block.");
    process.exit(1);
}

const extractedJSX = code.substring(idxStart, idxEnd);

const newComponent = `
function AuditDetailsViewer({ type, details }: { type: string; details: any }) {
  if (!details) return null;
  return (
    <div className="flex flex-col gap-3 font-sans w-full">
${extractedJSX}    </div>
  );
}
`;

// Replace the extracted JSX in AuditEntry with the new component
let modifiedCode = code.substring(0, idxStart) + `              <AuditDetailsViewer type={type} details={details} />\n` + code.substring(idxEnd);

// Prepend the new component to the file (before export default function Audits)
const exportIdx = modifiedCode.indexOf('export default function Audits');
modifiedCode = modifiedCode.substring(0, exportIdx) + newComponent + '\n' + modifiedCode.substring(exportIdx);

fs.writeFileSync('src/components/Audits.tsx', modifiedCode);
console.log("Refactored AuditDetailsViewer successfully!");
