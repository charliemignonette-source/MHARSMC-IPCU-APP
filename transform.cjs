const fs = require('fs');
let code = fs.readFileSync('src/components/Audits.tsx', 'utf8');

// 1. Remove the modal string
// It starts with `{selectedAuditForValidation && (` and ends right before `</AnimatePresence>`
const modalStart = code.indexOf('{selectedAuditForValidation && (');
if (modalStart !== -1) {
  // Find the AnimatePresence closure after modalStart
  const animateClosure = code.indexOf('</AnimatePresence>', modalStart);
  if (animateClosure !== -1) {
    code = code.substring(0, modalStart) + code.substring(animateClosure);
  }
}

// 2. Change the button action in AuditEntry map
const oldCb = `onValidate={() => {
                      setSelectedAuditForValidation(audit);
                      setValidationForm({
                         ...validationForm,
                         validatorName: user?.name || ''
                      });
                    }}`;
const newCb = `onValidate={() => handleInstantValidate(audit)}`;
code = code.replace(oldCb, newCb);

// 3. Change handleValidateSubmit to handleInstantValidate
const handleValidateStart = code.indexOf('const handleValidateSubmit = async (e: React.FormEvent) => {');
if (handleValidateStart !== -1) {
  const handleValidateEnd = code.indexOf('  };', handleValidateStart) + 4;
  const newHandle = `  const handleInstantValidate = async (audit: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'audits', audit.id), {
        isValidated: true,
        validatedBy: user.email,
        validatorName: user.name || 'IPCN Validator',
        validatedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      // Optionally notify toast here
    } catch (error) {
      console.error(error);
    }
  };`;
  code = code.substring(0, handleValidateStart) + newHandle + code.substring(handleValidateEnd);
}

// 4. Remove validationForm and selectedAuditForValidation state
code = code.replace(/const \[selectedAuditForValidation, setSelectedAuditForValidation\] = useState<Audit \| null>\(null\);\n/g, '');
code = code.replace(/const \[validationForm, setValidationForm\] = useState\(\{[\s\S]*?\}\);\n/g, '');

fs.writeFileSync('src/components/Audits.tsx', code);
console.log("Transformed!");
