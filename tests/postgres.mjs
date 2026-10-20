import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { sqlParams } from '../lib/sql.mjs';
import { detachCreator } from '../lib/relations.mjs';

const db = new PGlite();
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
  const tables = ['audit','clicks','connections','files','invites','members','oauth_states','preferences','records','versions','agent_conversations','agent_messages','agent_actions','webhook_events'];
  for (const table of tables) assert((await db.query('SELECT to_regclass($1) AS t', [table])).rows[0].t, `${table} missing`);
  assert.equal(sqlParams('SELECT * FROM records WHERE id=? AND version=?'), 'SELECT * FROM records WHERE id=$1 AND version=$2');
  const insert = sqlParams('INSERT OR IGNORE INTO records (id,kind,data,created,updated) VALUES (?,?,?,?,?)');
  assert(insert.endsWith('ON CONFLICT DO NOTHING'));
  const row = ['INF-123','influencer','{"name":"Sample"}',new Date().toISOString(),new Date().toISOString()];
  assert.equal((await db.query(insert,row)).rowCount,1);
  assert.equal((await db.query(insert,row)).rowCount,0);
  const lead = {name:'Brand',influencerId:'INF-123',reference:'INF-123',notes:'Keep this inquiry'};
  const campaign = {influencerIds:['INF-123','INF-OTHER'],status:'Active'};
  const pkg = {influencerIds:['INF-123'],price:100};
  assert.deepEqual(detachCreator(lead,'INF-123'),{...lead,influencerId:'',reference:''});
  assert.deepEqual(detachCreator(campaign,'INF-123').influencerIds,['INF-OTHER']);
  assert.deepEqual(detachCreator(pkg,'INF-123').influencerIds,[]);
  assert.equal(detachCreator(campaign,'MISSING'),null);
  assert.equal((await db.query('SELECT relrowsecurity FROM pg_class WHERE relname=$1',['records'])).rows[0].relrowsecurity,true);
  console.log('PASS: PostgreSQL schema, RLS, SQL parameter conversion, conflict handling and safe influencer relation cleanup.');
} finally { await db.close(); }
