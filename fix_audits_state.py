import re

with open('src/components/Audits.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"const \[selectedAuditForValidation.*?\] = useState.*?\n", "", content)
content = re.sub(r"const \[validationForm, setValidationForm\].*?\}\);\n", "", content, flags=re.DOTALL)

with open('src/components/Audits.tsx', 'w') as f:
    f.write(content)
print("Removed state")
