#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { runSimulation } from './domain.mjs';

try {
  const args = process.argv.slice(2);
  let fixturePath = new URL('./fixture.json', import.meta.url);
  let seenFixture = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') continue;
    if (args[i] === '--help') { help = true; continue; }
    if (args[i] === '--fixture' && !seenFixture && args[i + 1] && !args[i + 1].startsWith('--')) {
      fixturePath = args[++i]; seenFixture = true; continue;
    }
    throw new Error(`Unsupported argument: ${args[i]}. Only --dry-run, --fixture PATH and --help are allowed; live execution is unavailable.`);
  }
  if (help) {
    console.log('Usage: node scripts/event-support-harness/cli.mjs [--dry-run] [--fixture PATH]\nOffline simulation only. No credentials, network, PCO writes, invitations or database access.\nJSON goes to stdout; redirect it to a local file to retain the simulated journal.');
  } else {
    const raw = await readFile(fixturePath, 'utf8');
    if (raw.length > 100000) throw new Error('Fixture exceeds 100 KB limit');
    const result = runSimulation(JSON.parse(raw));
    console.log(JSON.stringify(result, null, 2));
    if (result.checks.some(check => !check.passed)) process.exitCode = 1;
  }
} catch (error) {
  console.error(`Dry-run harness failed: ${error.message}`);
  process.exitCode = 1;
}
