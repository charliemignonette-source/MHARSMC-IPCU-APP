const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
`export function isQuotaExceeded() {
  try {
    return false;
  } catch (e) {
    return false;
  }
}`,
`export function isQuotaExceeded() {
  try {
    return localStorage.getItem('firebase_quota_exceeded') === 'true';
  } catch (e) {
    return false;
  }
}`
);

// Also replace 'ignore_this' back to 'firebase_quota_exceeded'
code = code.replace(/ignore_this/g, 'firebase_quota_exceeded');

fs.writeFileSync('src/lib/firebase.ts', code);
