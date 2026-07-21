#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK_COMMAND = fs.realpathSync(path.join(__dirname, 'install-hook.sh'));

function configPath(env = process.env) {
  return path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'hooks.json');
}

function readConfig(file) {
  if (!fs.existsSync(file)) return {};
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('hooks.json must contain a JSON object');
  return parsed;
}

function hookObject() {
  return { type: 'command', command: HOOK_COMMAND };
}

function isOurHook(hook) {
  return hook && hook.type === 'command' && hook.command === HOOK_COMMAND;
}

function isEnabled(config) {
  return Boolean(config.hooks && Array.isArray(config.hooks.PreToolUse)
    && config.hooks.PreToolUse.some(entry => entry && entry.matcher === 'Bash' && Array.isArray(entry.hooks) && entry.hooks.some(isOurHook)));
}

function addHook(config) {
  const next = JSON.parse(JSON.stringify(config));
  if (!next.hooks) next.hooks = {};
  if (Array.isArray(next.hooks)) throw new Error('hooks must be a JSON object');
  if (!next.hooks.PreToolUse) next.hooks.PreToolUse = [];
  if (!Array.isArray(next.hooks.PreToolUse)) throw new Error('hooks.PreToolUse must be an array');
  if (isEnabled(next)) return next;
  let bashEntry = next.hooks.PreToolUse.find(entry => entry && entry.matcher === 'Bash' && Array.isArray(entry.hooks));
  if (!bashEntry) {
    bashEntry = { matcher: 'Bash', hooks: [] };
    next.hooks.PreToolUse.push(bashEntry);
  }
  bashEntry.hooks.push(hookObject());
  return next;
}

function removeHook(config) {
  const next = JSON.parse(JSON.stringify(config));
  if (!next.hooks || !Array.isArray(next.hooks.PreToolUse)) return next;
  next.hooks.PreToolUse = next.hooks.PreToolUse.map(entry => {
    if (!entry || entry.matcher !== 'Bash' || !Array.isArray(entry.hooks)) return entry;
    return { ...entry, hooks: entry.hooks.filter(hook => !isOurHook(hook)) };
  }).filter(entry => !(entry && entry.matcher === 'Bash' && Array.isArray(entry.hooks) && entry.hooks.length === 0 && Object.keys(entry).every(key => ['matcher', 'hooks'].includes(key))));
  return next;
}

function writeConfig(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let backup = null;
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backup = `${file}.backup-${stamp}`;
    fs.copyFileSync(file, backup);
  }
  const temp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  return backup;
}

function snippet() {
  return { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [hookObject()] }] } };
}

function assertHookRuntime() {
  if (process.platform === 'win32') throw new Error('the automatic Bash hook currently supports macOS and Linux; manual repository audit still works');
  if (!fs.existsSync('/bin/bash')) throw new Error('/bin/bash is required for the automatic hook');
  const jq = spawnSync('jq', ['--version'], { stdio: 'ignore' });
  if (jq.status !== 0) throw new Error('jq is required for the automatic hook; install it separately or use manual audit mode');
}

function usage() {
  console.log('Usage: manage-hook.js status | snippet | install --yes | remove --yes');
}

function main() {
  const action = process.argv[2] || 'status';
  const file = configPath();
  try {
    if (action === 'snippet') {
      console.log(JSON.stringify(snippet(), null, 2));
      return;
    }
    const current = readConfig(file);
    if (action === 'status') {
      console.log(`${isEnabled(current) ? 'ENABLED' : 'DISABLED'} ${file}`);
      return;
    }
    if (!['install', 'remove'].includes(action)) { usage(); process.exitCode = 1; return; }
    if (!process.argv.includes('--yes')) {
      console.error(`${action} requires --yes after explicit user approval; no changes made.`);
      process.exitCode = 1;
      return;
    }
    if (action === 'install') assertHookRuntime();
    const changed = action === 'install' ? addHook(current) : removeHook(current);
    if (JSON.stringify(changed) === JSON.stringify(current)) {
      console.log(`${action === 'install' ? 'ALREADY_ENABLED' : 'ALREADY_DISABLED'} ${file}`);
      return;
    }
    const backup = writeConfig(file, changed);
    console.log(`${action === 'install' ? 'INSTALLED' : 'REMOVED'} ${file}${backup ? ` backup=${backup}` : ''}`);
    console.log('Run /hooks in Codex and re-trust the changed hook entry.');
  } catch (error) {
    console.error(`npm-package-guard hook setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { addHook, configPath, isEnabled, removeHook, snippet };

if (require.main === module) main();
