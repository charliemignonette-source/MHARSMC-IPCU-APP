const fs = require('fs');

let content = fs.readFileSync('src/components/AMS.tsx', 'utf8');

const dispenseLogic = `onClick={async (e) => {
                              e.stopPropagation();
                              const pharmacistName = prompt("Enter Pharmacist Name:", user?.name || user?.email || "");
                              if (pharmacistName === null) return;
                              try {
                                await updateDoc(doc(db, 'ams_requests', req.id!), {
                                  status: 'DISPENSED',
                                  dispensedBy: pharmacistName || user?.name || user?.email,
                                  dispensedAt: serverTimestamp()
                                });`;

content = content.replace(`onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await updateDoc(doc(db, 'ams_requests', req.id!), {
                                  status: 'DISPENSED',
                                  dispensedBy: user?.name || user?.email,
                                  dispensedAt: serverTimestamp()
                                });`, dispenseLogic);

fs.writeFileSync('src/components/AMS.tsx', content);
