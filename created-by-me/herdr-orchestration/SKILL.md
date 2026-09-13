---
name: herdr-orchestration
description: Orchestrate multi-harness coding agents with Herdr workspaces, panes, agent state, and CLI automation while preserving owner approval, worktree isolation, and clear worker roles.
metadata:
  short-description: Orchestrate agents with Herdr
---

# Herdr Orchestration

Use this skill when the user wants to run, coordinate, monitor, or script multiple coding agents through Herdr. Herdr is the terminal runtime and control surface; the underlying harnesses such as Codex, Claude Code, Pi, OpenCode, Cursor Agent, Qwen, Gemini, or others still own their own model, permissions, memory, tools, and side effects.

Authoritative docs to refresh when behavior matters:

- Concepts: `https://herdr.dev/docs/concepts/`
- Agents: `https://herdr.dev/docs/agents/`
- Agent automation: `https://herdr.dev/docs/agent-automation/`
- Integrations: `https://herdr.dev/docs/integrations/`
- Session state: `https://herdr.dev/docs/session-state/`

## Mental Model

Herdr has three orchestration primitives:

- Layout: workspaces, tabs, and pane topology.
- Pane: a raw terminal that can run commands, receive input, and expose output.
- Agent: a recognized process inside a pane with lifecycle state such as `working`, `blocked`, `done`, `idle`, or `unknown`.

Treat workspace labels, pane IDs, pane titles, and agent names as runtime facts. Discover them from Herdr command output or the visible UI instead of guessing. Use existing labels when they are clear. Rename panes or agents only when the user asks, when the orchestration script created the pane itself, or after confirming a proposed mapping.

## Operating Contract

Before spawning or prompting workers, establish a compact control contract:

- Objective: what outcome this orchestration run should produce.
- Authority: what may be changed now, and what needs the user's approval.
- Topology: which repo, branch, worktree, workspace, panes, and agent roles are in play.
- Pane map: what each existing panel is already for, or which role the user wants it to have.
- Roles: one owner/orchestrator, at most one writer per checkout, reviewers read-only unless explicitly promoted.
- Stop gates: approval requests, failed tests, merge conflicts, external actions, credentials, destructive changes, or unclear ownership.

Herdr visibility is not permission. It does not grant approval for pushes, deploys, merges, purchases, account changes, credential access, broad cleanup, or destructive filesystem actions.

## Safe Topologies

Prefer these patterns:

- One checkout: one writer agent, one read-only reviewer agent, one shell/test pane.
- Multiple writers: separate Git worktrees or separate repos; never two writers in the same checkout.
- Planning and review: use read-only prompts and say explicitly that the worker must not edit files.
- Long-running tests or servers: use pane commands, not agent commands, unless a recognized agent owns the process.

When the user asks for autonomous orchestration, keep the root agent responsible for integration, verification, and final report. Worker success is evidence, not acceptance.

## Herdr Checks

At the start of a real run, verify the live state with the cheapest checks that fit the task:

```sh
command -v herdr
herdr --version
herdr integration status
```

Check needed harnesses with `command -v`, for example `command -v codex` or `command -v opencode`. If a harness is absent, report that blocker instead of substituting a different one silently.

Install or update Herdr integrations only when the user asks or when the current task explicitly includes setup. Integration installs edit the target harness config, so describe the affected harness first.

## Orchestration Loop

Use this loop for modern high-capability models:

1. Design the topology and role prompts in plain language.
2. Reuse existing Herdr panes by their visible names or pane IDs. If the user already arranged panels and their purpose is unclear, ask the user what each panel should do before launching workers.
3. Prompt workers with bounded scope, output contract, and permission limits.
4. Wait for exact lifecycle states; treat `unknown` as inconclusive.
5. Read worker output before retrying after a timeout or stalled prompt.
6. Integrate results in the orchestrator; do not let workers merge their own conclusions.
7. Verify with project-native tests and inspect Git state before reporting completion.

Never retry a prompt blindly after `timeout` or `agent_prompt_stalled`: the input may already have been sent. Read the agent or pane first.

## Prompt Contracts

Worker prompts should include:

- Role: implementer, reviewer, tester, researcher, planner, or verifier.
- Scope: files, repo, worktree, and allowed actions.
- Boundaries: read-only, no commit, no push, no install, no external action, or one-writer rule as applicable.
- Output: summary, files touched or inspected, commands run, test result, risks, and next required decision.
- Stop condition: what to do when blocked, uncertain, or asked for approval.

For long outputs from full-screen agents, prefer `agent read --source recent-unwrapped --lines N` after the agent is idle or done. If output remains incomplete, ask the worker to write a Markdown result file and report only its path.

## When You Need Examples

For concrete command patterns, role prompts, worktree layouts, and recovery recipes, read `references/orchestration-patterns.md`.
