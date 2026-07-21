#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin', 'cli.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-cli-'));
const env = { ...process.env, CODEX_HOME: temp };
const target = path.join(temp, 'skills', 'npm-package-guard');

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });
  assert.strictEqual(result.status, expected, `${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
}

try {
  assert.match(run(['--help']), /npm-package-guard update/);

  let output = run(['install', '--no-hook']);
  assert.match(output, /INSTALLED/);
  assert.strictEqual(fs.readFileSync(path.join(target, '.npm-package-guard-version'), 'utf8').trim(), '0.1.0');
  assert.ok(fs.existsSync(path.join(target, 'SKILL.md')));

  fs.writeFileSync(path.join(target, 'allowlist.txt'), 'trusted-package\n');
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'changed locally\n');
  output = run(['update']);
  assert.match(output, /UPDATED/);
  assert.strictEqual(fs.readFileSync(path.join(target, 'allowlist.txt'), 'utf8'), 'trusted-package\n');
  assert.notStrictEqual(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8'), 'changed locally\n');

  output = run(['status']);
  assert.match(output, /version=0\.1\.0/);
  assert.match(output, /DISABLED/);

  output = run(['enable-hook']);
  assert.match(output, /INSTALLED/);
  const hooks = JSON.parse(fs.readFileSync(path.join(temp, 'hooks.json'), 'utf8'));
  assert.ok(hooks.hooks.PreToolUse[0].hooks[0].command.endsWith('/scripts/install-hook.sh'));

  output = run(['disable-hook']);
  assert.match(output, /REMOVED/);

  output = run(['uninstall']);
  assert.match(output, /UNINSTALLED/);
  assert.ok(!fs.existsSync(target));
  assert.ok(fs.readdirSync(path.join(temp, 'skills')).some(name => name.startsWith('npm-package-guard.uninstalled-')));

  console.log('PASS install, update, status, hook lifecycle, and recoverable uninstall');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
