#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { reviewPlan, validateScope, check } from './scope.mjs';
import { createReadOnlyPcoClient } from './pco-client.mjs';
import { openJournal } from './journal.mjs';
import { createAdapter } from './adapter.mjs';

const help = `Central Notifications PCO adapter (live writes and invitations disabled)
Usage: node scripts/event-support-harness/adapter-cli.mjs [--preview | --read-only]
  --config PATH       Reviewed scope JSON (default: selected-test-plan.json)
  --journal-dir PATH  Explicit private local directory; required for --read-only
  --preview           Offline review only; default. No credentials or journal used.
  --read-only         GET preflight, then current snapshots when all IDs are linked.
  --help              Show this help.
No execute, send, live-write, cleanup, or mutation-enabling option exists.
Credentials for read-only mode: PCO_APP_ID and PCO_SECRET environment variables.
`;
export function parseArgs(args) {
  const options = { mode: 'preview', config: fileURLToPath(new URL('./selected-test-plan.json', import.meta.url)), journalDir: null, help: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    check(['--preview', '--read-only', '--config', '--journal-dir', '--help'].includes(arg), 'Unsupported argument; live writes and invitations are disabled.', 'INVALID_ARGUMENT');
    check(!seen.has(arg), 'Duplicate argument.', 'INVALID_ARGUMENT'); seen.add(arg);
    if (arg === '--config' || arg === '--journal-dir') {
      const value = args[++index];
      check(typeof value === 'string' && value && !value.startsWith('--'), 'Argument requires a path.', 'INVALID_ARGUMENT');
      options[arg === '--config' ? 'config' : 'journalDir'] = resolve(value);
    } else if (arg === '--help') options.help = true;
    else options.mode = arg.slice(2);
  }
  check(!(seen.has('--preview') && seen.has('--read-only')), 'Choose one mode.', 'INVALID_ARGUMENT');
  check(options.help || options.mode !== 'read-only' || options.journalDir, 'Read-only mode requires an explicit private journal directory.', 'INVALID_ARGUMENT');
  return options;
}
/** Observation stays independent of the initial reschedule proposal: it must
 * remain usable after a move, a partial update, and renewed native responses. */
export async function collectReadOnlyReport(adapter) {
  const report = { preflight: await adapter.preflight() };
  if (!report.preflight.blockers.length) report.snapshots = [await adapter.capture('A'), await adapter.capture('B')];
  return report;
}
export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args); // Reject all write flags before any file or secret access.
  if (options.help) { process.stdout.write(help); return; }
  const scope = validateScope(JSON.parse(await readFile(options.config, 'utf8')));
  if (options.mode === 'preview') { process.stdout.write(`${JSON.stringify(reviewPlan(scope), null, 2)}\n`); return; }
  const client = createReadOnlyPcoClient({ appId: process.env.PCO_APP_ID, secret: process.env.PCO_SECRET });
  const journal = await openJournal({ directory: options.journalDir, runId: scope.runId });
  const adapter = createAdapter({ scope, client, journal });
  const report = await collectReadOnlyReport(adapter);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Do not serialize arbitrary transport errors, filesystem paths or JSON input.
    const code = typeof error?.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'ADAPTER_FAILED';
    process.stderr.write(`Adapter stopped (${code}). Live writes and invitations remain disabled.\n`);
    process.exitCode = 1;
  });
}
