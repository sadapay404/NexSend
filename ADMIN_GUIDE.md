# Admin guide — NexSend

You are the only administrator. Everything about accounts starts and ends with you.

## Signing in the first time

Open the site, sign in with `admin` / `admin`.

**Change it immediately:**

1. **Users** in the left menu.
2. The **Administrator** row → pencil icon.
3. Set your real username, display name and a new password → **Save changes**.

You stay signed in. Next time use the new credentials.

## Adding a person

1. **Users** → **Add user**.
2. Display name — what everyone sees, e.g. `Sara Khan`.
3. Username — private login name, e.g. `sara`. Letters, numbers, dot, dash, underscore.
4. Password — give them something simple, they cannot change it themselves.
5. **Create user**, then send them the link, username and password.

They appear in everyone's **Send to** list straight away.

## Changing someone's username or password

**Users** → pencil icon on their row → change what you need → **Save changes**.
Leave the password empty to keep the current one.

If someone forgot their password, set a new one and tell them. Old sessions stay
valid for up to 30 days, so if the account was compromised also consider deleting
and re-creating it.

## Removing a person

**Users** → trash icon → **Delete**.

Their transfers disappear from everyone's lists. The **Activity** page keeps the
record of what they sent and received, including name, size and time.

You cannot delete yourself, and other admin rows are protected.

## Activity

**Activity** shows every transfer on the system in time order: sender, recipients,
file name and size, whether the download window is still open, and whether the
sender removed it from their own history. It never shows file contents after the
three hours are over — the bytes are gone at that point.

## Display names and photos

Users change their own display name and profile picture. Username and password are
yours. Photos are self-managed by design — you cannot set or clear someone else's.

## Storage and retention

- Files are stored for **3 hours** after sending, then deleted.
- Uploads stop automatically at **9 GB** so the 10 GB free storage allowance is never exceeded. If the banner says storage is full, press **Clear expired** and ask senders to retry.
- History rows stay until someone removes them; you always see them in **Activity**.
- Each transfer can be up to **2 GB**. Folders are zipped in the sender's browser.
- Free tiers used: Neon Postgres (database) and Cloudflare R2 (file storage, 10 GB).

## If something goes wrong

| Symptom | What to do |
|---|---|
| Someone cannot sign in | Reset their password in **Users** |
| A file will not download | It may be past the 3 hour window — ask the sender to send again |
| Upload fails on a huge file | Ask them to try again; uploads resume where they stopped |
| You locked yourself out | In Vercel, update `ADMIN_USERNAME` / `ADMIN_PASSWORD` and delete the admin row in the database, then reload the site — a fresh admin is created on the next request |
