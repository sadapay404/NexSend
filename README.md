# NexSend

Private transfer for **Digital Sheikh Nexus Training Institute** — send text, clipboard, images, videos, files and whole folders to one person or your whole team, from any browser.

Think LocalSend, but over the internet: both sides see progress live, and nothing is stored longer than three hours.

## What it does

- **Login only.** No signup. The administrator creates every account.
- **Send** text, clipboard, images, videos, files, or folders (zipped in the browser, original quality).
- **Multi-recipient** — pick one person or several.
- **Live progress** on both sides, with in-app notifications.
- **Accept or decline.** Auto-accept can be turned on for favorites or for everyone in Settings.
- **Storage guard**: uploads are refused past 9 GB total, so the free cloud tier is never billed.
- **History** keeps every transfer. Files can be re-downloaded for 3 hours, then the bytes are deleted and the row stays as `Expired`.
- **Profile pictures** users upload and manage themselves — the admin cannot change them.
- **Admin** manages usernames, display names and passwords; users can only change their own display name and photo.
- Dark only. Black + `#00A651` + white, logo from `public/logo.jpg`.
- Mobile first layout, English only.

## Roles

| | User | Admin |
|---|---|---|
| Send / receive | yes | yes |
| Change own display name | yes | yes |
| Change username or password | no | yes, for anyone |
| Create / delete accounts | no | yes |
| See every transfer on the system | no | yes |

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with `admin` / `admin`.

No database is needed for local work: without `DATABASE_URL` the app runs an embedded
Postgres (PGlite) in `.local/pglite`, and stores files in `.local/uploads`.
Change the admin password after your first sign-in on a real deployment.

## Production

Full steps are in [DEPLOY.md](DEPLOY.md). In short:

1. **Database** — Neon Postgres (free tier), copy the pooled connection string.
2. **Storage** — Cloudflare R2 (10 GB free, no egress fees), create a bucket + API token.
3. **Hosting** — import this repo into Vercel, add the environment variables, deploy.

The schema is created automatically on first request.

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | production | Neon Postgres connection string. Unset = embedded local Postgres |
| `JWT_SECRET` | production | Random string, 32+ chars, signs the 30-day session cookie |
| `R2_ACCOUNT_ID` | production | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | production | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | production | R2 token secret |
| `R2_BUCKET` | production | Bucket name, e.g. `nexsend-files` |
| `ADMIN_USERNAME` | first boot | Defaults to `admin` |
| `ADMIN_PASSWORD` | first boot | Defaults to `admin` — change it after signing in |
| `ADMIN_DISPLAY_NAME` | first boot | Defaults to `Administrator` |
| `CRON_SECRET` | optional | Protects `/api/cron/cleanup` |
| `NEXT_PUBLIC_APP_URL` | optional | Canonical URL for metadata |

## How transfers work

1. Sender picks recipients, adds text or files.
2. Files go straight from the browser to storage through a short-lived signed URL — the app server never proxies gigabytes. Files over 64 MB are uploaded in 32 MB parts, so an interrupted upload resumes where it stopped.
3. Recipients see the transfer on their next poll (every 3 seconds), accept it, and download with their own progress.
4. Three hours after sending, the stored bytes are deleted; the history row keeps name, size, sender, recipients and status.

Folders are zipped in the browser before upload, so the receiver downloads a single `.zip`.

## Project layout

```
app/                pages + API routes (App Router)
  api/state         one poll endpoint that drives the whole UI
  api/transfers     create, upload parts, complete, accept/decline, download
  admin/            user management and system activity
components/         shell, person picker, transfer cards, toasts
lib/                db, auth, storage, transfer queries, client uploader
db/schema.sql       tables and indexes
```
