const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`  }, [authStateUser, profile]);React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, `,
`  }, [authStateUser, profile]);`
);

fs.writeFileSync('src/App.tsx', code);
