# Design

## Context

Workholo has a Tauri/React agent panel with tenant-scoped call history. The current telephony-service floor plan and source show a WebRTC agent registry, a readiness/presence API, Kafka command and event topics, and a call state read API. FreeSWITCH already originates the browser leg before the carrier leg. The companion change adds the campaign's customer-leg timeout to this existing contract.

## Goals / Non-Goals

- Keep campaign authorization, call attempts, and disposition in Workholo. Keep SIP signaling, media, and trunk handling in telephony-service.
- Ship an agent-confirmed Preview workflow with recoverable delivery and call history. Voice recording, inbound routing, scheduled callbacks, and shared agent phone sessions fall outside this change.

## Decisions

### Lead claim and dial authorization

- The backend resolves the organization and current agent from the session and campaign assignment. Use an opaque organization membership identifier for the telephony endpoint, mapped server-side and valid under the service's agent-ID format. Never accept a free-form telephony agent ID, destination, caller ID, timeout, or organization identity from the agent at dial time.
- Store preview and dialability state per organization, campaign, and normalized phone. Resolve a linked active lead in stable oldest-first order, with ID as a tie-breaker. This deduplicates the same number across lists within a campaign while preserving separate campaign histories. A claim has an owner, expiry, and campaign revision. Use atomic claims and enforce one live preview, pending attempt, or post-call hold per agent across campaigns. A skipped lead returns to availability for another agent and is excluded from the skipping agent's current preview session.
- In one database transaction convert a live claim to one attempt, choose an eligible DID, and write dispatch work. Snapshot the destination, DID, campaign revision, customer ring timeout, and offered disposition IDs, codes, and labels. A repeated Dial for that preview reads the same attempt. Revalidate the exact lead, current membership, revision, selected DID, and DND before first publish or any publish retry. Fail closed if suppression cannot be checked. Validate both numbers against the deployed service's E.164 command bounds before dispatch. If the selected DID becomes ineligible, fail the dispatch and let the agent request fresh work. A command already handed to telephony-service follows that service's lifecycle.

### Agent phone and bridge

| Step | Contract |
| --- | --- |
| Prepare phone | The Workholo server uses bearer-authenticated `PUT /api/v1/agents/{agentId}` to provision and `PUT /api/v1/agents/{agentId}/status` to set ready or offline. The agent app registers directly against the configured trusted SIP-over-WSS endpoint. Check `GET /api/v1/agents/{agentId}/presence` before offering work and let telephony-service enforce the final availability reservation. Return only the agent's own SIP credentials to their active session, keep them in memory, and deregister on logout. On membership removal or loss of the agent role, Workholo denies further work and deactivates that SIP endpoint through the service. |
| Submit Dial | A server worker publishes `call.initiate` on `telephony.commands` with key `agent_id`. Envelope fields are `id`, `type`, `issued_at`, and `expires_at`. Data fields are UUID `call_id`, `agent_id`, E.164 `to`, E.164 `caller_id`, and integer `customer_ring_timeout_seconds`. Always send the assigned DID. Delivery retries reuse the same command ID, call ID, payload, and expiry. |
| Connect | The agent app correlates the trusted SIP INVITE's `X-Call-Id` with an authorized pending attempt. It may honor the trusted `Call-Info` auto-answer hint after microphone permission and matching call ownership. If the INVITE arrives before Dial returns, resolve the pending ID through the server before answering. FreeSWITCH calls the lead only after the agent answers and bridges the two media legs. The agent can hang up its SIP leg. |
| Project state | Consume `telephony.events`, keyed by `agent_id`. Handle `call.rejected`, `call.agent_ringing`, `call.agent_answered`, `call.lead_ringing`, `call.connected`, and `call.ended`. Link by stored call UUID and validate the service agent ID. Apply transitions monotonically, persist terminal outcomes once, and acknowledge after commit. The agent panel polls a tenant-scoped Workholo view of its active attempt. |

Kafka access and service bearer credentials stay on the server. Provision broker principals that can publish only the command topic or consume the event topic as needed. Deploy Workholo's consumer before allowing campaigns to dispatch. The service starts a new command group at the latest offset, so HTTP readiness alone does not prove command consumption.

### Recovery and call history

- Use a short dispatch expiry of 30 seconds from Dial confirmation. Persist dispatch state alongside the attempt and lease pending sends across worker instances. Expiry limits stale queue work. Retry ambiguous sends with the same UUID and do not extend expiry. Telephony-service deduplicates that identifier. The documented topics do not promise a recoverable event for every failure, so the database is authoritative for Workholo's accepted intent.
- On missed events, service or agent restart, or no progress before the expected transition, reconcile with bearer-authenticated `GET /api/v1/calls/{callId}`. Feed responses through the same monotonic projection. A pre-expiry 404 only means the call is not yet observable. A lost publish acknowledgment, service outage, or ambiguous post-expiry 404 must keep the attempt unavailable for redial until reconciled or confirmed safe through operational recovery. An expired item proven never published can close locally. A rejected read with no reason retains a generic rejection status.
- Link campaign attempts to the existing tenant call history with the same UUID. Keep outcome, hangup cause, disposition snapshot, and lead state distinct. Existing history reads preserve their scope and continue supporting rows created before campaigns. A late duplicate event cannot reset wrap-up, overwrite a disposition, or spend another retry.

### Post-call policy

- A connected or customer-unanswered call starts wrap-up at the terminal timestamp. Positive wrap-up permits one save before the deadline. Expiry yields undisposed and zero skips the prompt. After-call work starts when disposition is saved, at wrap-up expiry, or at the terminal timestamp if wrap-up is zero. Persist absolute server timestamps so reloads cannot reset timers. A campaign pause stops new calls and leaves existing attempts finishable by the original authorized agent.
- Use the service result and verified hangup cause to distinguish customer busy/no-answer from agent failures, carrier errors, or lost state. Count only verified customer retry attempts against the retry budget, using the call UUID for idempotent accounting. The initial attempt comes before the retry budget. Repeat eligibility requires `not_answered`, a due timestamp from the terminal result, and remaining retries. A completed call leaves the lead complete regardless of disposition. A transport failure leaves the prior dial status and retry count intact. A disposition label alone never schedules a callback.

## Risks / Trade-offs

- An old service can ignore the new timeout field. Verify the deployed consumer contract before enabling dispatch. Disable new dispatch and drain accepted commands and live calls before reverting.
- A pause, lead removal, or DND edit that arrives after command publication cannot cancel an in-flight dial through this contract. Recheck immediately before publish and keep the command lifetime short.
- Voice availability and outbound caller ID presentation depend on SIP/WSS, trunk configuration, and carrier acceptance. Exercise the real path on an authorized trunk with a consented test number.

## Migration Plan

Apply campaign-resource and campaign-configuration changes, then deploy the compatible telephony-service. Apply additive Workholo call/attempt storage and deploy the worker and event consumer. Verify the Kafka group, SIP/WSS, call read, and trunk in staging before enabling agents. On rollback, pause new dispatch and retain attempts and outcomes for reconciliation and history.
