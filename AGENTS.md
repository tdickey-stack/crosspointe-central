# CrossPointe Central agent guidance

## Delegate when useful

Use subagents proactively when they will materially improve completion time or
the quality of the result. This file explicitly requests delegation in those
cases; the user does not need to repeat permission in each task.

- Delegate concrete, bounded work that can run independently alongside useful
  work by the parent: tracing separate code paths, implementing independent
  modules, testing agreed contracts, or reviewing a stable change.
- Prefer one or two subagents initially. Add more only for another independent
  workstream, within the live tool's concurrency limit. Do not fill slots merely
  because they are available. Children should return additional work to the
  parent rather than creating their own agent tree by default.
- Keep simple edits, short questions, sequential debugging, and tasks with heavy
  shared-file coordination local. Batch independent tool calls when that is
  sufficient. Never delegate the same investigation the parent is already doing.
- Discussion-only requests remain discussion-only for every agent. Delegation
  does not expand the user's scope or authorize implementation or publication.
- Use internal subagents, not new user-facing Codex tasks, for delegated work.

## Select the model and reasoning effort

Use the following routing policy for bounded subagent assignments. Model IDs
below are preferences, not a permanent availability list: check the current
spawn tool's supported models and reasoning levels before selecting them.
An explicit user model preference takes precedence. Keep the parent's model
unchanged unless the user requests otherwise.

| Assignment | Preferred subagent model | Reasoning |
| --- | --- | --- |
| Narrow file lookup, mechanical checks, straightforward documentation | `gpt-5.6-luna` | low |
| Repository reconnaissance, focused tests, routine implementation with a clear contract | `gpt-5.6-terra` | medium |
| Substantial implementation, integration debugging, complex behavior review | `gpt-5.6-sol` | high |
| Ambiguous architecture, difficult root-cause analysis, security-sensitive reasoning across systems | `gpt-6-astra` | high |

- These are task-routing defaults, not measured performance or price guarantees.
- Escalate a bounded assignment when evidence shows the lighter configuration
  is insufficient. Send the stronger agent the findings and unresolved question
  rather than repeating the entire investigation.
- Reserve xhigh/max/ultra for unusually difficult work that warrants the extra
  reasoning; do not select maximum effort automatically for reviews.
- If a preferred model is unavailable, use a suitable model advertised by the
  active tool, or inherit the parent. Do not repeatedly retry unsupported IDs.
- When context inheritance requires the parent's configuration, omit model and
  reasoning overrides. This policy authorizes explicit subagent model selection
  where the current tool supports it; it does not alter runtime configuration.

## Give each agent the right context

- Default to a fresh context (`fork_turns="none"` when supported) for a
  self-contained assignment. Include the objective, relevant user decisions,
  scope, exact file ownership, known facts, API/data contract, applicable
  instructions, acceptance criteria, and required output in the task message.
- Use a limited recent-turn fork when recent discussion matters, supplementing
  any older decisions explicitly. Do not assume recent turns contain the whole
  specification or permissions.
- Use full history only when the work depends on nuanced prior decisions that
  would be costly or risky to summarize. With the current collaboration tool,
  full-history forks inherit the parent's model and reasoning; do not combine
  them with explicit overrides. Follow the live schema if this changes.
- Pass relevant paths and symbols rather than broad repository dumps or noisy
  logs. Do not copy secrets into agent prompts. Read applicable skills and
  instructions, and convey their requirements to fresh-context agents.
- Require a concise return: changes or findings, file/line references, checks
  run and results, unresolved risks, and any decisions needed from the parent.

## Coordinate and verify

- Assign disjoint write ownership before parallel edits. Keep shared composition
  files such as `functions/index.js`, dependency manifests, lockfiles, and shared
  configuration under one writer at a time. Agents must not revert others' work.
- Agree on interfaces before parallel implementation. Test agents should verify
  intended behavior and edge cases, not merely mirror the implementation.
- The parent owns integration, resolving disagreements, and final verification.
  Review agent changes and confirm their evidence before reporting completion.
- Use independent review for consequential or complex changes when it can run
  alongside remaining validation. Give the reviewer a stable diff or commit;
  resolve material findings before release. Skip review ceremony for trivial edits.
- Verify visual changes in a rendered browser, including affected responsive
  layouts. Passing code tests alone does not establish visual correctness.
- Reuse an existing agent for a follow-up on its assignment. Prefer completion
  notifications or bounded waits over frequent status polling; continue useful
  parent work while agents run.
- Tell the user briefly what is being delegated and why. Report one integrated
  outcome, distinguishing verified results from remaining limitations.
- The parent coordinates authorized commits, pushes, merges, and deployments.
  Subagents must not independently deploy or change shared git branches.
