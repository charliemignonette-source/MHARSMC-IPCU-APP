import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

# The modal starts with "{selectedAuditForValidation && (" 
# Wait, I deleted "selectedAuditForValidation" state! So it's breaking anyway if it's there.
content = re.sub(r"\{selectedAuditForValidation && \(\s*<div className=\"fixed inset-0.*?\}\s*\)\}", "", content, flags=re.DOTALL)

with open('src/components/Audits.tsx', 'w') as f:
    f.write(content)
print("Deleted modal!")
