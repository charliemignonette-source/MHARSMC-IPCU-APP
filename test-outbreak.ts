import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function test() {
  try {
    const creds = await signInWithEmailAndPassword(auth, "charliemignonette@gmail.com", "password123");
    console.log("Signed in uid:", creds.user.uid);
    const user = { name: "Charlie", uid: creds.user.uid, email: "charliemignonette@gmail.com" };

    const cleanData = {
      detectedAt: "2024-05-11",
      detectedTime: "10:00",
      reportingSrc: [],
      type: [],
      triggerCriteria: [],
      lineList: [],
      epidemiology: {
        indexCase: '', totalCases: 0, attackRate: '', unitsAffected: '', possibleSource: '', transmissionMode: []
      },
      findings: {
        envSwabbing: { done: false, results: '' },
        waterTesting: { done: false, results: '' },
        labAlerts: { organism: '', resistancePattern: '' }
      },
      controlMeasures: {
        actions: [], dateImplemented: "2024-05-11", responsibleUnit: ''
      },
      status: 'Suspected',
      investigationTeam: ["Team Member A"],
      conclusion: 'Some conclusion',
      recommendations: 'Some recommendations'
    };

    console.log("Creating doc...");
    const ref = await addDoc(collection(db, 'outbreaks'), {
      ...cleanData,
      reportedBy: user.name,
      reporterId: user.uid,
      reporterEmail: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("Created successfully. id:", ref.id);

    console.log("Updating doc...");
    await updateDoc(doc(db, 'outbreaks', ref.id), {
       ...cleanData,
       updatedAt: serverTimestamp()
    });
    console.log("Updated successfully.");

  } catch(e) {
    console.error("ERROR", e);
  }
}
test();
