import { initDb, query } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function main() {
  await initDb();

  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin";
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? "Administrator";
  const hash = await hashPassword(password);

  await query(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, hash, displayName]
  );

  console.log(`Admin ready: ${username}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
