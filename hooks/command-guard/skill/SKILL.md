---
name: command-guard
description: Inspect, install, or maintain the bundled catastrophic shell command guard when the user explicitly requests command protection. Review the denylist and harness wiring; skill discovery alone does not enforce command blocking.
disable-model-invocation: true
---

# Command Guard

Read `../README.md`, `../UPSTREAM.json`, and the scripts in `../hooks/` before
installing or changing the guard. This directory belongs to a complete package:
keep the sibling hooks and adapters accessible when using this skill.

Use only the harnesses the user requested. Inspect existing hook definitions,
preserve unrelated entries, and show the intended changes. Do not install
missing dependencies, change permissions, or bypass hook trust without approval.

The guard only checks shell command text against a denylist. It does not enforce
approval for all file deletions or protect direct file tools and MCP calls.
Missing jq, missing patterns, or malformed payloads can cause upstream fail-open
behavior. Disclose these limits. Never work around a guard rejection.

For a pattern change, add representative block and allow cases to the test suite.
Run `bash ../hooks/test-guard.sh`; it submits JSON to the guard and never executes
the sample commands. Verify actual hook discovery and trust in the target
harness. Report script tests separately from end-to-end runtime verification.

Keep upstream revision, license, and local modifications in UPSTREAM.json.
Updates must preserve user-approved activation, destinations, and local changes.
