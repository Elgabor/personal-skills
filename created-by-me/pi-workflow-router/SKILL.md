---
name: pi-workflow-router
description: Route a coding request to the smallest appropriate Matt Pocock workflow, or direct handling when no workflow adds value. Use only when the user explicitly asks for this router or a Matt workflow, or when a coding task genuinely needs workflow selection; do not invoke it for every request.
---

# Pi Workflow Router

When this skill is selected, choose the workflow before acting without expanding
the user's scope. Do not run this router for general conversation, research,
writing, translation, project administration, or a simple coding change whose
route is already clear.

1. Read `../ask-matt/SKILL.md` completely as the canonical routing map.
2. Inspect only the context needed to distinguish the route.
3. Select one primary workflow. Use direct handling for simple questions,
   translations, tiny edits, and other self-contained work where a staged
   workflow adds no value.
4. When routing is useful, lead with one concise Italian line:
   `Workflow: <skill or sequence> - <why it fits>.`
5. Continue immediately when the user's request already authorizes the next
   action. Ask only for a decision that materially changes the result, safety,
   or external side effects.

## Pi compatibility

- Invoke installed skills as `/skill:<name>` when instructing the user.
- Pi has no built-in `Skill` tool. When a Matt Pocock skill says to call the
  Skill tool with another skill name, read that installed skill's `SKILL.md`
  completely and apply it inline.
- Pi has no built-in subagent tool. If no subagent extension is loaded, run
  independent work sequentially or stop at a phase boundary with a handoff.
  Never claim that parallel agents were used.
- If an engineering workflow needs `docs/agents/issue-tracker.md` and the repo
  has not been configured, route first to
  `/skill:setup-matt-pocock-skills`. Do not create that configuration silently.

## Authority boundary

Selecting a workflow does not authorize commits, branches, issue-tracker
writes, pushes, pull requests, merges, deploys, publishing, deletion, secret
access, or other external actions. Require current-task authorization for the
specific action, even if an upstream skill describes it as part of its normal
flow.

## Outside Pi

Use the current harness native skill and delegation tools when available.
Otherwise read the referenced SKILL.md files and apply the workflow inline.
The Pi compatibility section describes Pi only; never claim unavailable tools
were used and never install dependencies or broaden permissions implicitly.
