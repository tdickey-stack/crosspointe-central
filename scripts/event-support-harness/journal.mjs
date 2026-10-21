import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink, chmod } from 'node:fs/promises';
import { resolve, parse, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const fail = (code, message) => Object.assign(new Error(message), { code });
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
async function statIfPresent(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function checkDirectory(path, create = false) {
  const root = parse(path).root;
  let current = root;
  for (const part of path.slice(root.length).split('/').filter(Boolean)) {
    current = join(current, part);
    if (create) { try { await mkdir(current, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail('JOURNAL_UNSAFE_PATH', 'Journal directories must be real directories without symlinks.');
  }
}
function validate(state, runId) {
  if (!isRecord(state) || state.schemaVersion !== 1 || state.runId !== runId || !isRecord(state.operations) || !Array.isArray(state.snapshots) || !Array.isArray(state.history)) throw fail('JOURNAL_INVALID_STATE', 'Journal state is invalid or belongs to another run; manual recovery is required.');
}
function safe(error) { return error?.code?.startsWith('JOURNAL_') ? error : fail('JOURNAL_IO_FAILED', 'Journal operation failed; manual inspection may be required.'); }
/** Local journal only. No automatic stale-lock stealing or corruption recovery. */
export async function openJournal({ directory, runId } = {}) {
  if (typeof directory !== 'string' || !directory.trim() || typeof runId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(runId ?? '')) throw fail('JOURNAL_INVALID_CONFIGURATION', 'An explicit journal directory and valid run ID are required.');
  const folder = resolve(directory);
  const statePath = join(folder, `${runId}.json`);
  const lockPath = join(folder, `${runId}.lock`);
  try { await checkDirectory(folder, true); await chmod(folder, 0o700); } catch (error) { throw safe(error); }
  async function syncDirectory() {
    const handle = await open(folder, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await handle.sync(); } finally { await handle.close(); }
  }
  async function readState() {
    await checkDirectory(folder);
    const stat = await statIfPresent(statePath);
    if (!stat) return { schemaVersion: 1, runId, operations: {}, snapshots: [], history: [] };
    if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) throw fail('JOURNAL_UNSAFE_PATH', 'Journal state must be a regular file without links.');
    if ((stat.mode & 0o777) !== 0o600 || stat.size > 10 * 1024 * 1024) throw fail('JOURNAL_INVALID_STATE', 'Journal state permissions or size are invalid; manual recovery is required.');
    const handle = await open(statePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat();
      if (opened.ino !== stat.ino || opened.dev !== stat.dev) throw fail('JOURNAL_UNSAFE_PATH', 'Journal file changed while opening.');
      let state;
      try { state = JSON.parse(await handle.readFile('utf8')); } catch { throw fail('JOURNAL_INVALID_STATE', 'Journal state is corrupted; manual recovery is required.'); }
      validate(state, runId);
      return state;
    } finally { await handle.close(); }
  }
  async function inspect() { try { return clone(await readState()); } catch (error) { throw safe(error); } }
  async function withLock(callback) {
    let lock;
    let lockStat;
    let active = false;
    let saving = false;
    let pendingSave;
    let callbackStarted = false;
    try {
      await checkDirectory(folder);
      try { lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
      catch (error) { if (error.code === 'EEXIST' || error.code === 'ELOOP') throw fail('JOURNAL_LOCKED', 'Journal lock exists; wait for its owner or perform explicit manual recovery.'); throw error; }
      lockStat = await lock.stat();
      await lock.writeFile(JSON.stringify({ runId, pid: process.pid, token: randomUUID() }));
      await lock.sync();
      await syncDirectory();
      const state = await readState();
      active = true;
      const session = {
        state,
        save() {
          if (!active || saving) return Promise.reject(fail('JOURNAL_SESSION_INACTIVE', 'Journal save requires one active locked session.'));
          saving = true;
          pendingSave = (async () => {
            let tempPath;
            try {
              validate(session.state, runId);
              const serialized = JSON.stringify(session.state);
              validate(JSON.parse(serialized), runId);
              if (Buffer.byteLength(serialized) > 10 * 1024 * 1024) throw fail('JOURNAL_INVALID_STATE', 'Journal state exceeds the size limit.');
              await checkDirectory(folder);
              const owned = await lstat(lockPath);
              if (owned.isSymbolicLink() || owned.ino !== lockStat.ino || owned.dev !== lockStat.dev) throw fail('JOURNAL_LOCK_LOST', 'Journal lock ownership changed.');
              // Revalidate existing state before replacing it, including corruption.
              await readState();
              tempPath = join(folder, `.${runId}.${randomUUID()}.tmp`);
              const temp = await open(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
              try { await temp.writeFile(`${serialized}\n`); await temp.sync(); } finally { await temp.close(); }
              await rename(tempPath, statePath);
              tempPath = undefined;
              await syncDirectory();
            } catch (error) { throw safe(error); }
            finally { if (tempPath) await unlink(tempPath).catch(() => {}); saving = false; }
          })();
          return pendingSave;
        },
      };
      callbackStarted = true;
      const result = await callback(session);
      active = false;
      if (pendingSave) await pendingSave;
      return result;
    } catch (error) {
      active = false;
      if (pendingSave) await pendingSave.catch(() => {});
      if (callbackStarted) throw error;
      throw safe(error);
    }
    finally {
      active = false;
      if (lock) {
        await lock.close().catch(() => {});
        const owned = await statIfPresent(lockPath).catch(() => null);
        if (owned && !owned.isSymbolicLink() && owned.ino === lockStat?.ino && owned.dev === lockStat?.dev) await unlink(lockPath).catch(() => {});
      }
    }
  }
  return Object.freeze({ withLock, inspect });
}
