# NexSend — GIGA MEGA Master Plan
**Digital Sheikh Nexus Training Institute — Internet File Sharing (LocalSend over Internet)**
**Deploy target: Vercel**

> Clean like LocalSend. No fluff. No AI slop. Full-quality transfers. Login-only. No signup.


---

## Status (live)

| Phase | State | Notes |
|---|---|---|
| 1 Discovery | ✅ done | 24 decisions locked in `ANSWERS.md` |
| 2 Architecture & foundation | ✅ done | Next.js 14 + Tailwind + Postgres (Neon / embedded PGlite), auth, storage layer |
| 3 Shell + admin user management | ✅ done | Login, dark shell, users CRUD, change own credentials |
| 4 Transfer engine + history | ✅ done | Text/clipboard/files/folders, 2 GB multipart, accept/decline, history, notifications |
| 5 Polish, security, Vercel deploy | ⏳ | App is deploy-ready (`vercel.json`, manifest, icons). Needs Neon + R2 credentials to go live |
| 6 Testing, docs, handover | ⏳ | `README.md` + `DEPLOY.md` written; admin/user guides next |

Working app today: `npm install && npm run dev` → `admin` / `admin` (embedded database, no setup).

---

## Brand / Visual Identity (from logo)

Logo: `public/logo.jpg` — "DIGITAL SHEIKH NEXUS / TRAINING INSTITUTE"
Mark: white angular "D/N" monogram + green "D" loop on black wave, on green/black background.

**Palette (exact to logo):**
- Primary Green: `#00A651` (logo green — vibrant, not neon, not dark)
- Deep Green: `#00803D` (gradient / hover / borders)
- Black: `#000000` (header, sidebar, wave, cards on dark)
- White: `#FFFFFF` (text, logo mark, buttons)
- Light Grey: `#F5F5F5` (page background)
- Mid Grey: `#E5E7EB` (borders, dividers)

**Typography:** Inter / system sans — bold, tight, like LocalSend. No decorative fonts.
**Favicon / Tab logo:** `public/logo.jpg` cropped to square + `public/favicon.ico` + `apple-touch-icon`. Must show in browser tab.
**UI tone:** LocalSend minimal — left nav, center dropzone, right history. No gradients except subtle green→black wave in header (from logo). No emojis in UI. No marketing copy.

---

## Product Definition

**What it is:** A private, login-only web app for the academy to send files over the internet at full original quality. Same mental model as LocalSend: pick a file → pick a person → send → history.

**What it is NOT:** No public signup. No guest access. No compression. No ads. No tracking.

### Core User Model
- **User:** `id, username (private, login), passwordHash (private), displayName (public, shown to others), role (admin|user), createdAt, lastSeen`
- **Username ≠ Display Name.** Username is private (login only, never shown to other users). Display Name is what others see in the "Send to" list.
- **Admin:** Only role that can: add user, remove user, change any username/password, change own credentials. Regular users cannot see admin controls.
- **Auth:** Username + password → signed httpOnly cookie (JWT session). Cookie persists (e.g. 30 days) so user doesn't log in every time. Logout clears cookie. No signup route exists (404 if visited).

### Transfer Types (LocalSend parity)
1. **Text** — type/paste text, send to one or many people
2. **Clipboard** — one-click "Send my clipboard" (requires browser permission)
3. **Images** — JPG/PNG/WebP/GIF, full quality, no compression, preview thumbnail
4. **Videos** — MP4/MOV/WebM, full quality, streaming preview where possible
5. **Files** — any file type, full quality, chunked upload
6. **Folders** — select folder → zip client-side OR upload tree; receiver downloads as zip (decision needed in Phase 1)

### Flow (LocalSend clone)
1. Logged-in user lands on **Send** screen
2. User picks type (Text / Clipboard / File / Folder) or drags files
3. App shows **"Send to" list**: all other registered users by Display Name (+ online dot if real-time), with search
4. User selects one or multiple recipients → clicks Send
5. Upload progress bar per file, per recipient
6. Receiver gets **Incoming** notification (in-app + optional email/push), sees preview, clicks Accept → downloads
7. Both sender & receiver see entry in **History** (full history like LocalSend: who, what, when, size, status)

### History
- Per-user history: sent + received, filterable (All / Sent / Received), search, re-download, delete own copy
- Admin can view all? (decision needed)
- Retention: keep until manually deleted OR auto-delete after X days (decision needed)

### Storage & Limits (Vercel constraint)
- Vercel serverless has 4.5MB body limit → **cannot** stream large files through Vercel functions alone.
- Solution: **Direct-to-storage uploads** (Supabase Storage / Cloudflare R2 / Firebase Storage / S3) via signed URLs. Vercel only handles auth + metadata + signed URL issuance.
- Files stored encrypted at rest, served via signed download URLs (expire in e.g. 7 days).
- Need to decide: max file size, storage provider, cost owner.

---

## 6 Phases

### Phase 1 — Discovery (NOW)
**Goal:** Zero assumptions. Lock every decision before code.
- Ask all questions (see below)
- Confirm: stack, storage, file limits, history retention, folder handling, real-time vs polling, admin count, email notifications, mobile support, offline behavior
- Output: This plan + answers doc (`ANSWERS.md`) + locked decisions

**Exit criteria:** User answers Phase 1 questions. No code written yet except repo clear + logo saved.

### Phase 2 — Architecture & Foundation
**Goal:** Scaffold that can scale, secure by default.
- Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn-style clean components (LocalSend look)
- DB: Postgres (Supabase / Neon / PlanetScale — TBD) — tables: `users, transfers, transfer_items, transfer_recipients, sessions`
- Auth: bcrypt/argon2 password hash, JWT httpOnly cookie, middleware protection, rate-limit login, admin-only routes
- Storage: Direct upload via signed URLs (Supabase Storage / R2 — TBD), virus scan optional, chunked/resumable for >100MB
- Realtime: Supabase Realtime OR polling (5s) OR SSE — TBD
- Favicon + OG image from logo, `layout.tsx` with green/black theme
- Env: `DATABASE_URL, STORAGE_*, JWT_SECRET, ADMIN_SEED_*`
- Output: Repo with login working, empty shell, DB migrated, Vercel deploy preview

### Phase 3 — Core Shell + User Management (Admin)
**Goal:** Login-only app with LocalSend layout, admin can manage people.
- Pages: `/login`, `/` (Send), `/history`, `/incoming`, `/settings`, `/admin/users` (admin only)
- Layout: Top bar (logo + display name + logout), left nav (Send, Incoming, History, Settings, Users if admin), main content
- Send screen: type tabs (Text/Clipboard/Files/Folders), drag-drop zone, "Send to" list (Display Names only, search, multi-select, online status)
- Admin Users page: list users (username + display name + role + last active), Add User (username, display name, temp password), Edit (change username/password/display name), Remove (confirm, cannot remove self/last admin), Change own password
- Security: middleware blocks unauthenticated, admin routes 403 for non-admin, audit log for admin actions
- Output: Fully navigable app, user CRUD works, no transfers yet

### Phase 4 — Transfer Engine + History
**Goal:** Full-quality sending for all 6 types + history.
- Text: textarea → save as `text` transfer, receiver views + copy + download `.txt`
- Clipboard: `navigator.clipboard.readText()` with permission prompt, fallback to paste box
- Images/Videos/Files: drag-drop, preview, progress bar, chunked upload to storage, metadata saved, signed download URL
- Folders: client-side zip (JSZip) OR tree upload — per Phase 1 answer; show folder name + file count + total size
- Recipients: one-to-many, per-recipient status (pending/accepted/downloaded/expired)
- Incoming: badge count, Accept/Decline, download all as zip if multiple
- History: table/cards like LocalSend (icon, name, size, time, direction arrow), filter, search, re-download, delete
- Notifications: in-app toast + badge; optional email (Resend) — TBD
- Output: End-to-end send → receive → download works for all types

### Phase 5 — Polish, Security & Vercel Deploy
**Goal:** Clean, fast, secure, production-ready.
- UI polish: match LocalSend spacing, green/black theme, dark mode optional, mobile responsive, empty states, loading skeletons
- Security: CSP headers, rate limiting, file type allowlist/blocklist, max size enforcement, signed URL expiry, CSRF, audit log
- Performance: image thumbnails (client-side), video poster, lazy load history, pagination
- Favicon/tab: `logo.jpg` → favicon, OG image, PWA manifest (installable)
- Vercel: env vars, custom domain (TBD), analytics off by default, error tracking (Sentry optional)
- Output: Production deploy on Vercel, logo in tab, all routes protected

### Phase 6 — Testing, Docs & Handover
**Goal:** Academy can use it without developer.
- Test: login/logout, admin CRUD, all 6 transfer types, large file (e.g. 500MB), folder, history, mobile, expired links
- Docs: `README.md` (setup, env, deploy), `ADMIN_GUIDE.md` (how to add/remove users, change passwords), `USER_GUIDE.md` (how to send)
- Seed: first admin account creation flow (env-seeded, then forced password change)
- Backup: DB backup + storage versioning notes
- Output: Handover complete, academy live

---

## Risks / Open Decisions — ALL LOCKED (Phase 1 complete, 24 Qs)
- Storage: Cloudflare R2 (10GB free) + Neon Postgres (free). Files expire 1h. Metadata forever until deleted.
- Folder: Zip in browser, send as one .zip.
- Realtime: Both online, live progress both sides, instant receiving (polling/SSE + chunked upload).
- History: Metadata forever until deleted. File bytes 1h window. Admin sees all even after delete.
- Notifications: In-app only.
- Mobile: Yes.
- Admin: Single admin, hardcoded admin/admin (change ASAP). Admin sets all passwords. Users change only Display Name.
- Passwords: Admin sets. Users cannot change password. Admin can change any incl. own.

---

## Phase 1 Questions — DONE (24/24 answered)

See `ANSWERS.md` for full locked spec. Phase 1 exit criteria met. Ready for Phase 2.

---

*Repo cleared 2026-11-24. Logo saved to `public/logo.jpg`. Phase 1 complete — no app code yet.*
