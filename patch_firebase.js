const fs = require('fs');

const firebaseFile = 'src/lib/firebase.ts';
let code = fs.readFileSync(firebaseFile, 'utf8');

if (!code.includes('safeOnSnapshot')) {
  code = code.replace("import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';", 
    "import { getFirestore, doc, getDocFromServer, onSnapshot, Query, DocumentReference, DocumentData } from 'firebase/firestore';");
  
  code += `
export const isQuotaExceeded = () => localStorage.getItem('firebase_quota_exceeded') === 'true';
export function safeOnSnapshot(
  q: any,
  next: (snapshot: any) => void,
  error?: (error: any) => void
) {
  if (isQuotaExceeded()) {
    return () => {}; // return dummy unsubscribe
  }
  return onSnapshot(q, next, (err: any) => {
     if (err.message?.includes('Quota') || err.message?.includes('quota') || err.code === 'resource-exhausted') {
       localStorage.setItem('firebase_quota_exceeded', 'true');
       if (!quotaAlertShown) {
           quotaAlertShown = true;
           alert("Firebase daily quota limit exceeded. The application will operate in read-only/offline mode.");
       }
       // Reload to clear internal SDK state and prevent crash loop
       setTimeout(() => window.location.reload(), 1500);
     }
     if (error) error(err);
  });
}
`;
  fs.writeFileSync(firebaseFile, code);
}
