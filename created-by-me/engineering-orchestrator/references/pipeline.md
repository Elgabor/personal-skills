# Delivery pipeline

## Matt mode

Matt Pocock's workflows are optional external dependencies, available from the
[official repository](https://github.com/mattpocock/skills). Do not copy, install,
or modify them without authorization.

Use the smallest relevant sequence:

1. `grill-with-docs` only when product scope or domain language is genuinely
   unclear.
2. `to-spec` to turn the resolved conversation and repository evidence into an
   implementable specification.
3. `to-tickets` to create dependency-aware tracer-bullet tickets.
4. `tdd` where behavior can be driven by tests.
5. `code-review` for independent review of the completed change.

Before invoking a workflow that writes to a tracker, confirm its destination and
that the owner authorized the write. Otherwise use the method in the current
thread and do not claim the external workflow ran.

Keep temporary specifications, ticket files, skill copies, and orchestration
metadata outside the product diff and eventual pull request unless the owner
explicitly chooses to publish a particular artifact. Prefer an ignored local
tracker such as `.scratch/` when repository policy permits it.

The two gates in this skill remain authoritative even when a Matt workflow would
normally continue: `CHARTER APPROVED` before orchestration and `PLAN APPROVED`
before implementation.

## Native mode

When the owner explicitly chooses `native`, create the same artifacts directly:

- specification: problem, scope, non-goals, constraints, acceptance criteria,
  risks, verification, and unresolved decisions;
- tickets: objective, dependencies, owned files, acceptance criteria, tests,
  model route, and evidence expected;
- final plan: ordered tickets, branch strategy, repair budgets, and final checks.

Do not imitate slash commands or pretend unavailable skills were invoked.

## Execution state machine

```text
proposed -> approved -> active -> in_review -> repair | accepted
accepted tickets -> final_verification -> done | repair
```

Only the root dispatches agents. Each worker returns to the root. Review and
repair are separate assignments; a worker does not hand work directly to another
worker. A ticket is accepted only after diff and verification evidence have been
inspected.

For UI tickets, include browser-based verification when a runnable interface is
available. For backend or data tickets, prefer the narrowest meaningful test plus
the relevant integration boundary. Record `NOT RUN` with the reason instead of
implying a check passed.
