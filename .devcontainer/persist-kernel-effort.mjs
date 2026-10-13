// One-instance maintenance workaround for OpenRig 0.6.9's missing effort setter.
// Default: read-only preview. --apply: private SQLite backup, then three effort
// updates in one transaction. No launch, stop, history edit, or native config edit.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { parse } from 'yaml';

export const RIG_ID = '01M4NJ0WKQBA6Y2NERN6VKYVKE';
export const TARGETS = Object.freeze({
  'advisor.lead': '01M4NJ0WKRQ1PTNMPYADY75ZWH',
  'operator.agent': '01M4NJ0WKS8B424JZW6Z2DCDG5',
  'queue.worker': '01M4NJ0WKS5HZS63A3MTFE50XE',
});
const MODEL = 'gpt-6.1-sol';
const EFFORT = 'max';
const INSTANCE_HOME = '/home/node/.openrig';
const DATABASE = INSTANCE_HOME + '/openrig.sqlite';
const TEMPLATE = '/workspace/repos/openrig/packages/daemon/specs/rigs/launch/kernel/rig-codex-only.yaml';
const selectSeats = 'SELECT id, rig_id, logical_id, runtime, model, effort FROM nodes WHERE rig_id = ? ORDER BY logical_id';
function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}

export function inspect(db) {
  const rig = db.prepare('SELECT id, name, archived_at FROM rigs WHERE id = ?').get(RIG_ID);
  requireCondition(rig?.name === 'kernel' && rig.archived_at === null, 'Expected active kernel instance was not found.');
  const rows = db.prepare(selectSeats).all(RIG_ID);
  requireCondition(rows.length === 4, 'Kernel roster changed; no repair is permitted.');
  for (const [seat, id] of Object.entries(TARGETS)) {
    const row = rows.find(r => r.logical_id === seat);
    requireCondition(row?.id === id && row.runtime === 'codex' && row.model === MODEL,
      'Seat identity, runtime, or model changed for ' + seat + '; no repair is permitted.');
    requireCondition([null, 'xhigh', EFFORT].includes(row.effort), 'Unexpected saved effort for ' + seat + '.');
  }
  const human = rows.find(r => r.logical_id === 'operator.human');
  requireCondition(human?.runtime === 'terminal' && human.model === null && human.effort === null,
    'Human terminal configuration changed; inspect it before repair.');
  return rows.filter(r => Object.hasOwn(TARGETS, r.logical_id));
}

// Hash locally only; never print conversation bodies, tokens, or other rows.
function protectedFingerprint(db) {
  const content = ['sessions', 'bindings', 'snapshots'].map(table => {
    const rows = db.prepare('SELECT * FROM "' + table + '"').all();
    return [table, rows.map(r => JSON.stringify(r)).sort()];
  });
  const nodes = db.prepare('SELECT * FROM nodes ORDER BY id').all().map(row => {
    if (Object.values(TARGETS).includes(row.id)) delete row.effort;
    return row;
  });
  return createHash('sha256').update(JSON.stringify([content, nodes])).digest('hex');
}

export function applyEffortTransaction(db, expected) {
  return db.transaction(() => {
    const before = inspect(db);
    requireCondition(JSON.stringify(before) === JSON.stringify(expected), 'Seat settings changed after preview/backup; nothing was applied.');
    const guard = protectedFingerprint(db);
    const update = db.prepare('UPDATE nodes SET effort = ? WHERE id = ? AND rig_id = ? AND runtime = ? AND model = ? AND effort IS ?');
    let changed = 0;
    for (const row of before) {
      if (row.effort === EFFORT) continue;
      const result = update.run(EFFORT, row.id, RIG_ID, 'codex', MODEL, row.effort);
      requireCondition(result.changes === 1, 'Expected exactly one effort update for ' + row.logical_id + '.');
      changed += result.changes;
    }
    const after = inspect(db);
    requireCondition(after.every(r => r.effort === EFFORT), 'Effort verification failed.');
    requireCondition(protectedFingerprint(db) === guard, 'Protected records changed; transaction rolled back.');
    return { changed, after, protectedRecordsUnchanged: true };
  }).immediate();
}

function checkTemplate() {
  const spec = parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const members = spec.pods.flatMap(p => p.members.map(m => ({ ...m, seat: p.id + '.' + m.id })));
  for (const seat of Object.keys(TARGETS)) {
    const member = members.find(m => m.seat === seat);
    requireCondition(member?.runtime === 'codex' && member.model === MODEL && member.effort === EFFORT,
      'Template does not match Sol Max for ' + seat + '.');
  }
}

async function verifyDaemon(rows, port) {
  const response = await fetch('http://127.0.0.1:' + port + '/api/rigs/' + RIG_ID + '/spec.json', { signal: AbortSignal.timeout(5000) });
  requireCondition(response.ok, 'Could not inspect the expected managed kernel through the daemon.');
  const spec = await response.json();
  requireCondition(spec.name === 'kernel' && Array.isArray(spec.pods), 'Daemon returned a different rig.');
  const seats = spec.pods.flatMap(p => p.members.map(m => ({ ...m, seat: p.id + '.' + m.id })));
  for (const row of rows) {
    const seat = seats.find(s => s.seat === row.logical_id);
    requireCondition(seat?.runtime === row.runtime && (seat.model ?? null) === row.model && (seat.effort ?? null) === row.effort,
      'Daemon and database settings differ for ' + row.logical_id + '.');
  }
}

async function main() {
  requireCondition(process.argv.length <= 3 && [undefined, '--dry-run', '--apply'].includes(process.argv[2]),
    'Usage: node .devcontainer/persist-kernel-effort.mjs [--dry-run | --apply]');
  requireCondition(process.platform === 'linux' && process.getuid() === 1000, 'Run this inside the OpenRig container as node.');
  const state = JSON.parse(fs.readFileSync(INSTANCE_HOME + '/daemon.json', 'utf8'));
  requireCondition(state.db === DATABASE && state.port === 7433, 'Instance database or port changed; stop and inspect.');
  requireCondition(fs.statSync(DATABASE).uid === process.getuid(), 'Database ownership does not match this container user.');
  checkTemplate();
  const previewDb = new Database(DATABASE, { readonly: true, fileMustExist: true });
  let before;
  try {
    before = inspect(previewDb);
    await verifyDaemon(before, state.port);
    const changes = before.map(r => ({ seat: r.logical_id, model: r.model, fromEffort: r.effort, toEffort: EFFORT }));
    if (process.argv[2] !== '--apply') {
      console.log(JSON.stringify({ mode: 'dry-run', ready: true, database: DATABASE, rigId: RIG_ID,
        ownedKeys: 'nodes.effort on these three exact seats only', changes, databaseWrites: 0 }, null, 2));
      return;
    }
    if (before.every(r => r.effort === EFFORT)) {
      console.log(JSON.stringify({ mode: 'apply', changed: 0, message: 'All three saved efforts are already max.', seats: changes }, null, 2));
      return;
    }
    const parent = INSTANCE_HOME + '/trials/kernel-persistence';
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    const operationDir = fs.mkdtempSync(parent + '/repair-');
    fs.chmodSync(operationDir, 0o700);
    const backup = operationDir + '/before.sqlite';
    await previewDb.backup(backup);
    fs.chmodSync(backup, 0o600);
    const backupDb = new Database(backup, { readonly: true, fileMustExist: true });
    try {
      requireCondition(backupDb.pragma('quick_check', { simple: true }) === 'ok', 'SQLite backup failed its integrity check.');
      requireCondition(JSON.stringify(inspect(backupDb)) === JSON.stringify(before), 'Seat settings changed during backup; nothing was applied.');
    } finally { backupDb.close(); }
    const receiptPath = operationDir + '/receipt.json';
    const receipt = { status: 'prepared', createdAt: new Date().toISOString(), database: DATABASE, rigId: RIG_ID,
      scope: 'Only nodes.effort for the three pinned kernel AI seats', backup, before, after: null };
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    const writeDb = new Database(DATABASE, { fileMustExist: true });
    writeDb.pragma('busy_timeout = 5000');
    try {
      const result = applyEffortTransaction(writeDb, before);
      receipt.status = 'applied';
      receipt.after = result.after;
      receipt.changed = result.changed;
      receipt.protectedRecordsUnchanged = result.protectedRecordsUnchanged;
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
      await verifyDaemon(result.after, state.port);
      receipt.status = 'verified';
      receipt.verifiedAt = new Date().toISOString();
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
      console.log(JSON.stringify({ mode: 'apply', status: 'verified', changed: result.changed, backup, receipt: receiptPath,
        seats: result.after.map(r => ({ seat: r.logical_id, model: r.model, effort: r.effort })),
        protectedRecordsUnchanged: true, agentRestarts: 0 }, null, 2));
    } catch (error) {
      receipt.error = error.message;
      if (receipt.status === 'prepared') receipt.status = 'not-applied';
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
      throw new Error('Repair did not complete verification. Inspect ' + receiptPath + '. ' + error.message);
    } finally { writeDb.close(); }
  } finally { previewDb.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
