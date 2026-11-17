# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Owner-Only Profile & PII Isolation**: `/users/{userId}` contains `email` and `subscriptionTier`; only the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) can `get`, `create`, or `update` their own profile. Collection `list` on `/users` is denied.
2. **Path-to-Parent Ownership**: Every sub-collection document under `/users/{userId}/lineProgress/{lineId}`, `/users/{userId}/customLines/{lineId}`, and `/users/{userId}/games/{gameId}` requires `isOwner(userId)`, `exists(/databases/$(database)/documents/users/$(userId))`, and `incoming().userId == request.auth.uid`.
3. **Immutable Ownership & Creation Timestamps**: `uid`, `userId`, and `createdAt` cannot be modified after creation. Server-enforced timestamps (`request.time`) are mandatory for `createdAt`, `updatedAt`, `lastPracticedAt`, and `playedAt`.
4. **Strict Key Allowlists & Type Bounds**: Every create and update enforces `hasAll` / `hasOnly` and `affectedKeys().hasOnly(...)` with string `.size()` limits, enum checks, integer bounds (`masteryPct` 0..100), and bounded arrays (`moves.size() >= 1 && moves.size() <= 40`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Profile Read**: User A attempts `get(/users/userB)` -> Denied (`isOwner(userId)` fails).
2. **User Directory Enumeration**: User A attempts `list(/users)` -> Denied (`allow list: if false`).
3. **Shadow Field Injection on Profile Create**: User A creates `/users/userA` with extra `isAdmin: true` -> Denied (`hasOnly` rejects ghost key).
4. **Unverified Email Spoof**: Unauthenticated or `email_verified: false` token attempts write -> Denied (`isVerifiedOwner`).
5. **UID Spoofing on Progress Create**: User A writes `/users/userA/lineProgress/l1` with `userId: "userB"` -> Denied (`data.userId == request.auth.uid`).
6. **Oversized Document ID Poisoning**: User A writes `/users/userA/customLines/` + 200-char ID -> Denied (`isValidId` rejects > 128 chars or invalid chars).
7. **Unbounded Array Exhaustion**: User A writes `CustomLine` with 500 moves -> Denied (`moves.size() <= 40`).
8. **Invalid Array Element Type**: User A writes `CustomLine` with `moves: [12345]` -> Denied (`moves[0] is string`).
9. **Client Timestamp Forgery**: User A writes `createdAt` in the past instead of `serverTimestamp()` -> Denied (`incoming().createdAt == request.time`).
10. **Immutable UID Mutation on Update**: User A updates `/users/userA` attempting to change `uid` or `createdAt` -> Denied (`affectedKeys().hasOnly(...)` + immutability check).
11. **Out-of-Range Mastery Score**: User A writes `masteryPct: 999` -> Denied (`data.masteryPct >= 0 && data.masteryPct <= 100`).
12. **PGN Payload Exhaustion**: User A writes `ArchivedGameRecord` with 50KB `pgn` string -> Denied (`pgn.size() <= 8000`).
