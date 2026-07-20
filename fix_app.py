import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# remove IPCUValidationConsole import
content = re.sub(r"import IPCUValidationConsole from '\./components/IPCUValidationConsole';\n", "", content)

# remove validation tab from navTabs
content = re.sub(r"\s*\{\s*id:\s*'validation',\s*label:\s*'IPCU Validation'.*?\},\n", "\n", content)

# remove activeTab === 'validation'
content = re.sub(r"\s*\{activeTab === 'validation' && <IPCUValidationConsole user=\{profile\} />\}\n", "\n", content)

with open('src/App.tsx', 'w') as f:
    f.write(content)
print("Removed validation console from App.tsx")
