# Command Guard

A shell-command denylist derived from [davidondrej/skills](https://github.com/davidondrej/skills).
It detects common catastrophic commands before execution. The original author is
David Ondrej; the original MIT notice is preserved in [LICENSE](LICENSE).
Local packaging, test fixes, and the Pi adapter are documented in [UPSTREAM.json](UPSTREAM.json).

## Contents

- `hooks/`: shared guard, denylist, and harmless test suite.
- `adapters/pi/command-guard.ts`: native Pi bash tool-call adapter.
- `skill/`: optional maintenance instructions, explicit invocation only.

Dependencies already required on the target system: Bash, jq, grep and standard
Unix utilities. Pi additionally needs its existing Node runtime. No dependency
installer or automatic hook configuration is included.

## Verify before installation

From this directory run `bash hooks/test-guard.sh`. Test strings are sent as JSON
to the guard; dangerous sample commands are never executed. Tests use this
checkout, not another installed copy. Do not test destructive commands directly.

## Installation

Review the files and existing destination contents first. Copy the three files
from `hooks/` to `~/.agents/hooks/`, preserving unrelated files and local changes;
make the two shell scripts executable. Keep the denylist beside the guard.

For Codex (`~/.codex/hooks.json`) or Claude Code (`~/.claude/settings.json`), merge
this entry into the existing `hooks.PreToolUse` array. Replace the placeholder
with the actual absolute path. Never replace the entire settings file:

```json
{"matcher":"Bash","hooks":[{"type":"command","command":"/ABSOLUTE/HOME/.agents/hooks/deny-dangerous.sh","timeout":10}]}
```

Codex requires review and trust of the exact hook through `/hooks`; do not bypass
that review. Start a new Claude session after changing its hooks. In Pi, copy
the adapter to `~/.pi/agent/extensions/command-guard.ts`, then reload extensions
or start a new session. Existing destination files require comparison first.

Keep this complete package on disk. Read `skill/SKILL.md` explicitly when needed.
If distributing the skill through a harness's skill directory, preserve the
relative references to the package. Distribution and invocation policy should
be approved separately; copying this repository does not activate it.

## Limits

This is a regex accident guard, not a sandbox. Obfuscated commands, interpreter
code, direct file tools and MCP operations are outside its protection. It allows
many ordinary deletion commands; it does not implement approval for every deletion.
It can also block harmless text that resembles a prohibited command.

The upstream script allows execution when jq or the patterns file is missing,
or when a payload cannot be interpreted. The Pi adapter blocks process startup
errors/timeouts, but cannot detect a successful fail-open result inside the script.
Script tests do not establish that every harness session is protected.

## Maintenance

Compare updates against the pinned revision in UPSTREAM.json; preserve local
changes and the original license. Run the test suite after changes and verify
hook discovery, enabled state and trust separately in each target harness.

References: [Codex hooks](https://learn.chatgpt.com/docs/hooks),
[Claude hooks](https://code.claude.com/docs/en/hooks),
[Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).
