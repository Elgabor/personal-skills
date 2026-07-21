#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline/promises');
const { spawnSync } = require('child_process');

const packageJson = require('../package.json');
const payload = path.resolve(__dirname, '..', 'skill');
const markerName = '.npm-package-guard-version';

function codexHome(env = process.env) {
  return env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function targetPath(env = process.env) {
  return path.join(codexHome(env), 'skills', 'npm-package-guard');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readInstalledVersion(target) {
  const marker = path.join(target, markerName);
  if (!fs.existsSync(marker)) return fs.existsSync(target) ? 'unknown' : null;
  return fs.readFileSync(marker, 'utf8').trim() || 'unknown';
}

function copyPayload(destination, existing) {
  fs.cpSync(payload, destination, { recursive: true, errorOnExist: true });
  if (existing) {
    const previousAllowlist = path.join(existing, 'allowlist.txt');
    if (fs.existsSync(previousAllowlist)) {
      fs.copyFileSync(previousAllowlist, path.join(destination, 'allowlist.txt'));
    }
  }
  fs.writeFileSync(path.join(destination, markerName), `${packageJson.version}\n`, { mode: 0o644 });
  for (const file of ['npm-package-guard.js', 'manage-hook.js', 'test.js', 'install-hook.sh']) {
    const script = path.join(destination, 'scripts', file);
    if (fs.existsSync(script)) fs.chmodSync(script, 0o755);
  }
}

function deploy({ mode, env = process.env }) {
  const target = targetPath(env);
  const existingVersion = readInstalledVersion(target);
  if (mode === 'install' && existingVersion !== null) {
    console.log(`ALREADY_INSTALLED ${target} version=${existingVersion}`);
    console.log('Run npm-package-guard update to replace managed files.');
    return { changed: false, target, existingVersion };
  }
  if (mode === 'update' && existingVersion === null) mode = 'install';

  const skillsDir = path.dirname(target);
  fs.mkdirSync(skillsDir, { recursive: true });
  const temp = path.join(skillsDir, `.npm-package-guard.tmp-${process.pid}-${Date.now()}`);
  let backup = null;
  try {
    copyPayload(temp, existingVersion === null ? null : target);
    if (existingVersion !== null) {
      backup = `${target}.backup-${timestamp()}`;
      fs.renameSync(target, backup);
    }
    fs.renameSync(temp, target);
  } catch (error) {
    if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
    if (backup && !fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  }

  console.log(`${mode === 'install' ? 'INSTALLED' : 'UPDATED'} ${target} version=${packageJson.version}${backup ? ` backup=${backup}` : ''}`);
  return { changed: true, target, existingVersion, backup, mode };
}

function runHookManager(action, env = process.env, target = targetPath(env)) {
  const manager = path.join(target, 'scripts', 'manage-hook.js');
  if (!fs.existsSync(manager)) throw new Error('npm-package-guard is not installed; run install first');
  const args = [manager, action];
  if (['install', 'remove'].includes(action)) args.push('--yes');
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`hook command failed with exit ${result.status}`);
}

async function wantsHook(args) {
  if (args.includes('--hook')) return true;
  if (args.includes('--no-hook')) return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Enable automatic protection before package installations? [y/N] ');
    return /^y(?:es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function printStatus(env = process.env) {
  const target = targetPath(env);
  const version = readInstalledVersion(target);
  console.log(version === null
    ? `NOT_INSTALLED ${target}`
    : `INSTALLED ${target} version=${version} available=${packageJson.version}`);
  if (version !== null) runHookManager('status', env, target);
}

function uninstall(env = process.env) {
  const target = targetPath(env);
  if (!fs.existsSync(target)) {
    console.log(`ALREADY_UNINSTALLED ${target}`);
    return;
  }
  runHookManager('remove', env, target);
  const recovery = `${target}.uninstalled-${timestamp()}`;
  fs.renameSync(target, recovery);
  console.log(`UNINSTALLED ${target} recovery=${recovery}`);
}

function usage() {
  console.log(`NPM Package Guard ${packageJson.version}

Usage:
  npm-package-guard [install] [--hook|--no-hook]
  npm-package-guard update
  npm-package-guard status
  npm-package-guard enable-hook
  npm-package-guard disable-hook
  npm-package-guard uninstall
  npm-package-guard help`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.includes('--help') || args.includes('-h')
    ? 'help'
    : args.find(arg => !arg.startsWith('-')) || 'install';
  try {
    if (['help', '--help', '-h'].includes(command)) { usage(); return; }
    if (command === 'status') { printStatus(); return; }
    if (command === 'enable-hook') { runHookManager('install'); return; }
    if (command === 'disable-hook') { runHookManager('remove'); return; }
    if (command === 'uninstall') { uninstall(); return; }
    if (!['install', 'update'].includes(command)) throw new Error(`unknown command: ${command}`);

    const result = deploy({ mode: command });
    if (command === 'install' && result.changed) {
      if (await wantsHook(args)) {
        runHookManager('install');
        console.log('Run /hooks in Codex and re-trust the new entry before relying on enforcement.');
      } else {
        console.log('Automatic hook not enabled. Run npm-package-guard enable-hook whenever you want it.');
      }
    }
    console.log('Open a repository in Codex and invoke $npm-package-guard to audit it.');
  } catch (error) {
    console.error(`npm-package-guard setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { codexHome, deploy, readInstalledVersion, targetPath, uninstall };

if (require.main === module) main();
