const fs = require('fs');
let file = fs.readFileSync('firestore.rules', 'utf8');

file = file.replace(/match \/nsi_reports\/\{reportId\} \{[\s\S]*?allow delete: if isAdmin\(\) \|\| isIPCN\(\);\s*\}/, `match /nsi_reports/{reportId} {
      allow get: if isSignedIn();
      allow list: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isSignedIn();
      allow delete: if isAdmin() || isIPCN();
    }`);

fs.writeFileSync('firestore.rules', file);
