import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const USER_ROLES_DATA = [
  { email: 'beeohend@gmail.com', role: 'ADMIN', unit: 'ALL' },
  { email: 'charliemignonette@gmail.com', role: 'ADMIN', unit: 'ALL' },
  { email: 'mharmc.hipc@gmail.com', role: 'IPCN', unit: 'IPCU' },
  { email: 'alleiagurl@gmail.com', role: 'IPCN', unit: 'IPCU' },
  { pin: '1101', staffCode: 'ICU001', role: 'USER', unit: 'ICU' },
  { pin: '1102', staffCode: 'ICU002', role: 'USER', unit: 'ICU' },
  { pin: '1103', staffCode: 'ICU003', role: 'USER', unit: 'ICU' },
  { pin: '1104', staffCode: 'ICU004', role: 'USER', unit: 'ICU' },
  { pin: '1201', staffCode: 'PICU001', role: 'USER', unit: 'PICU' },
  { pin: '1202', staffCode: 'PICU002', role: 'USER', unit: 'PICU' },
  { pin: '1301', staffCode: 'NICU001', role: 'USER', unit: 'NICU' },
  { pin: '1302', staffCode: 'NICU002', role: 'USER', unit: 'NICU' },
  { pin: '1303', staffCode: 'NICU003', role: 'USER', unit: 'NICU' },
  { pin: '2101', staffCode: 'W1A001', role: 'USER', unit: 'Ward 1A' },
  { pin: '2102', staffCode: 'W1A002', role: 'USER', unit: 'Ward 1A' },
  { pin: '2201', staffCode: 'W1B001', role: 'USER', unit: 'Ward 1B' },
  { pin: '2202', staffCode: 'W1B002', role: 'USER', unit: 'Ward 1B' },
  { pin: '2301', staffCode: 'W1C001', role: 'USER', unit: 'Ward 1C' },
  { pin: '2302', staffCode: 'W1C002', role: 'USER', unit: 'Ward 1C' },
  { pin: '3101', staffCode: 'W2A001', role: 'USER', unit: 'Ward 2A' },
  { pin: '3102', staffCode: 'W2A002', role: 'USER', unit: 'Ward 2A' },
  { pin: '3201', staffCode: 'W2B001', role: 'USER', unit: 'Ward 2B' },
  { pin: '3202', staffCode: 'W2B002', role: 'USER', unit: 'Ward 2B' },
  { pin: '4101', staffCode: 'W3A001', role: 'USER', unit: 'Ward 3A' },
  { pin: '4102', staffCode: 'W3A002', role: 'USER', unit: 'Ward 3A' },
  { pin: '4201', staffCode: 'W3B001', role: 'USER', unit: 'Ward 3B' },
  { pin: '4202', staffCode: 'W3B002', role: 'USER', unit: 'Ward 3B' },
  { pin: '5101', staffCode: 'W4A001', role: 'USER', unit: 'Ward 4A' },
  { pin: '5102', staffCode: 'W4A002', role: 'USER', unit: 'Ward 4A' },
  { pin: '5201', staffCode: 'W4B001', role: 'USER', unit: 'Ward 4B' },
  { pin: '5202', staffCode: 'W4B002', role: 'USER', unit: 'Ward 4B' },
  { pin: '6101', staffCode: 'W5A001', role: 'USER', unit: 'Ward 5A' },
  { pin: '6102', staffCode: 'W5A002', role: 'USER', unit: 'Ward 5A' },
  { pin: '6201', staffCode: 'W5B001', role: 'USER', unit: 'Ward 5B' },
  { pin: '6202', staffCode: 'W5B002', role: 'USER', unit: 'Ward 5B' },
  { pin: '7101', staffCode: 'W6A001', role: 'USER', unit: 'Ward 6' },
  { pin: '7102', staffCode: 'W6A002', role: 'USER', unit: 'Ward 6' },
  { pin: '8101', staffCode: 'C2A001', role: 'USER', unit: 'C2' },
  { pin: '8102', staffCode: 'C2A002', role: 'USER', unit: 'C2' },
  { pin: '8201', staffCode: 'C3A001', role: 'USER', unit: 'C3' },
  { pin: '8202', staffCode: 'C3A002', role: 'USER', unit: 'C3' },
  { pin: '8301', staffCode: 'C4A001', role: 'USER', unit: 'C4' },
  { pin: '8302', staffCode: 'C4A002', role: 'USER', unit: 'C4' },
  { pin: '9001', staffCode: 'ER001', role: 'USER', unit: 'ER' },
  { pin: '9002', staffCode: 'ER002', role: 'USER', unit: 'ER' },
  { pin: '9003', staffCode: 'ER003', role: 'USER', unit: 'ER' },
  { pin: '9101', staffCode: 'OPD1001', role: 'USER', unit: 'OPD 1' },
  { pin: '9102', staffCode: 'OPD1002', role: 'USER', unit: 'OPD 1' },
  { pin: '9201', staffCode: 'OPD2001', role: 'USER', unit: 'OPD 2' },
  { pin: '9202', staffCode: 'OPD2002', role: 'USER', unit: 'OPD 2' },
  { pin: '9301', staffCode: 'OR001', role: 'USER', unit: 'OR' },
  { pin: '9302', staffCode: 'OR002', role: 'USER', unit: 'OR' },
  { pin: '9401', staffCode: 'DR001', role: 'USER', unit: 'DR' },
  { pin: '9402', staffCode: 'DR002', role: 'USER', unit: 'DR' },
  { pin: '9501', staffCode: 'OBW001', role: 'USER', unit: 'OB Ward' },
  { pin: '9502', staffCode: 'OBW002', role: 'USER', unit: 'OB Ward' },
  { pin: '9601', staffCode: 'SURG001', role: 'USER', unit: 'Surgical Ward' },
  { pin: '9602', staffCode: 'SURG002', role: 'USER', unit: 'Surgical Ward' },
  { pin: '9701', staffCode: 'MED001', role: 'USER', unit: 'Medical Ward' },
  { pin: '9702', staffCode: 'MED002', role: 'USER', unit: 'Medical Ward' },
  { pin: '9801', staffCode: 'PED001', role: 'USER', unit: 'Pedia Ward' },
  { pin: '9802', staffCode: 'PED002', role: 'USER', unit: 'Pedia Ward' }
];

export async function seedUserRoles() {
  const rolesCol = collection(db, 'user_roles');
  
  for (const roleData of USER_ROLES_DATA) {
    const id = (roleData as any).email || (roleData as any).staffCode;
    if (!id) continue;
    
    await setDoc(doc(rolesCol, id), roleData);
  }
}
