---
name: npm-package-guard
description: Audit the current repository's direct npm dependencies before installation and optionally block risky npm, pnpm, Yarn, Bun, or explicit npx installs through a Codex Bash hook. Use whenever the user invokes $npm-package-guard, asks whether an npm package is safe, requests a dependency security audit, or wants automatic pre-install protection. Unlike npm audit, check pre-install supply-chain signals without requiring an account or new package dependency.
---

# npm-package-guard

Check registry metadata and OSV before untrusted package code can run. Treat the result as a pre-install gate, not proof that a package is safe.

## Run immediately on invocation

When invoked as `$npm-package-guard` with no other message:

1. Capture the current working directory as the target repository.
2. Run the bundled `scripts/npm-package-guard.js audit <target-repository>` from this skill folder.
3. Do not ask what to scan and do not install anything.
4. Return the compact result table and concrete next steps. If the checker prints `This repository has no npm packages at all.`, return that sentence exactly and stop.

The audit discovers workspace `package.json` files and npm, pnpm, Yarn, or Bun lockfiles. It prefers locked direct versions and keeps warning-only scoring separate from hook blocking.

## Interpret results

- `PASS`: no checked signal fired. Do not call the package safe.
- `WARN`: review the named signal before installing.
- `BLOCK`: reject that version and re-audit any replacement.
- Operational warning: a check could not finish. Retry rather than treating it as approval.

Checks cover typosquats, lifecycle scripts, releases younger than 72 hours, maintainer or publisher changes, deprecation, new command-line binaries, registry trust regressions, and OSV advisories. npm aliases are resolved to their real registry package before checking.

## Offer the automatic hook only when requested

Never change Codex hooks merely because the skill was invoked. When the user asks for automatic install protection, or during skill setup explicitly wants the option:

1. Run `node scripts/manage-hook.js status` from this skill folder.
2. If disabled, ask once for permission to merge the hook into the user's Codex configuration.
3. Only after an explicit yes, run `node scripts/manage-hook.js install --yes`.
4. Tell the user to run `/hooks` in Codex and re-trust the entry. Until that succeeds, report the hook as not enforced.

Use `node scripts/manage-hook.js snippet` for a portable exact JSON snippet. Use `remove --yes` only after explicit approval. The manager preserves existing entries, creates a backup before changes, and computes the absolute hook path at runtime.

Keep manual audit available everywhere Node runs. Install the optional Bash hook only on macOS or Linux when `jq` is already available; never install missing system tools automatically.

The hook fast-path exits without subprocesses or network calls for unrelated commands. For installs, one `BLOCK` signal or two `WARN` signals exits 2. Registry, timeout, and checker failures warn and fail open so a broken service cannot brick the shell.

## Allowlist and validation

Edit `allowlist.txt` only after explicit approval. Use `package-name` for all versions or `package-name@1.2.3` for one exact version. Scoped names work. Blank lines and `#` comments are ignored.

After changing the skill, run:

```bash
node scripts/test.js
```

Keep transitive interception, tarball static analysis, cryptographic provenance verification, and post-install lockfile diffing out of this small pre-install gate.
