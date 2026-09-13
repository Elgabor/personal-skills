# Delegation contract

Every child receives a self-contained contract. Reference repository files by
relative path when possible; do not paste unrelated chat or private material.

```text
ROLE
<explorer | worker | reviewer | researcher | verifier>

OBJECTIVE
<one bounded outcome>

CONTEXT
- Approved specification: <path or exact excerpt>
- Ticket: <identifier and exact contract>
- Repository rules: <applicable files>
- Base/head: <commits or branch>

SCOPE AND OWNERSHIP
- Owned files: <explicit paths or module>
- May change: <bounded list>
- Must not change: <list>
- Other agents may be working; preserve their changes.

ACCEPTANCE CRITERIA
1. <observable outcome>

VERIFICATION
- Run: <commands or manual checks>
- Required evidence: <test output, diff findings, screenshots, citations>

MODEL EXECUTION NOTES
<matching concise overlay from model-routing.md>

AUTHORITY
- Permissions: <read-only | workspace-write>
- No subagents, scope expansion, ticket closure, push, PR, merge, deploy, or
  publication unless this contract explicitly authorizes it.
- Stop and report if a missing decision changes behavior or safety.

RETURN TO ROOT
- Result: PASS | FAIL | BLOCKED
- Files changed or inspected
- Verification performed and evidence
- Assumptions, residual risks, and exact next action
- Actual model, effort, child task id, and elapsed time when available
```

## Role boundaries

- Explorer: maps code paths and evidence; never edits.
- Worker: implements only the assigned ticket and runs its checks.
- Reviewer: inspects the agreed diff and reports findings by severity; never
  silently repairs.
- Researcher: uses primary sources where possible and distinguishes facts from
  inference; never edits implementation files.
- Verifier: tests the complete user story independently and reports PASS/FAIL;
  it edits production code only through a separately approved repair ticket.
