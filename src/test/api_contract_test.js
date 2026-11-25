const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sql = fs.readFileSync('sql/001_factory_live.sql', 'utf8');
const calls = [];
const context = { fetch: async (url, opts) => {
  const name = url.split('/').pop(), payload = JSON.parse(opts.body);
  const signature = new RegExp('function\\s+' + name + '\\(([^)]*)\\)', 'i').exec(sql);
  assert.ok(signature, name + ' exists in the real SQL schema');
  const expected = signature[1].split(',').map(a => a.trim().split(/\s+/)[0].toLowerCase()).sort();
  assert.deepEqual(Object.keys(payload).sort(), expected, name + ' JSON argument names match PostgreSQL');
  calls.push(name);
  return { ok: true, text: async () => 'null' };
}};
vm.createContext(context); vm.runInContext(fs.readFileSync('app/api.js', 'utf8'), context);
const api = context.FLApi.SupabaseApi({ url: 'https://test.invalid', key: 'test' });
(async () => {
  await api.submit('a', 't', 1, true, 2, null);
  await api.report('a', 't', 'b', 'trial', 2, 9);
  await api.confirm('a', 't', 'trial', 2, true);
  await api.hostRun('TEST', 'key', 'a', 'trial', 2, 9);
  await api.hostDecide('TEST', 'key', 'a', 1, true, 2, null);
  assert.equal(calls.length, 5);
  console.log('PASS: all five RPC payloads match deployed-schema argument names');
})().catch(e => { console.error(e); process.exitCode = 1; });
