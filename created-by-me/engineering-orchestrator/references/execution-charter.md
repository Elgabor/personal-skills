# Execution charter

The charter is the owner's control surface. Fill every field from explicit user
choices or clearly labeled recommendations. Never turn a recommendation into an
approved choice.

```yaml
workflow_mode: matt | native
root_goal: <one sentence>
orchestrator:
  model: <model id>
  effort: <level>
roles:
  explorer: {model: <id>, effort: <level>, access: read-only}
  non_ui_worker: {model: <id>, effort: <level>, access: workspace-write}
  routine_ui_worker: {model: <id>, effort: <level>, access: workspace-write}
  difficult_ui_worker: {model: <id>, effort: <level>, access: workspace-write}
  reviewer: {model: <id>, effort: <level>, access: read-only}
  researcher: {model: <id>, effort: <level>, access: read-only}
  final_verifier: {model: <id>, effort: <level>, access: workspace-write}
closure_authority: <orchestrator or named role>
tracker: thread | local | <authorized external tracker>
branch:
  base: <branch>
  work: <single integration branch>
execution:
  total_live_tasks: 4
  writer_concurrency: 1
  reader_concurrency: <number>
  non_ui_repairs: <number>
  ui_repairs: <number>
external_actions:
  commit: allowed | ask
  push: allowed | ask
  pull_request: ask
  merge: ask
  deploy: ask
```

## Required decisions

- The owner approves or modifies the charter and the later plan separately.
- `matt` is the default workflow mode. `native` requires an explicit choice.
- Models are selected per role and task class, not embedded in the agent files.
- Name who performs final tests and who may close tickets. They may differ.
- State the integration branch. All writers use that branch sequentially unless
  the owner explicitly approves another topology.
- External actions remain forbidden unless their exact scope is authorized.

## Recommended safe defaults

- One root orchestrator and only direct child agents.
- At most four live tasks total: one root, one writer, and up to two read-only
  children. Do not spawn every role when fewer are sufficient.
- Thread or repository-local tracking before an external issue tracker.
- Commits only when useful and authorized; never infer push or pull-request
  approval from permission to edit or commit.
- Five repairs for non-UI work and three for UI work, followed by escalation or
  specification reassessment.

If the owner has already supplied these values, show the normalized charter and
ask only for one approval, not a questionnaire.
