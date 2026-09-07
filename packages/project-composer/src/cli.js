#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { composeProject } = require('./index');

function parseArgs(argv) {
  const options = { sourceRoot: path.resolve(__dirname, '../../..') };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--manifest') options.manifestPath = argv[++index];
    else if (value === '--output') options.output = argv[++index];
    else if (value === '--source') options.sourceRoot = argv[++index];
    else if (value === '--allow-dirty') options.allowDirty = true;
    else if (value === '--no-start') options.noStart = true;
    else if (value === '--skip-install') options.skipInstall = true;
    else if (value === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.manifestPath || !options.output) {
    console.log('Usage: pnpm site:create --manifest project.json --output C:\\Projects\\store [--no-start]');
    process.exit(options.help ? 0 : 1);
  }
  const manifest = JSON.parse(fs.readFileSync(path.resolve(options.manifestPath), 'utf8'));
  const result = await composeProject({ ...options, manifest });
  console.log(`Project generated at ${result.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
