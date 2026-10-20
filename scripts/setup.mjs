import { readFile } from "node:fs/promises";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

for (const key of [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!process.env[key]) throw new Error(`${key} is missing from .env.local`);
}
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "agency-private";
const databaseUrl = new URL(process.env.DATABASE_URL);
for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  databaseUrl.searchParams.delete(key);
const client = new pg.Client({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
});
try {
  await client.connect();
  await client.query(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (error) {
    if (String(error.status) !== "404") throw error;
    const created = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
    });
    if (created.error) throw created.error;
  } else if (data.public) {
    throw new Error(
      `The ${bucket} bucket must be private. Change its visibility in Supabase Storage.`,
    );
  }
  console.log(
    `Supabase tables and private Storage bucket '${bucket}' are ready.`,
  );
} finally {
  await client.end();
}
