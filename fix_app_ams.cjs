const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  useEffect(() => {
    if (!profile) {
      setHasPendingAMS(false);
      setPendingAMSCount(0);
      return;
    }
    const baseQuery = collection(db, 'ams_requests');

    try {
      if (profile.role === 'ADMIN' || profile.role === 'IPCN' || profile.role === 'APPROVER' || profile.role === 'PHARMACY') {
        const q = query(baseQuery);
        getDocs(q).then((snapshot) => {
          const reqs = snapshot.docs.map(doc => doc.data() as any);
          let count = 0;
          if (profile.role === 'ADMIN' || profile.role === 'IPCN' || profile.role === 'APPROVER') {
            count += reqs.filter(r => r.status === 'PENDING').length;
          }
          if (profile.role === 'PHARMACY') {
            count += reqs.filter(r => r.status === 'APPROVED').length;
          }
          setPendingAMSCount(count);
          setHasPendingAMS(count > 0);
        }).catch((err) => {
          console.warn("Pending AMS query error:", err);
        });
      } else {
        const q = query(baseQuery, where('prescriberId', '==', profile.uid));
        getDocs(q).then((snapshot) => {
          const reqs = snapshot.docs.map(doc => doc.data() as any);
          const count = reqs.filter(r => r.status === 'MODIFY').length;
          setPendingAMSCount(count);
          setHasPendingAMS(count > 0);
        }).catch((err) => {
          console.warn("Physician pending ams error:", err);
        });
      }
    } catch (err) {
      console.warn("Failed to establish ams fetch:", err);
    }
  }, [profile]);`;

// Need to match exactly
const startStr = `  useEffect(() => {\n    if (!profile) {\n      setHasPendingAMS(false);\n      setPendingAMSCount(0);\n      return;\n    }\n    const baseQuery = collection(db, 'ams_requests');`;
const endStr = `    return () => unsubscribe();\n  }, [profile]);`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Replaced AMS');
} else {
  console.log('Not found AMS');
}
