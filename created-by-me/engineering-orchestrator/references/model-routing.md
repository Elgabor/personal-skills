# Model routing

Select models after the specification exposes ambiguity, blast radius, and test
surface. Never route by prestige alone.

## Routing criteria

Use a stronger reasoning model for architecture, unclear requirements,
cross-cutting changes, difficult UI judgment, integration, or recovery after a
bounded repair loop. Use an efficient implementation model when the ticket is
self-contained, acceptance criteria are objective, and verification is strong.
Use a different model or at least a fresh read-only context for review.

Before approving a route, verify that the chosen model is currently available in
the harness and supports the tools and permissions the ticket needs. Model names,
limits, and pricing change; this file deliberately does not claim a permanent
ranking.

## Capability profile

| Task class | Capability to prioritize | Evidence required before defaulting |
| --- | --- | --- |
| Orchestration | Strong reasoning, integration judgment, reliable delegation | Representative plan and repair-loop evals |
| Closed implementation ticket | Precise specification following and tool reliability | Correct diff plus required tests |
| Difficult UI | Visual judgment, interaction reasoning, browser tooling | Multi-viewport runtime review |
| Review and QA | Independence, defect recall, evidence discipline | Known-bug and false-positive evals |
| Documentation | Clear structured writing grounded in the code | Technical accuracy review |
| Time-sensitive research | Current web access and source discipline | Primary-source citations and uncertainty |

The owner may replace any row in the execution charter. Do not spend the most
capable model on a closed implementation ticket merely because it is available;
choose the least expensive route that has passed the relevant evaluation.

## Model execution notes

Append only the matching note to the child's delegation contract:

- **Specification-following worker:** provide a closed ticket, ordered acceptance criteria,
  explicit file ownership, exact checks, and the approved spec location. It
  implements rather than redesigns; any necessary deviation returns to the root.
- **Reasoning-heavy worker or orchestrator:** provide the goal, constraints, known evidence,
  integration boundary, and verification standard. It may resolve local technical
  ambiguity but returns product or scope decisions to the owner.
- **Visual UI worker or orchestrator:** provide visual intent, reference images,
  routes, viewports, interaction states, accessibility constraints, and browser
  checks. Require a visual self-critique and observed runtime evidence.
- **Efficient reviewer:** provide exact base/head, acceptance criteria, changed
  surface, and known risks. It stays read-only, classifies blocking versus
  non-blocking findings, and cites evidence instead of rewriting the solution.

## Repair and escalation

- Return a failed ticket to the original implementer with one precise failure and
  its evidence.
- Do not broaden the ticket during repair.
- After the approved repair budget, escalate to the stronger model selected in
  the charter or revise the specification.
- An escalated model still follows the same ticket and must pass independent
  review.
