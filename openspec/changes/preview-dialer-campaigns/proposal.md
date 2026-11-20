# Proposal

## Why

Organization owners and admins need to configure reusable resources into a preview campaign before agents can work its leads. This change establishes the campaign settings and activation rules used by the calling change.

## What Changes

- Add organization-scoped campaign listing, creation, editing, activation, pausing, and archiving. Save incomplete drafts and surface why a campaign cannot activate.
- Configure name, description, Preview dial method, lead lists, eligible dial statuses, one disposition list, and one agent or team from the existing roster. Select a fixed outbound DID or a random pool from the organization's eligible numbers.
- Configure preview duration, customer ring timeout, wrap-up time, after-call work duration, retry count, and retry interval. **Ring Timeout is the maximum time the customer's number rings after the agent answers.** Agent ringing and lead review use separate timers. This follows the confirmed campaign behavior. [Acefone Dialer Campaign](https://docs.acefone.in/docs/dialer-campaign)
- Use the organization's suppression list at dial time. An empty DND list is valid. Draft and activation operations store and validate settings. The companion calling change executes them.
- Preserve the remaining settings as follow-on scope. The implementation sequence below delivers the first preview release.

### Build order

| Order | Change | Dependency |
| --- | --- | --- |
| 1 | `manage-lead-lists`, `manage-disposition-lists`, `manage-outbound-dids`, and `manage-do-not-dial` | Independent resource changes. Each can be built on its own. |
| 2 | `preview-dialer-campaigns` | Lead lists, disposition lists, and outbound DIDs. |
| 3 | `set-outbound-customer-ring-timeout` in telephony-service | The service's existing `add-click-to-call` contract. Can ship alongside steps 1–2. |
| 4 | `run-preview-campaign-calls` | Campaign settings, DND lookup, and a deployed service supporting the customer timeout. |

### Follow-on campaign settings

| Capability | Settings and behaviors |
| --- | --- |
| Agent sessions and routing | Agent Dial-In Number, session dial-in/out, pause-code list and its three policies, agent-specific DID and lead lists, configurable traversal order, skill routing, and campaign switching controls. |
| Scheduling and outcomes | Time groups, account time zone, holiday calendar, recipient-local calling windows, agent-only callbacks and reassignment, automatic scheduled calls, enforced disposition, and configurable automatic disposition for unanswered calls. |
| Live call tools | Default or custom agent scripts, lead masking and editing, screen pop, greetings and recordings, active-time and hold audio, hangup permissions, and quick-transfer lists with external, queue, and conference permissions. Define when audio plays and which party hears it. |
| Manual dialing and forms | Manual dial modes, per-agent permissions, manual lead list, manual dial limit, and reusable webforms with optional or enforced completion. |
| Other dialer capabilities | Incoming queues, agent opt-out, auto-answer, queue callbacks, SMS/WhatsApp/video templates, feedback, CSAT, and call qualification reporting. Ratio, Progressive, and Predictive dialing have separate execution rules. |

“After Call Position” and “Calls Before Ring Duration” remain open labels. Resolve their behavior before adding controls. [Acefone campaign guide](https://docs.acefone.in/docs/dialer-campaign), [Acefone create API](https://docs.acefone.in/reference/add-a-dialer-campaign)

## Capabilities

### New Capabilities

- `preview-campaigns` — Campaign configuration, lifecycle, assignment, and tenant-scoped resource validation.

### Modified Capabilities

None.

## Impact

- Add campaign and resource mapping storage to `packages/db`, organization-scoped procedures to `packages/api`, and setup screens to `apps/console`.
- Consume the resource changes' existing list and eligibility queries. The calling change consumes campaign configuration and current membership during claim and dial.
