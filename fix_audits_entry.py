import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

# Fix the AuditEntry mapping
old_audit_entry_code = """
                return filteredAudits.map(audit => (
                  <AuditEntry 
                    key={audit.id} 
                    {...audit} 
                    onValidate={() => {
                      setSelectedAuditForValidation(audit);
                      setValidationForm({
                         ...validationForm,
                         validatorName: user?.name || ''
                      });
                    }}
                    isAdmin={user?.role === 'IPCN' || user?.role === 'ADMIN'}
                  />
                ));
"""

new_audit_entry_code = """
                return filteredAudits.map(audit => (
                  <AuditEntry 
                    key={audit.id} 
                    {...audit} 
                    onValidate={() => handleInstantValidate(audit)}
                    isAdmin={user?.role === 'IPCN' || user?.role === 'ADMIN'}
                  />
                ));
"""

if "setSelectedAuditForValidation(audit);" in content:
    content = content.replace(old_audit_entry_code.strip(), new_audit_entry_code.strip())
else:
    # Just use regex in case of slight whitespace difference
    content = re.sub(r"onValidate=\{\(\) => \{\s*setSelectedAuditForValidation\(audit\);\s*setValidationForm\(\{.*?\}\);\s*\}\}", "onValidate={() => handleInstantValidate(audit)}", content, flags=re.DOTALL)

with open('src/components/Audits.tsx', 'w') as f:
    f.write(content)
