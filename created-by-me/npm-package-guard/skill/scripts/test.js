#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const guard = require('./npm-package-guard.js');
const hookManager = require('./manage-hook.js');

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function metadata(overrides = {}) {
  const now = Date.now();
  const base = {
    'dist-tags': { latest: '1.0.0' },
    time: { '0.9.0': new Date(now - 30 * 24 * 3600_000).toISOString(), '1.0.0': new Date(now - 10 * 24 * 3600_000).toISOString() },
    versions: {
      '0.9.0': { _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] },
      '1.0.0': { _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] }
    }
  };
  return { ...base, ...overrides, versions: { ...base.versions, ...(overrides.versions || {}) }, time: { ...base.time, ...(overrides.time || {}) } };
}

function context(meta, osv = { vulns: [] }) {
  return {
    allowlist: [],
    now: () => Date.now(),
    metadata: async () => meta,
    resolve: async (_name, spec, data) => /^\d+\.\d+\.\d+$/.test(spec) ? spec : data['dist-tags'].latest,
    downloads: async name => ({ downloads: name === 'lodash' ? 10_000_000 : 1_000 }),
    osv: async () => osv
  };
}

test('parses npm, pnpm, yarn, bun, and explicit npx installs', () => {
  const cases = [
    ['npm install lodash@4.17.21', 'lodash@4.17.21'],
    ['pnpm add zod', 'zod'],
    ['yarn add react@19.1.0', 'react@19.1.0'],
    ['bun add axios', 'axios'],
    ['npx --yes cowsay@1.6.0 hello', 'cowsay@1.6.0'],
    ['npx --package=typescript tsc', 'typescript']
  ];
  for (const [command, expected] of cases) assert(guard.parseInstallCommand(command)[0].packages.includes(expected), command);
});

test('parses package-manager options before the install verb', () => {
  const cases = [
    ['npm --prefix /tmp install lodash', 'lodash'],
    ['pnpm --dir /tmp add zod', 'zod'],
    ['yarn --cwd /tmp add react', 'react'],
    ['bun --silent install axios', 'axios']
  ];
  for (const [command, expected] of cases) assert(guard.parseInstallCommand(command)[0].packages.includes(expected), command);
});

test('resolves npm aliases to the real registry package', async () => {
  const parsed = guard.parsePackageSpec('utility@npm:lodash@1.0.0');
  assert.strictEqual(parsed.alias, 'utility');
  assert.strictEqual(parsed.name, 'lodash');
  assert.strictEqual(parsed.spec, '1.0.0');
  let queried = null;
  const ctx = context(metadata());
  ctx.metadata = async name => { queried = name; return metadata(); };
  await guard.checkPackage('utility@npm:lodash@1.0.0', ctx);
  assert.strictEqual(queried, 'lodash');
});

test('shell hook forwards every supported install family to the checker', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-stub-'));
  const marker = path.join(dir, 'called');
  const stub = path.join(dir, 'node');
  fs.writeFileSync(stub, '#!/bin/sh\nprintf x >> "$NPG_TEST_MARKER"\nexit 0\n');
  fs.chmodSync(stub, 0o755);
  const hook = path.join(__dirname, 'install-hook.sh');
  for (const command of ['npm add zod', 'pnpm install', 'yarn add zod', 'bun i', 'npx --yes cowsay', 'npm --prefix /tmp install zod']) {
    const result = spawnSync(hook, {
      input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, NPG_TEST_MARKER: marker }
    });
    assert.strictEqual(result.status, 0, command);
  }
  assert.strictEqual(fs.readFileSync(marker, 'utf8').length, 6);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('recognizes bare install variants', () => {
  for (const command of ['npm i', 'pnpm install --frozen-lockfile', 'yarn install', 'bun i']) {
    assert.strictEqual(guard.parseInstallCommand(command)[0].bare, true, command);
  }
});

test('non-install hook fast path makes no network call', () => {
  const hook = path.join(__dirname, 'install-hook.sh');
  const payload = JSON.stringify({ tool_input: { command: 'git status' } });
  const samples = [];
  for (let i = 0; i < 5; i += 1) {
    const start = process.hrtime.bigint();
    const result = spawnSync(hook, { input: payload, encoding: 'utf8' });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stderr, '');
  }
  samples.sort((a, b) => a - b);
  assert(samples[2] < 50, `median fast path took ${samples[2].toFixed(1)}ms`);
});

test('install-looking text passed to another command stays on the fast path', () => {
  const hook = path.join(__dirname, 'install-hook.sh');
  const payload = JSON.stringify({ tool_input: { command: "printf '%s' 'npm install lodash'" } });
  const start = process.hrtime.bigint();
  const result = spawnSync(hook, { input: payload, encoding: 'utf8' });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, '');
  assert(elapsedMs < 50, `quoted-text fast path took ${elapsedMs.toFixed(1)}ms`);
});

test('adjacent character swaps count as one edit for typosquat checks', () => {
  assert.strictEqual(guard.editDistance('lodahs', 'lodash'), 1);
});

test('low-download near-match of a popular package is a typosquat BLOCK', async () => {
  const result = await guard.checkPackage('lodahs@1.0.0', context(metadata()));
  assert(result.findings.some(f => f.check === 'name' && f.severity === 'BLOCK'));
});

test('repo audit uses the package-lock exact version', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-lock-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^4.17.0' } }));
  fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: { lodash: '^4.17.0' } }, 'node_modules/lodash': { version: '4.17.21' } } }));
  const surface = guard.directDependencies(dir);
  assert.strictEqual(surface.dependencies[0].spec, '4.17.21');
  assert.strictEqual(surface.dependencies[0].locked, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('repo audit reads pnpm and Yarn locked versions', () => {
  const pnpmDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-pnpm-'));
  fs.writeFileSync(path.join(pnpmDir, 'package.json'), JSON.stringify({ dependencies: { zod: '^3.0.0' } }));
  fs.writeFileSync(path.join(pnpmDir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      zod:\n        specifier: ^3.0.0\n        version: 3.25.76\n");
  assert.strictEqual(guard.directDependencies(pnpmDir).dependencies[0].spec, '3.25.76');
  fs.rmSync(pnpmDir, { recursive: true, force: true });

  const yarnDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-yarn-'));
  fs.writeFileSync(path.join(yarnDir, 'package.json'), JSON.stringify({ dependencies: { zod: '^3.0.0' } }));
  fs.writeFileSync(path.join(yarnDir, 'yarn.lock'), '"zod@^3.0.0":\n  version "3.25.76"\n');
  assert.strictEqual(guard.directDependencies(yarnDir).dependencies[0].spec, '3.25.76');
  fs.rmSync(yarnDir, { recursive: true, force: true });
});

test('install scripts produce WARN', async () => {
  const meta = metadata({ versions: { '1.0.0': { scripts: { postinstall: 'node setup.js' }, _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] } } });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert(result.findings.some(f => f.check === 'install-scripts' && f.severity === 'WARN'));
});

test('deprecated versions and newly introduced binaries produce WARN', async () => {
  const meta = metadata({ versions: { '1.0.0': { deprecated: 'Use maintained-package instead', bin: { risky: 'cli.js' }, _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] } } });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert(result.findings.some(f => f.check === 'deprecated' && f.severity === 'WARN'));
  assert(result.findings.some(f => f.check === 'new-bin' && f.severity === 'WARN'));
});

test('registry trust downgrade produces WARN without extra network calls', async () => {
  const meta = metadata({
    versions: {
      '0.9.0': { dist: { attestations: { provenance: { url: 'https://registry.example/attestation' } } }, _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] },
      '1.0.0': { _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] }
    }
  });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert(result.findings.some(f => f.check === 'trust-regression' && f.severity === 'WARN'));
});

test('fresh release produces WARN', async () => {
  const meta = metadata({ time: { '1.0.0': new Date(Date.now() - 2 * 3600_000).toISOString() } });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert(result.findings.some(f => f.check === 'release-age' && f.severity === 'WARN'));
});

test('mocked OSV hit produces BLOCK', async () => {
  const result = await guard.checkPackage('safe-package@1.0.0', context(metadata(), { vulns: [{ id: 'GHSA-test-1234' }] }));
  assert(result.findings.some(f => f.check === 'osv' && f.severity === 'BLOCK'));
  assert.strictEqual(guard.verdict(result, 'hook'), 'BLOCK');
});

test('allowlist bypasses network checks after registry version resolution', async () => {
  const ctx = context(metadata());
  ctx.allowlist = ['safe-package@1.0.0'];
  ctx.osv = async () => { throw new Error('OSV should not run'); };
  ctx.downloads = async () => { throw new Error('downloads should not run'); };
  const result = await guard.checkPackage('safe-package@1.0.0', ctx);
  assert.strictEqual(result.allowlisted, true);
  assert.strictEqual(guard.verdict(result, 'hook'), 'PASS');
});

test('first-time publisher on established package produces WARN', async () => {
  const oldTime = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const versions = {};
  const times = {};
  for (const version of ['0.6.0', '0.7.0', '0.8.0', '0.9.0']) {
    versions[version] = { _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] };
    times[version] = oldTime;
  }
  versions['1.0.0'] = { _npmUser: { name: 'bob' }, maintainers: [{ name: 'alice' }, { name: 'bob' }] };
  const meta = metadata({ versions, time: times });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert(result.findings.some(f => f.check === 'publisher' && f.severity === 'WARN'));
});

test('two warnings escalate only in hook mode', async () => {
  const meta = metadata({
    time: { '1.0.0': new Date(Date.now() - 3600_000).toISOString() },
    versions: { '1.0.0': { scripts: { install: 'node install.js' }, _npmUser: { name: 'alice' }, maintainers: [{ name: 'alice' }] } }
  });
  const result = await guard.checkPackage('safe-package@1.0.0', context(meta));
  assert.strictEqual(guard.verdict(result, 'audit'), 'WARN');
  assert.strictEqual(guard.verdict(result, 'hook'), 'BLOCK');
});

test('repository audits check packages with bounded concurrency', async () => {
  let active = 0;
  let maximum = 0;
  const ctx = context(metadata());
  ctx.metadata = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active -= 1;
    return metadata();
  };
  const packages = Array.from({ length: 8 }, (_, i) => `audit-package-${i}@1.0.0`);
  await guard.checkMany(packages, 'audit', ctx, 3);
  assert(maximum > 1 && maximum <= 3, `maximum concurrency was ${maximum}`);
});

test('registry failure is fail-open in hook mode', async () => {
  const ctx = context(metadata());
  ctx.metadata = async () => { throw new guard.OperationalError('offline'); };
  assert.strictEqual(await guard.hookCommand('npm add safe-package', ctx), 0);
});

test('repo with no package manifest prints exact stop sentence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-empty-'));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'npm-package-guard.js'), 'audit', dir], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, 'This repository has no npm packages at all.\n');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('lockfile-only repo reports missing manifest instead of claiming no npm surface', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-lock-only-'));
  fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'npm-package-guard.js'), 'audit', dir], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0);
  assert(result.stdout.includes('WARN'));
  assert(result.stdout.includes('without a package.json'));
  assert(!result.stdout.includes('This repository has no npm packages at all.'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hook manager requires consent and preserves existing configuration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-package-guard-codex-home-'));
  const manager = path.join(__dirname, 'manage-hook.js');
  const denied = spawnSync(process.execPath, [manager, 'install'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: dir } });
  assert.strictEqual(denied.status, 1);
  assert.strictEqual(fs.existsSync(path.join(dir, 'hooks.json')), false);

  const original = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/existing/guard.sh' }] }] }, custom: { keep: true } };
  fs.writeFileSync(path.join(dir, 'hooks.json'), `${JSON.stringify(original)}\n`);
  const installed = spawnSync(process.execPath, [manager, 'install', '--yes'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: dir } });
  assert.strictEqual(installed.status, 0, installed.stderr);
  const merged = JSON.parse(fs.readFileSync(path.join(dir, 'hooks.json'), 'utf8'));
  assert.strictEqual(merged.custom.keep, true);
  assert.strictEqual(merged.hooks.PreToolUse[0].hooks.some(hook => hook.command === '/existing/guard.sh'), true);
  assert.strictEqual(hookManager.isEnabled(merged), true);
  assert(fs.readdirSync(dir).some(name => name.startsWith('hooks.json.backup-')));

  const removed = spawnSync(process.execPath, [manager, 'remove', '--yes'], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: dir } });
  assert.strictEqual(removed.status, 0, removed.stderr);
  const afterRemove = JSON.parse(fs.readFileSync(path.join(dir, 'hooks.json'), 'utf8'));
  assert.strictEqual(afterRemove.hooks.PreToolUse[0].hooks.some(hook => hook.command === '/existing/guard.sh'), true);
  assert.strictEqual(hookManager.isEnabled(afterRemove), false);

  const cleaned = hookManager.removeHook(hookManager.addHook({}));
  assert.deepStrictEqual(cleaned, {});
  fs.rmSync(dir, { recursive: true, force: true });
});

(async () => {
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`PASS ${item.name}`);
    } catch (error) {
      console.error(`FAIL ${item.name}: ${error.stack || error.message}`);
    }
  }
  console.log(`\n${passed}/${tests.length} tests passed`);
  if (passed !== tests.length) process.exitCode = 1;
  console.log('\nSafe end-to-end probe after merging the hook:');
  console.log("probe_dir=$(mktemp -d) && cd \"$probe_dir\"");
  console.log(`printf '{"tool_input":{"command":"git status"}}' | "${path.join(__dirname, 'install-hook.sh')}"`);
  console.log('# expect exit 0, no output, and no network access');
  console.log(`printf '{"tool_input":{"command":"npm install lodash@4.17.20"}}' | "${path.join(__dirname, 'install-hook.sh')}"; echo "exit=$?"`);
  console.log('# registry-backed probe; expect exit 2 if OSV still reports an advisory, otherwise inspect the checker output');
})();
