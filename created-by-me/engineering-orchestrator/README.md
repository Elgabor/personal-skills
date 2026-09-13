# Engineering Orchestrator

An owner-controlled engineering pipeline for Codex. One root orchestrator keeps
the goal, specification, ticket state, routing, review decisions, and final
verification coherent while direct child agents perform bounded work.

The skill is deliberately model-agnostic. You choose the orchestrator, workers,
reviewer, final verifier, and ticket closure authority in an execution charter
before any implementation starts.

## Workflow contract

- two explicit owner gates: execution charter, then specification and tickets;
- one accountable root task and direct child tasks with self-contained context;
- one writer at a time by default;
- independent review, bounded repair, and final end-to-end verification;
- explicit external-action permissions;
- per-run model routing rather than stale model IDs embedded in presets.

It cannot change the model of the current root task. Start the task with the
model you want to orchestrate, or switch models before approving the charter.
This release dispatches native Codex subagents only. It does not call BB,
OpenCode, OpenRouter, Grok, or another external harness; those require a separate,
explicitly authorized adapter and their own usage accounting.

## Install on Codex

Copy this directory to:

```text
~/.codex/skills/engineering-orchestrator/
```

Copy the TOML files from `codex-agents/` to:

```text
~/.codex/agents/
```

The supplied agent definitions do not pin a model. Codex can therefore apply
the model and reasoning effort approved for the current role. They also do not
overwrite `~/.codex/config.toml` or project instructions. Current parent-task
permission overrides can supersede an agent's `sandbox_mode`, so verify the live
permission mode before relying on a read-only or workspace-write boundary.

See the official [Codex subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)
for the current custom-agent loading and model-selection rules.

Restart Codex or begin a new task after installation so skill discovery refreshes.

Installed agent roles:

| Agent | Default access | Responsibility |
| --- | --- | --- |
| `engineering-explorer` | read-only | Maps the relevant code and constraints. |
| `engineering-worker` | workspace-write | Implements one approved ticket in owned files. |
| `engineering-reviewer` | read-only | Reviews the bounded diff independently. |
| `engineering-researcher` | read-only | Resolves one sourced technical question. |
| `engineering-verifier` | workspace-write | Runs final end-to-end checks without repairing production code. |

The agent files define behavior and access, not a fixed model. The root dispatches
each role with the model and effort approved in the charter.

The TOML is the stable role prompt. It does not contain the project or ticket.
At dispatch, the root adds the approved specification, exact ticket, applicable
repository rules, file ownership, acceptance criteria, verification commands,
and the matching capability-based execution note. This keeps children focused
without giving every child the entire root conversation.

## Matt workflow mode

`workflow_mode: matt` is the default. Install Matt Pocock's workflows separately
from their [official repository](https://github.com/mattpocock/skills). This
project does not bundle, modify, or relicense them.

If you do not want to use them, say this explicitly in the first request:

```text
Use $engineering-orchestrator with workflow_mode: native.
```

Native mode keeps the same specification, ticket, review, repair, and verification
gates without invoking Matt's skills.

## Start a task

Example:

```text
Use $engineering-orchestrator for this goal.

Propose the charter first. I must approve both the charter and the final
specification/ticket plan. Use one integration branch and one writer at a time.
Recommend models by ticket, but let me change every role. Do not push, open a PR,
merge, or deploy without my explicit approval.
```

The root responds with a normalized charter. Modify any field or reply
`CHARTER APPROVED`. It then inspects the repository, creates the specification and
tickets, and waits for `PLAN APPROVED`. After that, the root dispatches direct
children, reviews their reports, issues repairs when needed, and invokes the
chosen final verifier.

For a long-running task, you may also start a persistent Codex goal before
invoking the skill. The goal keeps the task alive; this skill defines the
engineering pipeline. It does not emulate or add a `/goal` command to harnesses
that lack one.

## Model selection

The skill does not embed a personal model profile. Select models in the charter
from the capabilities the task actually needs: reasoning under ambiguity,
specification following, visual judgment, tool access, independent review, or
cost-efficient verification. Validate unfamiliar models on representative work
before making them a default.

## Context flow

Each child starts in a separate agent context. It does not receive the root's full
conversation automatically as an implicit source of truth. The root sends a
self-contained delegation contract containing the approved spec/ticket, relevant
repository rules, file ownership, acceptance criteria, required checks, and
authority limits. The child returns evidence to the same root; children do not
hand off work to one another.

## License and credits

Released under the MIT License, copyright Lorenzo Borgato. See `NOTICE.md` for
community inspiration and third-party dependencies.
