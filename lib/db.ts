import { Pool } from "pg";

/**
 * Database layer.
 *
 * Production (Vercel): Neon Postgres via DATABASE_URL.
 * Local preview: embedded Postgres (PGlite, real Postgres in WASM) so the app
 * runs with zero setup. Both speak the same SQL, so nothing else changes.
 */

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
  pglite?: Promise<any>;
  ready?: Promise<void>;
  initializing?: boolean;
};

function isPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    const url = process.env.DATABASE_URL as string;
    globalForDb.pgPool = new Pool({
      connectionString: url,
      ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return globalForDb.pgPool;
}

async function getPglite() {
  if (!globalForDb.pglite) {
    globalForDb.pglite = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const { mkdir } = await import("fs/promises");
      const path = await import("path");
      const dir =
        process.env.PGLITE_DIR ||
        (process.env.VERCEL
          ? "/tmp/nexsend/pglite"
          : path.join(process.cwd(), ".local", "pglite"));
      await mkdir(dir, { recursive: true });
      const db = new PGlite(dir);
      await db.waitReady;
      return db;
    })().catch((e) => {
      globalForDb.pglite = undefined;
      throw e;
    });
  }
  return globalForDb.pglite;
}

async function applySchema(): Promise<void> {
  const { SCHEMA_SQL } = await import("./schema");
  if (isPostgres()) {
    await getPool().query(SCHEMA_SQL);
    return;
  }
  const db = await getPglite();
  await db.exec(SCHEMA_SQL);
}

async function createFirstAdmin(): Promise<void> {
  const rows = await rawQuery<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users"
  );
  if (Number(rows[0]?.count ?? 0) > 0) return;

  const { hashPassword } = await import("./password");
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin";
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? "Administrator";
  const hash = await hashPassword(password);

  await rawQuery(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin') ON CONFLICT (username) DO NOTHING`,
    [username, hash, displayName]
  );

  // Preview deployments run on an ephemeral database; keep a demo team so the
  // UI always has faces to show. Never enabled unless DEMO_SEED=1.
  if (process.env.DEMO_SEED === "1") {
    const demoHash = await hashPassword("pass123");
    const demo = [
      ["sara", "Sara Khan"],
      ["bilal", "Bilal Ahmed"],
      ["ayesha", "Ayesha Noor"],
    ];
    for (const [u, name] of demo) {
      await rawQuery(
        `INSERT INTO users (username, password_hash, display_name, role)
         VALUES ($1, $2, $3, 'user') ON CONFLICT (username) DO NOTHING`,
        [u, demoHash, name]
      );
    }
    const sender = await rawQuery<{ id: string }>(
      `SELECT id FROM users WHERE username = $1`,
      [username]
    );
    const first = await rawQuery<{ id: string }>(
      `SELECT id FROM users WHERE username = 'sara'`
    );
    if (sender[0] && first[0]) {
      const t = await rawQuery<{ id: string }>(
        `INSERT INTO transfers (sender_id, type, text_content, status)
         VALUES ($1, 'text', $2, 'ready') RETURNING id`,
        [sender[0].id, "Welcome to NexSend. This is a demo message."]
      );
      if (t[0]) {
        await rawQuery(
          `INSERT INTO transfer_recipients (transfer_id, recipient_id, status)
           VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
          [t[0].id, first[0].id]
        );
      }
    }
  }
}

async function ensureReady(): Promise<void> {
  if (globalForDb.initializing) return;
  if (!globalForDb.ready) {
    globalForDb.initializing = true;
    globalForDb.ready = (async () => {
      await applySchema();
      await createFirstAdmin();
      globalForDb.initializing = false;
    })().catch((e) => {
      globalForDb.initializing = false;
      globalForDb.ready = undefined;
      throw e;
    });
  }
  return globalForDb.ready;
}

async function rawQuery<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (isPostgres()) {
    const res: any = await getPool().query(text, params as any[]);
    return res.rows as T[];
  }
  const db = await getPglite();
  const res = await db.query(text, params as any[]);
  return res.rows as T[];
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureReady();
  return rawQuery<T>(text, params);
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function initDb(): Promise<void> {
  await ensureReady();
}
