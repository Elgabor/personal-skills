# NPM Package Guard

A Codex skill that checks direct npm dependencies before untrusted package code
can run. It can audit the repository you are working in on demand or add an
optional Codex hook that intercepts package installation commands.

NPM Package Guard is a focused pre-install gate, not a promise that a package is
safe. It combines registry metadata with OSV vulnerability data and produces a
small `PASS`, `WARN`, or `BLOCK` report that an agent and a human can review.

## Quick start

Install or run the setup wizard without a global npm installation:

```bash
npx --yes @elgabor/npm-package-guard@latest
```

The skill is copied to:

```text
$CODEX_HOME/skills/npm-package-guard
```

When `CODEX_HOME` is not set, it uses `~/.codex/skills/npm-package-guard`.
Restart Codex or open a fresh task after installation so skill discovery is
refreshed.

Then open any npm repository and invoke:

```text
$npm-package-guard
```

No additional prompt is required. The current repository is audited and no
package is installed.

## What it checks

For each direct dependency, NPM Package Guard prefers the exact version from an
npm, pnpm, Yarn, or Bun lockfile and checks:

- known vulnerabilities reported by OSV
- names suspiciously similar to popular packages
- `preinstall`, `install`, and `postinstall` lifecycle scripts
- versions published less than 72 hours ago
- maintainer or publisher changes
- registry deprecation notices
- newly introduced command-line binaries
- regressions in registry provenance or trusted-publisher signals
- npm aliases, resolved to their real registry package

Repository audits use bounded concurrency to keep larger dependency sets fast.

## Results

| Result | Meaning |
| --- | --- |
| `PASS` | None of the implemented checks fired. This is not proof of safety. |
| `WARN` | A named signal requires review before installation. |
| `BLOCK` | Reject that version and audit a replacement. |
| Operational warning | A service or check was unavailable. Retry instead of treating it as approval. |

Example:

```text
| package | version | verdict | reason |
|---|---|---|---|
| react | 19.2.0 | PASS | no checked risk signals |
| example-cli | 1.0.0 | WARN | release is less than 72 hours old |
| vulnerable-package | 1.2.3 | BLOCK | OSV advisory GHSA-... |
```

## Optional automatic hook

Setup asks whether you want automatic protection. The default is **No**. Merely
installing or invoking the skill never changes Codex hooks.

Enable it later with:

```bash
npx --yes @elgabor/npm-package-guard@latest enable-hook
```

The hook runs before Codex Bash commands. Unrelated commands take a fast path
with no subprocess or network request. Commands such as `npm install`,
`pnpm add`, `yarn add`, `bun add`, and explicit `npx --package` installs are
parsed and checked before execution.

In hook mode:

- one `BLOCK` stops the install
- two independent `WARN` signals stop the install
- unavailable registry, OSV, or checker services warn and fail open so the
  shell cannot be permanently bricked

After enabling the hook, run `/hooks` in Codex and trust the new entry. Until
that step succeeds, do not assume enforcement is active.

The automatic hook currently supports macOS and Linux and requires `/bin/bash`
and an existing `jq` installation. The manual audit only requires Node.js.

Disable the hook with:

```bash
npx --yes @elgabor/npm-package-guard@latest disable-hook
```

Existing Codex hook entries are preserved. Configuration changes are backed up,
and only the NPM Package Guard entry is removed.

## Commands

```bash
# Install and optionally choose the hook interactively
npx --yes @elgabor/npm-package-guard@latest

# Install without prompting for the hook
npx --yes @elgabor/npm-package-guard@latest install --no-hook

# Install and explicitly enable the hook
npx --yes @elgabor/npm-package-guard@latest install --hook

# Update managed files while preserving the allowlist
npx --yes @elgabor/npm-package-guard@latest update

# Show installed and hook status
npx --yes @elgabor/npm-package-guard@latest status

# Enable or disable automatic interception
npx --yes @elgabor/npm-package-guard@latest enable-hook
npx --yes @elgabor/npm-package-guard@latest disable-hook

# Recoverable uninstall
npx --yes @elgabor/npm-package-guard@latest uninstall
```

Updates replace managed skill files atomically, preserve `allowlist.txt`, and
keep a timestamped backup of the previous version. Uninstall first removes the
hook and then moves the skill to a timestamped recovery directory instead of
deleting it permanently.

## Allowlist

The installed `allowlist.txt` accepts one entry per line:

```text
package-name
package-name@1.2.3
@scope/package
@scope/package@2.0.0
```

Use an allowlist only after reviewing and accepting the specific risk. Updates
preserve the user's installed allowlist.

## Privacy and network access

NPM Package Guard has no telemetry, account, analytics, or external package
dependencies. During an audit it sends package names and versions only to:

- the public npm registry for package metadata
- the public OSV API for vulnerability lookup

It does not upload repository source code.

## Scope and limitations

The current release intentionally focuses on a small, explainable pre-install
gate. It does not perform:

- static analysis of downloaded tarballs
- complete transitive dependency interception
- cryptographic provenance verification
- post-install lockfile diffing
- malware sandboxing

Use it alongside lockfiles, code review, npm audit, CI, and normal dependency
hygiene.

## Development

```bash
git clone https://github.com/Elgabor/personal-skills.git
cd personal-skills/npm-package-guard
npm test
npm pack --dry-run
```

Tests cover command parsing, manager variants, aliases, lockfiles, OSV results,
timeouts, hook configuration preservation, installer updates, allowlist
preservation, and recoverable uninstall.

## License

MIT © Lorenzo Borgato
