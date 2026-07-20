const fs = require('fs');
let auditsCode = fs.readFileSync('src/components/Audits.tsx', 'utf8');

// The bad AuditDetailsViewer is from function AuditDetailsViewer up to the first function AuditEntry
const badViewerRegex = /function AuditDetailsViewer[\s\S]*?function AuditEntry\(props/m;

let detailsBlock = fs.readFileSync('extract_details_block.txt', 'utf8');
const startStr = `<div className="flex justify-between items-center border-b border-slate-200 pb-2">`;
const endStr = `            )}
          </motion.div>`;
const startIdx = detailsBlock.indexOf(startStr);
const endIdx = detailsBlock.indexOf(endStr);

const realJSX = detailsBlock.substring(startIdx, endIdx + 14); // keep the closing )} for the last block

const fixedViewer = `function AuditDetailsViewer({ type, details }: { type: string; details: any }) {
  if (!details) return null;
  return (
    <div className="flex flex-col gap-3 font-sans w-full">
      ${realJSX}
    </div>
  );
}

function AuditEntry(props`;

auditsCode = auditsCode.replace(badViewerRegex, fixedViewer);

fs.writeFileSync('src/components/Audits.tsx', auditsCode);
console.log("Fixed AuditDetailsViewer!");
