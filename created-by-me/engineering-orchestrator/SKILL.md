---
name: engineering-orchestrator
description: Orchestrate substantial software work through an owner-approved charter, specification, tickets, delegated implementation, independent review, repair, and final verification. Use when the user asks for an engineering team, model routing, subagents, or a reliable multi-stage delivery pipeline. The owner chooses the orchestrator, workers, verifier, closure authority, and whether to use Matt Pocock workflows or native mode.
license: MIT
metadata:
  author: Lorenzo Borgato
  version: "1.2.0"
---

# Engineering Orchestrator

Keep one root agent accountable for the whole goal. Delegate bounded work; never
delegate accountability.

## 1. Establish the execution charter

Read [execution-charter.md](references/execution-charter.md). Inspect relevant
repository rules and current state, then present a completed charter to the
owner. Reuse choices already stated in the conversation instead of asking again.

Default to `workflow_mode: matt`. Use `native` only when the owner explicitly
chooses it. If Matt's required skills are unavailable, do not install them or
silently fall back: offer their official repository or ask for `native` mode.

The current root cannot replace itself with another model. If it does not match
the approved orchestrator, stop before execution and tell the owner to start or
switch to that model, then invoke this skill again.

Do no delegated or mutating work until the owner says `CHARTER APPROVED` or gives
an equally explicit approval.

## 2. Specify and ticket

Follow [pipeline.md](references/pipeline.md). Produce a concrete specification
and a dependency-ordered set of small, vertically testable tickets. In Matt mode,
use the relevant installed workflows; preserve this skill's authority and
approval gates.

Present the specification, tickets, routing, branch strategy, and verification
plan. Do not begin implementation until the owner says `PLAN APPROVED` or gives
an equally explicit approval.

## 3. Delegate through direct children

Use direct child agents of the root. Do not rely on hidden conversation context:
every delegation must satisfy [delegation-contract.md](references/delegation-contract.md).
Pass only the context required for the ticket and repository-local rules.

In Codex, dispatch the matching `engineering-*` agent with the approved model and
reasoning effort. Use no conversation fork, or the smallest bounded fork the
harness requires, because the delegation contract must stand on its own. Record
each returned child task ID for monitoring and traceability.

Before dispatch, append the matching role execution notes from
[model-routing.md](references/model-routing.md). The TOML supplies stable role
behavior; the delegation contract supplies all task-specific context.

Keep one writer active at a time unless the charter explicitly permits more.
Read-only exploration may run concurrently up to the approved limit. Workers do
not close tickets, spawn further agents, push, open pull requests, merge, deploy,
publish, or change scope unless explicitly authorized.

Choose models with [model-routing.md](references/model-routing.md). The charter,
not the examples in that reference, is authoritative.

## 4. Review, repair, and verify

After each implementation, dispatch an independent reviewer. The root evaluates
the diff and evidence, then either accepts it or issues one narrow repair contract
for the failed criterion. Respect the charter's repair budget; after exhaustion,
escalate model or revisit the specification instead of looping.

After all tickets pass, dispatch the approved final verifier for end-to-end,
regression, and user-facing checks. The approved closure authority may close
tickets only on recorded PASS evidence. The root alone declares the root goal
complete and records residual risk.

## Completion contract

Finish only when:

- the approved specification and every acceptance criterion are traceable;
- each ticket has implementation and independent review evidence;
- required tests and user-facing checks passed or are explicitly `NOT RUN`;
- no unauthorized external action occurred;
- the final verifier passed and the closure authority recorded the decision;
- the owner receives a concise result, evidence, residual risk, and next action.
