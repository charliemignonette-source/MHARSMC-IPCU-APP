const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const topStr = `// Validation queries removed to save quota\n  }, [authStateUser, profile]);`;
const topIndex = code.indexOf(topStr) + topStr.length;

const bottomStr = `  const loginWithGoogle = async () => {`;
const bottomIndex = code.indexOf(bottomStr); // This will find the second copy of loginWithGoogle. Wait! Is there a first copy?

let firstPart = code.substring(0, topIndex);
let secondPart = code.substring(bottomIndex);

// wait, let's make sure we find the RIGHT loginWithGoogle.
// The first one is from the duplicate! We want the LAST one!
const lastBottomIndex = code.lastIndexOf(bottomStr);

code = firstPart + '\n\n' + code.substring(lastBottomIndex);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed');
