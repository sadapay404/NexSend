# Deploying NexSend

Three free services, about 15 minutes.

## 1. Database — Neon Postgres

1. Create a project at [neon.tech](https://neon.tech) (free tier is plenty for 20 users).
2. Copy the **pooled** connection string — it looks like
   `postgresql://user:pass@ep-cool-name-pooler.eu-central-1.aws.neon.tech/nexsend?sslmode=require`.
3. Keep it for step 3 as `DATABASE_URL`.

Tables are created automatically the first time the app touches the database.

## 2. Storage — Cloudflare R2

1. Cloudflare dashboard → **R2** → create a bucket, e.g. `nexsend-files`.
2. **Manage R2 API Tokens** → create a token with *Object Read & Write* for that bucket.
3. Note the **Access Key ID**, **Secret Access Key** and your **Account ID** (top right of the R2 page).
4. Add a CORS rule on the bucket so browsers can upload directly:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 gives 10 GB free with no egress fees. Files are deleted an hour after sending,
so this is far more than 20 people will ever use.

## 3. Hosting — Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new) — the framework is detected as Next.js.
2. Add the environment variables:

```
DATABASE_URL=postgresql://...neon.tech/nexsend?sslmode=require
JWT_SECRET=<32+ random characters>
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret>
R2_BUCKET=nexsend-files
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
ADMIN_DISPLAY_NAME=Administrator
CRON_SECRET=<another random string>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

3. Deploy. Open the URL, sign in with `admin` / `admin`.

`vercel.json` registers a daily cleanup job that removes expired files.
On Hobby plans a cron can run once a day; the app also sweeps expired objects
opportunistically while people use it, so files never outlive the hour for long.

## 4. First five minutes after deploy

1. Sign in as `admin` / `admin`.
2. **Users** → edit the Administrator row → set your real username and a strong password.
   (You stay signed in; the next login uses the new credentials.)
3. **Users** → add everyone else with a username, display name and password.
4. Hand each person their username and password. They sign in, land on **Send**, and can
   change only their display name in **Settings**.
5. Send yourself a test file from a second browser to confirm storage works.

## Notes

- **Sessions** last 30 days (httpOnly cookie). Signing out clears it.
- **Passwords** are bcrypt hashes; nobody, including the admin panel, can read them.
- **Reset a password**: Users → edit → type a new password → save.
- **Delete a person**: Users → trash icon. Their transfers disappear from everyone's lists;
  the admin Activity page keeps the record of what was sent.
- **Limits**: 2 GB per file, one or many recipients, folders zipped in the browser.
- **No external database needed for local work** — `npm run dev` without `DATABASE_URL`
  uses an embedded Postgres and local disk storage.
