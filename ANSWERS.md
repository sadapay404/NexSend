# Phase 1 Answers — FINAL (2026-11-24)
**24 questions answered. All decisions locked. Phase 1 complete.**

## Round 4 (final)
1. **Text size:** No limit. ✓
2. **Preview:** Yes, preview everything (image thumbnails, video player, file icon). ✓
3. **Favorites:** Star icon in Send to list. ✓
4. **Settings:** FULL like LocalSend (Display Name, Auto-accept mode, Favorites, plus LocalSend-style prefs). ✓
5. **Session:** 30 days. ✓
6. **Language:** English only. ✓

## Complete locked spec
| Area | Decision |
|---|---|
| App | NexSend — LocalSend over internet, login-only, no signup |
| Deploy | Vercel, vercel.app subdomain |
| Users | <20, single admin (hardcoded admin/admin, change ASAP) |
| Auth | Username (private) + password, httpOnly cookie 30 days, no signup route |
| Roles | Admin sets username/displayName/password for all. Users can change ONLY displayName. Admin can change any password incl. own. |
| Names | Username private, Display Name public. Admin sets both. User can edit own Display Name. |
| Storage | Free tier: Cloudflare R2 (10GB free, recommended) + Neon Postgres (free). Files expire 1h after send. Metadata forever until deleted. Admin sees all metadata even after user delete. |
| Max size | 1GB normal, sometimes bigger → support up to 2GB chunked/resumable |
| Types | Text (no limit), Clipboard (auto-read + paste fallback), Images, Videos, Files, Folders (zip in browser) |
| Flow | Both online, live progress both sides, instant receiving. Multi-recipient (one or many). |
| Accept | Default Accept required. Settings: auto-accept for Favs or All. Favs = star in Send to list. |
| History | Metadata forever until deleted. File bytes 1h window for re-download. Admin sees all. |
| Notifications | In-app only (toast + badge). |
| Mobile | Yes, responsive + camera roll. |
| Theme | Dark only: black #000, green #00A651, white. Logo wave in header. |
| Preview | Yes, everything. |
| Settings | FULL like LocalSend. |
| Language | English only. |
| Logo | public/logo.jpg → favicon + tab + OG. |

## Phase 2 ready
Next: scaffold Next.js + DB + auth + storage + dark theme + login working.
