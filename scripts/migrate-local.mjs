import { DatabaseSync } from "node:sqlite";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const source = path.join(
  path.resolve(process.env.DATA_DIR || path.join(process.cwd(), ".data")),
  "agency.sqlite",
);
await access(source);
for (const key of [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!process.env[key]) throw new Error(`${key} is missing from .env.local`);
}
const tables = [
  "preferences",
  "members",
  "records",
  "versions",
  "audit",
  "clicks",
  "files",
  "invites",
  "oauth_states",
  "connections",
];
const local = new DatabaseSync(source, { readOnly: true });
const databaseUrl = new URL(process.env.DATABASE_URL);
for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  databaseUrl.searchParams.delete(key);
const client = new pg.Client({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
});
try {
  await client.connect();
  const count = await client.query("SELECT COUNT(*) AS n FROM records");
  if (Number(count.rows[0].n))
    throw new Error(
      "Supabase already has workspace records. Migration requires an empty target to prevent overwrites.",
    );
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "agency-private";
  const assets = local.prepare("SELECT id,mime FROM files").all();
  for (const item of assets) {
    const bytes = await readFile(
      path.join(path.dirname(source), "uploads", item.id),
    );
    const { error } = await supabase.storage
      .from(bucket)
      .upload(item.id, bytes, { contentType: item.mime, upsert: false });
    if (error && String(error.status) !== "409") throw error;
  }
  await client.query("BEGIN");
  try {
    for (const table of tables) {
      const columns = local
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name);
      if (!columns.length || columns.some((name) => !/^[a-z_]+$/.test(name)))
        throw new Error(`Invalid source table: ${table}`);
      const names = columns.map((name) => `"${name}"`).join(",");
      for (const row of local
        .prepare(`SELECT ${names} FROM "${table}"`)
        .all()) {
        await client.query(
          `INSERT INTO "${table}" (${names}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")}) ON CONFLICT DO NOTHING`,
          columns.map((name) => row[name]),
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  console.log(
    "Local SQLite records and private uploads copied to Supabase. Your .data directory remains available as a backup.",
  );
} finally {
  await client.end();
  local.close();
}
