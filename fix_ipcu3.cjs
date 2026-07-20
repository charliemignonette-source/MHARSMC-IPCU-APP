const fs = require('fs');
let code = fs.readFileSync('src/components/IPCUValidationConsole.tsx', 'utf8');

code = code.replace(
  `  useEffect(() => {`,
  `  const loadData = () => {`
);

code = code.replace(
  `    return () => {};\n  }, []);`,
  `  };\n\n  useEffect(() => {\n    loadData();\n  }, []);`
);

code = code.replace(
  `<div className="flex flex-col gap-1">`,
  `<div className="flex flex-col gap-1">\n          <button onClick={loadData} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors self-start mb-2">Refresh Data</button>`
);

fs.writeFileSync('src/components/IPCUValidationConsole.tsx', code);
console.log('Fixed IPCU3');
