const fs = require('fs');
let code = fs.readFileSync('src/components/IPCUValidationConsole.tsx', 'utf8');

const startStr = `    return () => {`;
const endStr = `      unsubValidatedOutbreaks();\n    };\n  }, []);`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + `    return () => {};\n  }, []);` + code.substring(endIndex);
  fs.writeFileSync('src/components/IPCUValidationConsole.tsx', code);
  console.log('Replaced Cleanup');
} else {
  console.log('Not found Cleanup');
}
