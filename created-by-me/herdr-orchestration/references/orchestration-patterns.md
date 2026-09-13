# Herdr Orchestration Patterns

These examples are starting points. Verify live `herdr --help` output and official docs when command behavior matters.

## Manual Control Room

Use this when the user is driving from the Herdr UI.

```sh
cd /path/to/repo
herdr
```

In separate panes:

```sh
codex
opencode
claude
```

First map the visible layout. Use the panel names the user already sees when they are meaningful. If the panes are anonymous or ambiguous, ask the user to assign each panel before you launch or prompt agents, for example:

```text
I see four panels. Which one should be implementer, reviewer, tester, and orchestrator?
If you want stable Herdr targets later, I can show the rename commands after you choose.
```

Only rename after the user chooses a mapping, or when your own script created the pane and the name is part of the script contract.

Suggested roles:

- `implementer`: one writer for the checkout.
- `reviewer`: read-only diff review.
- `tester`: shell or agent that runs project-native checks.
- `orchestrator`: root agent that assigns work, reads outputs, and owns final synthesis.

## Scripted Two-Agent Review

Use when the root agent is allowed to create panes in the current Herdr session.
If the user already prepared panes manually, inspect or ask for the intended pane mapping instead of assigning roles unilaterally.

```sh
split=$(herdr pane split --current --direction right --no-focus)
review_pane=$(printf '%s\n' "$split" | jq -r '.result.pane.pane_id')

herdr agent start reviewer --kind opencode --pane "$review_pane"
herdr agent prompt reviewer "Review the current diff read-only. Do not edit files. Report bugs, regressions, and missing tests." --wait --timeout 120000
herdr agent read reviewer --source recent-unwrapped --lines 160
```

If no implementer is running yet:

```sh
herdr agent start implementer --kind codex --pane w1:p1
herdr agent prompt implementer "Implement the requested change. Keep edits minimal. Run relevant tests. Report files touched and commands run." --wait --timeout 300000
```

## Multi-Writer Worktree Layout

Use separate worktrees when more than one agent may write:

```sh
git worktree add ../repo-codex -b agent/codex-task
git worktree add ../repo-opencode -b agent/opencode-task

herdr workspace create --cwd ../repo-codex --label codex-task --no-focus
herdr workspace create --cwd ../repo-opencode --label opencode-task --no-focus
```

Give each worker its own objective. The orchestrator compares results and applies one chosen solution back in the canonical checkout only after review.

## Role Prompt Templates

Implementer:

```text
You are the implementer for this Herdr run. Work only in this checkout. Make the smallest correct change for the requested task. Do not push, deploy, merge, install packages, or change credentials. Stop and report if the task needs permission, a broad refactor, or a destructive action. Finish with files changed, tests run, result, and residual risk.
```

Reviewer:

```text
You are the read-only reviewer for this Herdr run. Do not modify files. Review the current diff and surrounding code for bugs, regressions, missing tests, and violated project conventions. Return findings first, ordered by severity, with file and line references where possible. If no issue is found, say so and name remaining test gaps.
```

Tester:

```text
You are the test runner for this Herdr run. Do not edit product files. Identify and run the smallest relevant project-native checks. If a command fails, capture the exact command, failure summary, and likely ownership. Do not retry indefinitely; change approach once, then report.
```

Planner:

```text
You are the planner for this Herdr run. Do not edit files. Inspect the request and repository context, then produce a concise plan with scope, risks, suggested worker roles, and verification gates. Mark uncertain facts as uncertain.
```

## State Handling

Use lifecycle state intentionally:

- `working`: leave it alone unless the user asks to interrupt.
- `blocked`: inspect the agent output and decide deliberately; do not auto-approve.
- `done` or `idle`: ready to read or prompt.
- `unknown`: not proof of success; inspect output or use `herdr agent explain`.

Recovery commands:

```sh
herdr agent wait reviewer --until blocked --timeout 120000
herdr agent read reviewer --source recent-unwrapped --lines 120
herdr agent send-keys reviewer esc
herdr agent explain reviewer --json
```

After a timeout:

```sh
herdr agent read implementer --source recent-unwrapped --lines 120
```

Then decide whether to wait longer, interrupt, or ask the user.

## Session Boundaries

Detach without stopping agents:

```text
ctrl+b q
```

Reattach:

```sh
herdr
```

Stop the server only when the user means to end the panes and processes:

```sh
herdr server stop
```

Live persistence keeps processes running while the server is alive. Snapshot restore after a server stop restores layout and cwd but not arbitrary running processes. Native agent resume depends on current Herdr integrations and the underlying harness.
