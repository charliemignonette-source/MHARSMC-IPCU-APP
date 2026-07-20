import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

# Replace validationForm usages and the block
start_idx = content.find('{selectedAuditForValidation && (')
end_idx = content.find('</AnimatePresence>', start_idx)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]
    with open('src/components/Audits.tsx', 'w') as f:
        f.write(content)
    print("Replaced!")
else:
    print("Not found")
