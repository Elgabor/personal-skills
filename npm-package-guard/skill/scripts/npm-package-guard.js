#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const HOOK_DEADLINE_MS = 13_500;
const REQUEST_TIMEOUT_MS = 4_000;
const AUDIT_CONCURRENCY = 6;
const HOOK_CONCURRENCY = 4;
const FRESH_MS = 72 * 60 * 60 * 1000;
const POPULAR = [
  'react', 'react-dom', 'vue', 'express', 'lodash', 'axios', 'next', 'vite',
  'typescript', 'webpack', 'eslint', 'prettier', 'chalk', 'commander', 'debug',
  'dotenv', 'zod', 'jquery', 'moment', 'uuid', 'request', 'async', 'rxjs',
  'angular', 'svelte', 'tailwindcss', 'mongoose', 'socket.io', 'puppeteer',
  'playwright', 'jest', 'mocha', 'npm', 'pnpm', 'yarn',
  '@types/node', '@babel/core', '@nestjs/core', '@angular/core', '@vitejs/plugin-react'
];

class OperationalError extends Error {}

function splitShellSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (escaped) { current += ch; escaped = false; continue; }
    if (ch === '\\' && quote !== "'") { current += ch; escaped = true; continue; }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') {
      if (current.trim()) segments.push(current.trim());
      current = '';
      while (i + 1 < command.length && (command[i + 1] === '|' || command[i + 1] === '&')) i += 1;
      continue;
    }
    current += ch;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;
  for (const ch of segment) {
    if (escaped) { current += ch; escaped = false; continue; }
    if (ch === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (/\s/.test(ch)) {
      if (current) { tokens.push(current); current = ''; }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

function stripCommandPrefix(tokens) {
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(tokens[i])) i += 1;
  while (['sudo', 'command'].includes(tokens[i])) i += 1;
  if (tokens[i] === 'env') {
    i += 1;
    while (i < tokens.length && (tokens[i].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(tokens[i]))) i += 1;
  }
  return tokens.slice(i);
}

const VALUE_FLAGS = new Set([
  '--registry', '--prefix', '--workspace', '-w', '--cache', '--tag', '--save-prefix',
  '--userconfig', '--config', '--cwd', '--dir', '--filter', '--store-dir', '--package'
]);

function packageArgs(args) {
  const out = [];
  let afterDoubleDash = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') { afterDoubleDash = true; continue; }
    if (!afterDoubleDash && VALUE_FLAGS.has(arg)) { i += 1; continue; }
    if (!afterDoubleDash && [...VALUE_FLAGS].some(flag => arg.startsWith(`${flag}=`))) continue;
    if (!afterDoubleDash && arg.startsWith('-')) continue;
    out.push(arg);
  }
  return out;
}

function verbIndex(tokens, verbs) {
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (verbs.includes(token)) return i;
    if (VALUE_FLAGS.has(token)) { i += 1; continue; }
    if ([...VALUE_FLAGS].some(flag => token.startsWith(`${flag}=`))) continue;
    if (token.startsWith('-')) continue;
    return -1;
  }
  return -1;
}

function parseInstallCommand(command) {
  const installs = [];
  for (const segment of splitShellSegments(command)) {
    const tokens = stripCommandPrefix(tokenize(segment));
    if (!tokens.length) continue;
    const tool = path.basename(tokens[0]);
    const verbs = tool === 'yarn' ? ['install', 'add'] : ['install', 'i', 'add'];
    const index = ['npm', 'pnpm', 'yarn', 'bun'].includes(tool) ? verbIndex(tokens, verbs) : -1;
    if (index !== -1) {
      const packages = packageArgs(tokens.slice(index + 1));
      installs.push({ tool, packages, bare: packages.length === 0 });
    } else if (tool === 'npx') {
      const args = tokens.slice(1);
      const explicit = [];
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '-p' || args[i] === '--package') { if (args[i + 1]) explicit.push(args[++i]); continue; }
        if (args[i].startsWith('--package=')) { explicit.push(args[i].slice(10)); continue; }
        if (args[i].startsWith('-')) continue;
        if (!explicit.length) explicit.push(args[i]);
        break;
      }
      if (explicit.length) installs.push({ tool, packages: explicit, bare: false });
    }
  }
  return installs;
}

function parsePackageSpec(raw) {
  if (!raw) return { raw, nonRegistry: true };
  const aliasAt = raw.indexOf('@npm:');
  if (aliasAt > 0) {
    const target = parsePackageSpec(raw.slice(aliasAt + 5));
    return { ...target, raw, alias: raw.slice(0, aliasAt) };
  }
  if (raw === '.' || raw.startsWith('./') || raw.startsWith('../') || path.isAbsolute(raw) || /^(file|link|workspace):/.test(raw)) {
    return { raw, local: true };
  }
  if (raw.includes('://') || /^(git\+|github:|gitlab:|bitbucket:)/.test(raw) || /^[^/@\s]+\/[^/\s]+(?:#.*)?$/.test(raw)) {
    return { raw, nonRegistry: true };
  }
  if (raw.startsWith('@')) {
    const slash = raw.indexOf('/');
    if (slash < 2) return { raw, nonRegistry: true };
    const versionAt = raw.indexOf('@', slash);
    return versionAt === -1
      ? { raw, name: raw, spec: 'latest' }
      : { raw, name: raw.slice(0, versionAt), spec: raw.slice(versionAt + 1) || 'latest' };
  }
  const versionAt = raw.lastIndexOf('@');
  return versionAt > 0
    ? { raw, name: raw.slice(0, versionAt), spec: raw.slice(versionAt + 1) || 'latest' }
    : { raw, name: raw, spec: 'latest' };
}

function loadAllowlist() {
  const file = path.join(SKILL_DIR, 'allowlist.txt');
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  } catch (error) {
    throw new OperationalError(`cannot read allowlist: ${error.message}`);
  }
}

function isAllowlisted(name, version, entries) {
  return entries.includes(name) || entries.includes(`${name}@${version}`);
}

function editDistance(a, b) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  let beforePrev = null;
  let prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= right.length; j += 1) {
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      if (beforePrev && i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        row[j] = Math.min(row[j], beforePrev[j - 2] + 1);
      }
    }
    beforePrev = prev;
    prev = row;
  }
  return prev[right.length];
}

function requestJson(url, options = {}, body, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { ...options, timeout: timeoutMs, headers: { 'user-agent': 'npm-package-guard/1', 'content-type': 'application/json', ...(options.headers || {}) } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new OperationalError(`HTTP ${res.statusCode} from ${new URL(url).host}`));
        try { resolve(JSON.parse(data)); } catch (error) { reject(new OperationalError(`invalid JSON from ${new URL(url).host}`)); }
      });
    });
    req.on('timeout', () => req.destroy(new OperationalError('network timeout')));
    req.on('error', error => reject(error instanceof OperationalError ? error : new OperationalError(error.message)));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function npmViewVersion(name, spec, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['view', `${name}@${spec}`, 'version', '--json'], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(new OperationalError(`npm view failed: ${error.message}`)); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new OperationalError(`npm view failed${stderr.trim() ? `: ${stderr.trim().split('\n')[0]}` : ''}`));
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed);
      } catch (error) { reject(new OperationalError('npm view returned invalid JSON')); }
    });
  });
}

function defaultContext(options = {}) {
  const startedAt = Date.now();
  const deadlineMs = options.deadlineMs === undefined ? null : options.deadlineMs;
  const remaining = () => {
    if (deadlineMs === null) return REQUEST_TIMEOUT_MS;
    const left = deadlineMs - (Date.now() - startedAt);
    if (left <= 0) throw new OperationalError('global checker timeout');
    return Math.min(REQUEST_TIMEOUT_MS, left);
  };
  return {
    now: () => Date.now(),
    async metadata(name) { return requestJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {}, null, remaining()); },
    async downloads(name) { return requestJson(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`, {}, null, remaining()); },
    async osv(name, version) {
      return requestJson('https://api.osv.dev/v1/query', { method: 'POST' }, { package: { ecosystem: 'npm', name }, version }, remaining());
    },
    async resolve(name, spec, metadata) {
      if (/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec)) return spec.replace(/^v/, '');
      if (metadata['dist-tags'] && metadata['dist-tags'][spec]) return metadata['dist-tags'][spec];
      return npmViewVersion(name, spec, remaining());
    }
  };
}

function names(list) {
  return (list || []).map(item => typeof item === 'string' ? item : item && item.name).filter(Boolean).sort();
}

function previousVersion(metadata, version) {
  const currentTime = Date.parse((metadata.time || {})[version] || '');
  return Object.keys(metadata.versions || {})
    .filter(v => v !== version && Date.parse((metadata.time || {})[v] || '') < currentTime)
    .sort((a, b) => Date.parse(metadata.time[a]) - Date.parse(metadata.time[b]))
    .pop();
}

function binNames(data, packageName) {
  if (!data || !data.bin) return [];
  if (typeof data.bin === 'string') return [String(packageName || '').split('/').pop()].filter(Boolean);
  return Object.keys(data.bin).sort();
}

function trustLevel(data) {
  if (data && data._npmUser && typeof data._npmUser === 'object' && data._npmUser.trustedPublisher) return 2;
  if (data && data.dist && data.dist.attestations && data.dist.attestations.provenance) return 1;
  return 0;
}

function historicalTrustLevel(metadata, version) {
  const currentTime = Date.parse((metadata.time || {})[version] || '');
  return Object.entries(metadata.versions || {}).reduce((highest, [candidate, data]) => {
    const published = Date.parse((metadata.time || {})[candidate] || '');
    if (!Number.isFinite(currentTime) || !Number.isFinite(published) || published >= currentTime) return highest;
    return Math.max(highest, trustLevel(data));
  }, 0);
}

async function typosquatFinding(name, ctx) {
  const close = POPULAR.map(popular => ({ popular, distance: editDistance(name, popular) }))
    .filter(item => item.distance > 0 && item.distance <= (Math.max(name.length, item.popular.length) <= 6 ? 1 : 2))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!close) return null;
  const [candidate, popular] = await Promise.all([ctx.downloads(name), ctx.downloads(close.popular)]);
  const candidateCount = Number(candidate.downloads || 0);
  const popularCount = Number(popular.downloads || 0);
  if (popularCount < 100_000 || popularCount < Math.max(20 * candidateCount, 100_000)) return null;
  const severity = close.distance === 1 ? 'BLOCK' : 'WARN';
  return { severity, check: 'name', reason: `possible typosquat of ${close.popular} (edit distance ${close.distance}; weekly downloads ${candidateCount} vs ${popularCount})` };
}

async function checkPackage(input, ctx = defaultContext()) {
  const parsed = typeof input === 'string' ? parsePackageSpec(input) : input;
  if (parsed.local) return { package: parsed.raw, version: 'local', findings: [], operationalErrors: [], local: true };
  if (parsed.nonRegistry) return { package: parsed.raw, version: 'unknown', findings: [{ severity: 'WARN', check: 'source', reason: 'non-registry package spec could not be checked' }], operationalErrors: [] };
  const operationalErrors = [];
  let metadata;
  try { metadata = await ctx.metadata(parsed.name); }
  catch (error) { return { package: parsed.name, version: parsed.spec, findings: [], operationalErrors: [`registry metadata unavailable: ${error.message}`] }; }
  let version;
  try { version = await ctx.resolve(parsed.name, parsed.spec || 'latest', metadata); }
  catch (error) { return { package: parsed.name, version: parsed.spec, findings: [], operationalErrors: [`version resolution failed: ${error.message}`] }; }
  const allowlist = ctx.allowlist || loadAllowlist();
  if (isAllowlisted(parsed.name, version, allowlist)) return { package: parsed.name, version, findings: [], operationalErrors, allowlisted: true };
  const data = (metadata.versions || {})[version];
  if (!data) return { package: parsed.name, version, findings: [], operationalErrors: [`resolved version ${version} missing from registry metadata`] };
  const findings = [];
  try { const finding = await typosquatFinding(parsed.name, ctx); if (finding) findings.push(finding); }
  catch (error) { operationalErrors.push(`name sanity unavailable: ${error.message}`); }
  const lifecycle = ['preinstall', 'install', 'postinstall'].filter(name => data.scripts && data.scripts[name]);
  if (lifecycle.length) findings.push({ severity: 'WARN', check: 'install-scripts', reason: `declares ${lifecycle.join(', ')}` });
  if (data.deprecated) findings.push({ severity: 'WARN', check: 'deprecated', reason: String(data.deprecated).replace(/\s+/g, ' ').trim() || 'registry marks this version deprecated' });
  const publishedAt = Date.parse((metadata.time || {})[version] || '');
  if (Number.isFinite(publishedAt) && ctx.now() - publishedAt < FRESH_MS) {
    const hours = Math.max(0, Math.floor((ctx.now() - publishedAt) / 3_600_000));
    findings.push({ severity: 'WARN', check: 'release-age', reason: `version published ${hours}h ago (under 72h)` });
  }
  const prev = previousVersion(metadata, version);
  if (prev) {
    const previousData = metadata.versions[prev] || {};
    const introducedBins = binNames(data, parsed.name).filter(name => !binNames(previousData, parsed.name).includes(name));
    if (introducedBins.length) findings.push({ severity: 'WARN', check: 'new-bin', reason: `introduces command-line binary: ${introducedBins.join(', ')}` });
    const currentMaintainers = names(data.maintainers);
    const previousMaintainers = names(previousData.maintainers);
    if (currentMaintainers.length && previousMaintainers.length && currentMaintainers.join('\0') !== previousMaintainers.join('\0')) {
      findings.push({ severity: 'WARN', check: 'maintainers', reason: `maintainer list differs from previous release ${prev}` });
    }
    const publisher = data._npmUser && (typeof data._npmUser === 'string' ? data._npmUser : data._npmUser.name);
    const priorPublishers = new Set(Object.keys(metadata.versions || {}).filter(v => v !== version).map(v => {
      const user = metadata.versions[v] && metadata.versions[v]._npmUser;
      return typeof user === 'string' ? user : user && user.name;
    }).filter(Boolean));
    if (publisher && Object.keys(metadata.versions || {}).length >= 5 && priorPublishers.size && !priorPublishers.has(publisher)) {
      findings.push({ severity: 'WARN', check: 'publisher', reason: `first release by publisher ${publisher} on an established package` });
    }
  }
  const previousTrust = historicalTrustLevel(metadata, version);
  const currentTrust = trustLevel(data);
  if (previousTrust > currentTrust) {
    const labels = ['none', 'provenance', 'trusted publisher'];
    findings.push({ severity: 'WARN', check: 'trust-regression', reason: `registry trust metadata dropped from ${labels[previousTrust]} to ${labels[currentTrust]}` });
  }
  try {
    const osv = await ctx.osv(parsed.name, version);
    if (Array.isArray(osv.vulns) && osv.vulns.length) {
      const ids = osv.vulns.slice(0, 3).map(v => v.id).filter(Boolean).join(', ');
      findings.push({ severity: 'BLOCK', check: 'osv', reason: `known advisory${ids ? `: ${ids}` : ''}` });
    }
  } catch (error) { operationalErrors.push(`OSV unavailable: ${error.message}`); }
  return { package: parsed.name, version, findings, operationalErrors };
}

function walkPackageJson(root) {
  const found = [];
  const skip = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);
  const visit = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === 'package.json') found.push(full);
      else if (entry.isDirectory() && !skip.has(entry.name)) visit(full);
    }
  };
  visit(root);
  return found;
}

function detectLocks(root) {
  const names = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
  const found = [];
  const skip = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);
  const visit = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && names.includes(entry.name)) found.push(full);
      else if (entry.isDirectory() && !skip.has(entry.name)) visit(full);
    }
  };
  visit(root);
  return found;
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

function packageLockVersion(file, name) {
  try {
    const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
    return (lock.packages && lock.packages[`node_modules/${name}`] && lock.packages[`node_modules/${name}`].version)
      || (lock.dependencies && lock.dependencies[name] && lock.dependencies[name].version)
      || null;
  } catch (_) { return null; }
}

function pnpmLockVersion(file, name, spec) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch (_) { return null; }
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)([^:#][^:]*):\s*(.*)$/);
    if (!match || unquote(match[2]) !== name) continue;
    const indent = match[1].length;
    if (match[3] && /^\d+\.\d+\.\d+/.test(unquote(match[3]))) return unquote(match[3]).split('(')[0];
    let foundSpec = null;
    let foundVersion = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const childIndent = (lines[j].match(/^\s*/) || [''])[0].length;
      if (lines[j].trim() && childIndent <= indent) break;
      const specMatch = lines[j].match(/^\s*specifier:\s*(.+?)\s*$/);
      const versionMatch = lines[j].match(/^\s*version:\s*(.+?)\s*$/);
      if (specMatch) foundSpec = unquote(specMatch[1]);
      if (versionMatch) foundVersion = unquote(versionMatch[1]).split('(')[0];
    }
    if (foundVersion && (!foundSpec || foundSpec === spec)) return foundVersion;
  }
  return null;
}

function yarnLockVersion(file, name, spec) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch (_) { return null; }
  const selectors = [`${name}@${spec}`, `${name}@npm:${spec}`];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s/.test(lines[i]) || !lines[i].trim().endsWith(':')) continue;
    const header = lines[i].trim().slice(0, -1).replace(/^"|"$/g, '');
    if (!selectors.some(selector => header.split(/,\s*/).some(part => part.replace(/^"|"$/g, '') === selector))) continue;
    for (let j = i + 1; j < lines.length && (/^\s/.test(lines[j]) || !lines[j].trim()); j += 1) {
      const match = lines[j].match(/^\s*version(?:\s+|:\s*)(.+?)\s*$/);
      if (match) return unquote(match[1]);
    }
  }
  return null;
}

function nearestLock(manifest, locks) {
  const manifestDir = path.dirname(manifest);
  return locks.filter(file => manifestDir === path.dirname(file) || manifestDir.startsWith(`${path.dirname(file)}${path.sep}`))
    .sort((a, b) => path.dirname(b).length - path.dirname(a).length);
}

function lockedVersion(manifest, locks, name, spec) {
  for (const file of nearestLock(manifest, locks)) {
    let version = null;
    if (path.basename(file) === 'package-lock.json') version = packageLockVersion(file, name);
    else if (path.basename(file) === 'pnpm-lock.yaml') version = pnpmLockVersion(file, name, spec);
    else if (path.basename(file) === 'yarn.lock') version = yarnLockVersion(file, name, spec);
    if (version) return version;
  }
  return null;
}

function directDependencies(root) {
  const manifests = walkPackageJson(root);
  const locks = detectLocks(root);
  const dependencies = new Map();
  for (const file of manifests) {
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { throw new OperationalError(`invalid ${file}: ${error.message}`); }
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, spec] of Object.entries(manifest[section] || {})) {
        const pinned = lockedVersion(file, locks, name, spec);
        const resolvedSpec = pinned || spec;
        let dependency;
        if (String(spec).startsWith('npm:')) {
          dependency = parsePackageSpec(`${name}@${spec}`);
          if (pinned && !dependency.nonRegistry) dependency.spec = pinned;
          dependency.requestedSpec = spec;
          dependency.locked = Boolean(pinned);
        } else if (/^(file|link|workspace):/.test(String(spec))) {
          dependency = { raw: `${name}@${spec}`, local: true, requestedSpec: spec, locked: Boolean(pinned) };
        } else if (String(spec).includes('://') || /^(git\+|github:|gitlab:|bitbucket:)/.test(String(spec))) {
          dependency = { raw: `${name}@${spec}`, nonRegistry: true, requestedSpec: spec, locked: Boolean(pinned) };
        } else {
          dependency = { name, spec: resolvedSpec, raw: `${name}@${resolvedSpec}`, requestedSpec: spec, locked: Boolean(pinned) };
        }
        const key = dependency.name ? `${dependency.name}@${dependency.spec}` : dependency.raw;
        if (!dependencies.has(key)) dependencies.set(key, dependency);
      }
    }
  }
  return { manifests, locks, dependencies: [...dependencies.values()] };
}

function verdict(result, mode) {
  if (result.operationalErrors.length) return mode === 'hook' ? 'ERROR' : 'WARN';
  if (result.findings.some(f => f.severity === 'BLOCK')) return 'BLOCK';
  const warns = result.findings.filter(f => f.severity === 'WARN').length;
  if (mode === 'hook' && warns >= 2) return 'BLOCK';
  if (warns) return 'WARN';
  return 'PASS';
}

function reason(result, mode) {
  if (result.allowlisted) return 'allowlisted';
  if (result.local) return 'local or workspace dependency';
  const parts = result.findings.map(f => `${f.check}: ${f.reason}`);
  parts.push(...result.operationalErrors.map(e => `operational warning: ${e}`));
  if (mode === 'hook' && !result.operationalErrors.length && !result.findings.some(f => f.severity === 'BLOCK') && result.findings.filter(f => f.severity === 'WARN').length >= 2) {
    parts.push('two warning checks escalate in install-hook mode');
  }
  return parts.join('; ') || 'no checked risk signals';
}

function nextStep(result) {
  if (result.operationalErrors.length) return 'retry when the npm registry, downloads API, and OSV are reachable; do not treat this partial result as approval';
  if (result.findings.some(f => f.check === 'osv')) return 'remove the package or choose a version with no OSV advisory before installing';
  if (result.findings.some(f => f.check === 'name')) return 'verify the spelling and compare the package owner and tarball with the similarly named popular package';
  if (result.findings.some(f => ['install-scripts', 'release-age', 'maintainers', 'publisher', 'deprecated', 'new-bin', 'trust-regression'].includes(f.check))) return 'defer installation, inspect the tarball and lifecycle scripts, and verify publisher history or provenance';
  return 'review the package source before installing';
}

async function checkMany(packages, mode, ctx, concurrency = mode === 'audit' ? AUDIT_CONCURRENCY : HOOK_CONCURRENCY) {
  const results = new Array(packages.length);
  let next = 0;
  const worker = async () => {
    while (next < packages.length) {
      const index = next;
      next += 1;
      results[index] = await checkPackage(packages[index], ctx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), packages.length) }, worker));
  return results.map(result => ({ ...result, verdict: verdict(result, mode), reason: reason(result, mode) }));
}

async function audit(root = process.cwd(), ctx = defaultContext({ deadlineMs: null })) {
  const surface = directDependencies(path.resolve(root));
  if (!surface.manifests.length && !surface.locks.length) {
    console.log('This repository has no npm packages at all.');
    return { results: [], surface };
  }
  if (!surface.manifests.length) {
    console.log('| package | version | verdict | reason |');
    console.log('|---|---|---|---|');
    console.log(`| (unknown) | - | WARN | ${surface.locks.length} npm lockfile(s) found without a package.json; direct dependencies cannot be identified |`);
    console.log('\nNext steps: restore or locate the matching package.json, then rerun the audit.');
    return { results: [], surface };
  }
  if (!surface.dependencies.length) {
    console.log('| package | version | verdict | reason |');
    console.log('|---|---|---|---|');
    console.log('| (none) | - | PASS | npm manifests found, but no direct dependencies |');
    return { results: [], surface };
  }
  const results = await checkMany(surface.dependencies, 'audit', ctx);
  console.log('| package | version | verdict | reason |');
  console.log('|---|---|---|---|');
  for (const result of results) console.log(`| ${result.package} | ${result.version} | ${result.verdict} | ${result.reason.replace(/\|/g, '\\|')} |`);
  const notPass = results.filter(r => r.verdict !== 'PASS');
  if (notPass.length) {
    console.log('\nNext steps:');
    for (const result of notPass) console.log(`- ${result.package}@${result.version}: ${nextStep(result)}.`);
  }
  return { results, surface };
}

async function hookCommand(command, ctx = defaultContext({ deadlineMs: HOOK_DEADLINE_MS })) {
  const installs = parseInstallCommand(command);
  if (!installs.length) return 0;
  let packages = installs.flatMap(item => item.packages).map(parsePackageSpec);
  if (installs.some(item => item.bare)) {
    const surface = directDependencies(process.cwd());
    packages.push(...surface.dependencies);
  }
  const unique = [...new Map(packages.map(pkg => [`${pkg.name || pkg.raw}@${pkg.spec || ''}`, pkg])).values()];
  if (!unique.length) return 0;
  let results;
  try { results = await checkMany(unique, 'hook', ctx); }
  catch (error) {
    console.error(`npm-package-guard warning: checker error (${error.message}); allowing install.`);
    return 0;
  }
  const errors = results.filter(r => r.operationalErrors.length);
  if (errors.length) {
    console.error(`npm-package-guard warning: checks unavailable for ${errors.map(r => r.package).join(', ')} (${errors.map(r => r.operationalErrors.join(', ')).join('; ')}); allowing install.`);
    return 0;
  }
  const blocked = results.filter(r => r.verdict === 'BLOCK');
  if (blocked.length) {
    const explanation = blocked.map(r => `${r.package}@${r.version} failed ${r.findings.filter(f => f.severity === 'BLOCK').map(f => f.check).concat(r.findings.filter(f => f.severity === 'WARN').length >= 2 ? ['warning threshold'] : []).join(' and ')}: ${r.reason}`).join(' ');
    console.error(`npm-package-guard blocked this install. ${explanation}`);
    return 2;
  }
  return 0;
}

async function main() {
  const mode = process.argv[2] || 'audit';
  try {
    if (mode === 'audit') { await audit(process.argv[3] || process.cwd()); return; }
    if (mode === 'hook-command') { process.exitCode = await hookCommand(process.argv[3] || ''); return; }
    console.error('Usage: npm-package-guard.js [audit [directory] | hook-command command]');
    process.exitCode = 1;
  } catch (error) {
    if (mode === 'hook-command') {
      console.error(`npm-package-guard warning: ${error.message}; allowing install.`);
      process.exitCode = 0;
    } else {
      console.error(`npm-package-guard error: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  OperationalError, audit, checkMany, checkPackage, defaultContext, directDependencies, editDistance,
  hookCommand, parseInstallCommand, parsePackageSpec, verdict
};

if (require.main === module) main();
