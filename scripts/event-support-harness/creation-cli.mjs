#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { check, validateScope } from './scope.mjs';
import { reviewCreation } from './creation-plan.mjs';
import { createCreationPcoClient } from './creation-client.mjs';
import { createAdapter } from './adapter.mjs';
import { openJournal } from './journal.mjs';

const help = `Central Notifications: bounded empty-plan creation (invitations disabled)
Usage: node scripts/event-support-harness/creation-cli.mjs [--preview]
  --config PATH       Scope JSON; defaults to selected-test-plan.json
  --preview           Offline exact creation manifest; default, no credentials
  --execute-create    Create only the reviewed empty A/B plans and their times
  --approve-hash HASH Exact manifest hash reviewed and explicitly authorized
  --journal-dir PATH  Dedicated private directory; required for execution
  --help              Show help without credentials or network
Execution requires all three execution arguments and complete source links.
Use only after human approval of the exact manifest. No send, assignment,
reschedule, Calendar setup, template import, or deletion option exists.
Credentials for execution: PCO_APP_ID and PCO_SECRET environment variables.
`;

export function parseCreationArgs(args) {
  const options = { mode: 'preview', config: fileURLToPath(new URL('./selected-test-plan.json', import.meta.url)), journalDir: null, approvalHash: null, help: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    check(['--preview', '--execute-create', '--config', '--journal-dir', '--approve-hash', '--help'].includes(arg), 'Unsupported creation argument.', 'INVALID_ARGUMENT');
    check(!seen.has(arg), 'Duplicate argument.', 'INVALID_ARGUMENT'); seen.add(arg);
    if (['--config', '--journal-dir', '--approve-hash'].includes(arg)) {
      const value = args[++index];
      check(typeof value === 'string' && value && !value.startsWith('--'), 'Argument requires a value.', 'INVALID_ARGUMENT');
      if (arg === '--approve-hash') {
        check(/^[a-f0-9]{64}$/.test(value), 'Invalid approval hash.', 'INVALID_ARGUMENT');
        options.approvalHash = value;
      } else options[arg === '--config' ? 'config' : 'journalDir'] = resolve(value);
    } else if (arg === '--help') options.help = true;
    else options.mode = arg === '--preview' ? 'preview' : 'execute-create';
  }
  check(!(seen.has('--preview') && seen.has('--execute-create')), 'Choose one mode.', 'INVALID_ARGUMENT');
  check(options.mode !== 'preview' || !options.approvalHash && !options.journalDir, 'Execution arguments require --execute-create.', 'INVALID_ARGUMENT');
  check(options.help || options.mode !== 'execute-create' || options.approvalHash && options.journalDir, 'Execution requires the reviewed hash and a private journal directory.', 'INVALID_ARGUMENT');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseCreationArgs(args);
  if (options.help) { process.stdout.write(help); return; }
  const scope = validateScope(JSON.parse(await readFile(options.config, 'utf8')));
  const review = reviewCreation(scope);
  if (options.mode === 'preview') { process.stdout.write(`${JSON.stringify(review, null, 2)}\n`); return; }
  // Validate approval and completeness before opening a journal, reading secrets,
  // or constructing a network client. A preview hash is not human authorization.
  check(options.approvalHash === review.approvalHash, 'Approval does not match this creation manifest.', 'CREATION_APPROVAL_REQUIRED');
  check(!review.blockers.length, 'Creation setup is incomplete.', 'SETUP_REQUIRED');
  const journal = await openJournal({ directory: options.journalDir, runId: scope.runId });
  const client = createCreationPcoClient({ scope, approvalHash: options.approvalHash, journal, appId: process.env.PCO_APP_ID, secret: process.env.PCO_SECRET });
  const adapter = createAdapter({ scope, client, journal });
  const result = await adapter.executeCreation({ approvalHash: options.approvalHash });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const code = typeof error?.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'CREATION_FAILED';
    process.stderr.write(`Creation stopped (${code}). Invitations remain disabled. Preserve the journal; inspect any uncertain outcome before continuing.\n`);
    process.exitCode = 1;
  });
}
