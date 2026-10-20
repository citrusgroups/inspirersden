export function sqlParams(sql) {
  let index = 0;
  let query = sql.replace(/\?/g, () => '$' + ++index);
  if (/^INSERT OR IGNORE INTO /i.test(query)) {
    query = query.replace(/^INSERT OR IGNORE INTO /i, 'INSERT INTO ') + ' ON CONFLICT DO NOTHING';
  }
  return query;
}
