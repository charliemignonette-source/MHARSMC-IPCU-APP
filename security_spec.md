# Security Specification: IPC COMMAND

## 1. Data Invariants
- **Users**: Every user must have a valid UID matching their Auth UID. Roles are strictly controlled. Only ADMINs can promote others to ADMIN.
- **Audits**: Must have a valid `auditorId` matching the creator's UID. Units must be from the predefined list.
- **AMS Requests**: Must originate from a prescriber. Status changes (Approved/Denied) are restricted to Approvers/IPCN/ADMIN.
- **HAI Cases**: Validations are restricted to IPCN/ADMIN.
- **BOC Logs**: Must be linked to the staff member who performed the surveillance.
- **NSI Reports**: Contain PII; access is restricted to the reporter or IPCN/ADMIN.
- **Outbreaks**: Critical safety data; all authenticated users can create, but only IPCN/ADMIN can manage status.

## 2. Dirty Dozen Payloads

### P1: Identity Spoofing (Users)
**Target**: `/users/other_uid`
**Payload**: `{ "uid": "other_uid", "role": "ADMIN", "isVerified": true }`
**Expected**: `PERMISSION_DENIED` (UID mismatch)

### P2: Privilege Escalation (Self-Promotion)
**Target**: `/users/my_uid` (Update)
**Payload**: `{ "role": "ADMIN" }`
**Expected**: `PERMISSION_DENIED` (Cannot self-promote to ADMIN)

### P3: Audit Forgery (Wrong Auditor)
**Target**: `/audits/some_id`
**Payload**: `{ "auditorId": "other_uid", "unit": "ICU", "score": 10, "total": 10 }`
**Expected**: `PERMISSION_DENIED` (auditorId mismatch)

### P4: AMS Status Hijacking (Physician approving own drug)
**Target**: `/ams_requests/req_id` (Update)
**Payload**: `{ "status": "APPROVED" }`
**Expected**: `PERMISSION_DENIED` (Physician/USER cannot approve)

### P5: PII Leak (Reading other's NSI)
**Target**: `/nsi_reports/other_report_id` (Get)
**Expected**: `PERMISSION_DENIED` (Not owner or IPCN/ADMIN)

### P6: Resource Poisoning (Giant ID)
**Target**: `/users/` + "A" * 200
**Expected**: `PERMISSION_DENIED` (isValidId failure)

### P7: Orphaned Write (BOC without StaffId)
**Target**: `/boc_logs/log_id`
**Payload**: `{ "patientName": "John Doe" }`
**Expected**: `PERMISSION_DENIED` (Missing staffId/isValid check)

### P8: Temporal Integrity Violation (Setting future createdAt)
**Target**: `/hai_cases/case_id`
**Payload**: `{ "createdAt": "2030-01-01" }`
**Expected**: `PERMISSION_DENIED` (Must use server timestamp)

### P9: Shadow Field Injection (Users)
**Target**: `/users/my_uid` (Create)
**Payload**: `{ "uid": "my_uid", "role": "USER", "ghost_field": true }`
**Expected**: `PERMISSION_DENIED` (keys().size() check)

### P10: Query Scraping (Listing all users)
**Operation**: `list /users` as basic USER
**Expected**: `PERMISSION_DENIED` (Only Admin/IPCN can list)

### P11: Outcome Tampering (Changing controlled outbreak)
**Target**: `/outbreaks/controlled_id` (Update)
**Payload**: `{ "status": "Suspected" }`
**Expected**: `PERMISSION_DENIED` (If terminal state locking or role check fails)

### P12: Data Type Poisoning
**Target**: `/audits/id`
**Payload**: `{ "score": "high" }`
**Expected**: `PERMISSION_DENIED` (score must be number)

## 3. Test Runner (Stubs)
The `firestore.rules.test.ts` will verify these boundaries.
