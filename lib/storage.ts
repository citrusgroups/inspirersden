import "server-only";
import pg, { type PoolClient } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { JsonObject } from "./json";
import { sqlParams } from "./sql.mjs";

function unavailable(message: string): never {
  throw Object.assign(new Error(message), { status: 503 });
}

const state = globalThis as typeof globalThis & {
  agencyPool?: pg.Pool;
  agencyStorage?: SupabaseClient;
};

function postgresConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);
    // node-postgres lets SSL query parameters override the explicit ssl object.
    // Remove them so the local certificate policy below is applied consistently.
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
      url.searchParams.delete(key);
    return url.toString();
  } catch {
    unavailable(
      "DATABASE_URL is invalid. Copy the Session pooler URI from Supabase and URL-encode the database password.",
    );
  }
}

export function pool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    unavailable(
      "DATABASE_URL is required for Supabase Postgres. Run npm run db:setup after configuring it.",
    );
  return (state.agencyPool ??= new pg.Pool({
    connectionString: postgresConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 10000,
  }));
}

type Value = string | number | boolean | null;
class Statement {
  constructor(
    readonly sql: string,
    readonly values: Value[] = [],
    readonly client?: PoolClient,
  ) {}
  bind(...values: Value[]) {
    return new Statement(this.sql, values, this.client);
  }
  private query() {
    return (this.client || pool()).query(sqlParams(this.sql), this.values);
  }
  async first<T = JsonObject>(): Promise<T | null> {
    const result = await this.query();
    return (result.rows[0] as T | undefined) ?? null;
  }
  async all<T = JsonObject>(): Promise<{ results: T[] }> {
    const result = await this.query();
    return { results: result.rows as T[] };
  }
  async run() {
    const result = await this.query();
    return { meta: { changes: result.rowCount ?? 0 } };
  }
}
class Adapter {
  constructor(readonly client?: PoolClient) {}
  prepare(sql: string) {
    return new Statement(sql, [], this.client);
  }
  async batch(statements: Statement[]) {
    return database().transaction(async (tx) => {
      const results = [];
      for (const statement of statements)
        results.push(
          await tx
            .prepare(statement.sql)
            .bind(...statement.values)
            .run(),
        );
      return results;
    });
  }
  async transaction<T>(run: (db: Adapter) => Promise<T>) {
    const session = await pool().connect();
    try {
      await session.query("BEGIN");
      const result = await run(new Adapter(session));
      await session.query("COMMIT");
      return result;
    } catch (error) {
      await session.query("ROLLBACK");
      throw error;
    } finally {
      session.release();
    }
  }
}
export function database() {
  return new Adapter();
}

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    unavailable(
      "Supabase Storage needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  return (state.agencyStorage ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
export function storageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "agency-private";
}
function keyPath(key: string) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(key))
    throw new Error("Invalid storage key");
  return key;
}
const files = {
  async put(
    key: string,
    bytes: Uint8Array,
    options?: { httpMetadata: { contentType: string } },
  ) {
    const { error } = await storage()
      .storage.from(storageBucket())
      .upload(keyPath(key), bytes, {
        contentType:
          options?.httpMetadata.contentType || "application/octet-stream",
        upsert: false,
      });
    if (error) throw error;
  },
  async get(key: string) {
    const { data, error } = await storage()
      .storage.from(storageBucket())
      .download(keyPath(key));
    if (error && String(error.status) === "404") return null;
    if (error) throw error;
    return data ? { body: await data.arrayBuffer() } : null;
  },
  async delete(key: string) {
    const { error } = await storage()
      .storage.from(storageBucket())
      .remove([keyPath(key)]);
    if (error) throw error;
  },
  async signedUrl(key: string, expiresIn = 3600) {
    const { data, error } = await storage()
      .storage.from(storageBucket())
      .createSignedUrl(keyPath(key), expiresIn, { download: false });
    if (error || !data?.signedUrl)
      throw error || new Error("Unable to create a secure file link");
    return data.signedUrl;
  },
};
export function fileStore() {
  return files;
}
