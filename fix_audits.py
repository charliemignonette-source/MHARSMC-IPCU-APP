import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

# Replace the modal
content = re.sub(r"\{selectedAuditForValidation && \(\s*<div className=\"fixed inset-0.*?\}\s*\)\}\s*</AnimatePresence>", "</AnimatePresence>", content, flags=re.DOTALL)

# Remove selectedAuditForValidation state and validationForm state
content = re.sub(r"const \[selectedAuditForValidation.*?\] = useState.*?\n", "", content)
content = re.sub(r"const \[validationForm, setValidationForm\].*?\}\);\n", "", content, flags=re.DOTALL)

# Replace handleValidateSubmit with inline handleInstantValidate
handle_validate_code = """
  const handleInstantValidate = async (audit: Audit) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'audits', audit.id), {
        isValidated: true,
        validatedBy: user.email,
        validatorName: user.name || 'IPCN Validator',
        validatedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      showToast('Audit validated successfully');
    } catch (error) {
      showToast('Failed to validate audit', 'error');
    }
  };
"""
content = re.sub(r"const handleValidateSubmit = async.*?\}\n", handle_validate_code, content, flags=re.DOTALL)

with open('src/components/Audits.tsx', 'w') as f:
    f.write(content)
