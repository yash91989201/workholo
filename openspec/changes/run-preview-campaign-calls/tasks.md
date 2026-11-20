# Tasks

## 1. Agent setup and preview

- [x] 1.1 Add the server-side telephony agent client and scoped SIP/presence procedures using the member-to-agent mapping. Test unauthorized credential requests, inactive membership, deactivation on role loss, and readiness changes.
- [x] 1.2 Add the Workholo agent phone, SIP/WSS registration and deregistration, and work status controls. Verify the service sees a signed-in test agent become ready and available, then offline or unregistered on logout.
- [x] 1.3 Add campaign selection and atomic preview claims with a server deadline and Skip. Test two agents requesting the same normalized number across lists, one outstanding preview per agent, wrong tenant, and expiry without a call.

## 2. Place and observe calls

- [x] 2.1 Persist an attempt and dispatch work atomically from a confirmed preview. Test duplicate Dial, stale revision, revoked assignment, changed lead, suppressed destination, and revoked or disabled DID.
- [x] 2.2 Publish the stable command through Kafka after a fresh eligibility check. Test revalidation on delayed publish, DND lookup failure, the service's E.164 bounds, the customer timeout field, matching keys, expiry, and unchanged IDs after an ambiguous acknowledgment.
- [x] 2.3 Verify trusted SIP INVITE matching and agent answer/hangup in the panel. Exercise an INVITE that arrives before the Dial response and an unmatched INVITE that must be refused.
- [x] 2.4 Project call events into tenant-scoped call state and history. Test lifecycle progression, duplicate or late events, unknown IDs, mismatched agents, and compatibility with existing history rows.
- [x] 2.5 Reconcile stalled attempts through the call read API. Test a missed terminal event, transient API failure, delayed 404, and a command known never to have been published. Document Kafka/SIP deployment order, the supported service version, and ambiguous-attempt recovery. Verify an ambiguous attempt cannot trigger a new dial while unresolved.

## 3. Disposition and redial eligibility

- [x] 3.1 Add disposition snapshots, wrap-up deadlines, and after-call work holds. Test one authorized submission, a retired choice on an existing attempt, zero wrap-up, expiry, and deadlines across reloads.
- [x] 3.2 Update lead status and retry timing exactly once per call. Exercise eligible busy/no-answer, agent-missed and carrier failure, zero retries, exhausted retries, New-only selection, and another explicit Dial for a due retry.

## 4. End-to-end acceptance

- [ ] 4.1 From a configured Workholo campaign, call a consented test destination on an authorized trunk. Observe agent-first ringing, two-way audio, the selected DID, SIP hangup, persisted disposition, and the correct history and retry state.
- [ ] 4.2 Run an unanswered test with a non-default customer timeout and measure the customer leg. Verify agent no-answer never dials the lead, a replay places only one call, and a missed terminal event still advances the agent through wrap-up.
