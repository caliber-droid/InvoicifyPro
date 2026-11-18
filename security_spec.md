# InvoicifyPro Security Specification (Phase 0)

## Data Invariants
1. **User Isolation**: Every business record (`businessProfiles`, `clients`, `invoices`, `estimates`, `payments`, `expenses`, `recurringProfiles`, `reminders`, `notifications`, `documents`, `aiConversations`, `auditLogs`) MUST carry `ownerId == request.auth.uid`.
2. **Verified Auth**: All authenticated reads/writes require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Immutable Ownership & Timestamps**: `ownerId` and `createdAt` can never be mutated after creation. `createdAt == request.time` on create; `updatedAt == request.time` on update.
4. **No Self-Admin Escalation**: Users cannot assign `role: 'admin'` on `/users/{userId}` create or modify `role` on update.
5. **Strict Key & Size Bounds**: Every create enforces `hasAll` and `hasOnly`; every update uses `affectedKeys().hasOnly(...)` with `isValid[Entity](incoming())` first; every string enforces `.size()`; every array enforces `.size() <= MAX`.
6. **Terminal State Locking**: Voided/refunded invoices and converted/rejected/expired estimates cannot be arbitrarily reverted by non-admin updates.
7. **Portal Share Isolation**: `/portalShares/{shareId}` allows exact `get` only (no `list`), and public client decision updates can only mutate `clientDecision`, `clientComment`, `decidedAt`, `status`, and `updatedAt` on estimate shares.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Shadow Update: `/clients/c1` create with extra `isAdmin: true`.
2. Identity Spoofing: `/invoices/i1` create with `ownerId: "other-uid"`.
3. Privilege Escalation: `/users/{uid}` create with `role: "admin"`.
4. Role Tampering: `/users/{uid}` update changing `role` from `"owner"` to `"admin"`.
5. Unverified Email Write: `/clients/c1` write with `email_verified: false`.
6. Client List Scraping: `list` `/invoices` without `where('ownerId', '==', uid)` or reading another user's docs.
7. Resource Poisoning: `/clients/{2KB_id}` create with invalid or >128 char document ID.
8. Array Bomb: `/invoices/i1` create with `items` length 500 (> 50).
9. Negative Monetary Injection: `/payments/p1` create with `amountCents: -5000`.
10. Timestamp Forgery: `/expenses/e1` create with backdated `createdAt`.
11. Terminal State Bypass: Updating a `void` invoice's `totalCents` or `status`.
12. Portal Tampering: Public client update on `/portalShares/{token}` attempting to alter `totalCents` or `ownerId`.
