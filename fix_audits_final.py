import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

# Fix AuditEntry callback
old_callback = """                    onValidate={() => {
                      setSelectedAuditForValidation(audit);
                      setValidationForm({
                         ...validationForm,
                         validatorName: user?.name || ''
                      });
                    }}"""
new_callback = """                    onValidate={() => handleInstantValidate(audit)}"""
content = content.replace(old_callback, new_callback)

# Check why there's a syntax error. Maybe there's an extra } because the regex replaced too much or too little.
# "Unexpected } at line 2279". Let's check what's going on around there.
with open('src/components/Audits.tsx', 'w') as f:
    f.write(content)
