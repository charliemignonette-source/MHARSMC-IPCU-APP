const fs = require('fs');
let file = fs.readFileSync('src/components/Maintenance.tsx', 'utf8');

file = file.replace(/setNewStaff\(\{ staffCode: '', pin: '', role: 'USER', unit: 'General' \}\);/g, 'setNewStaff({ staffCode: \'\', pin: \'\', role: \'USER\', unit: \'General\' });\n      showToast("Changes saved successfully");');

file = file.replace(/catch \(err\) \{\n\s*console.error\("Save staff failed:", err\);\n\s*\}/g, 'catch (err) {\n      console.error("Save staff failed:", err);\n      showToast("Failed to save changes", "error");\n    }');

file = file.replace(/await deleteDoc\(doc\(db, 'user_roles', id\)\);/g, 'await deleteDoc(doc(db, \'user_roles\', id));\n      showToast("Changes saved successfully");');

file = file.replace(/catch \(err\) \{\n\s*console.error\("Delete staff failed:", err\);\n\s*\}/g, 'catch (err) {\n      console.error("Delete staff failed:", err);\n      showToast("Failed to delete", "error");\n    }');

fs.writeFileSync('src/components/Maintenance.tsx', file);
