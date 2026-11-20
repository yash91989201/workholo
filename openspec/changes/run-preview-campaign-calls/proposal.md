# Proposal

## Why

Once a preview campaign is configured, an assigned agent needs to review a lead, place a real outbound call, and record what happened. Workholo must carry campaign policy and call history while telephony-service owns FreeSWITCH and the carrier connection.

## What Changes

- Let an assigned agent register the Workholo WebRTC phone, open an active campaign, claim one eligible lead, and choose Dial or Skip. Expiry releases the claim without dialing.
- Check current assignment, campaign revision and status, lead and DID eligibility, and account DND immediately before dispatch. Prevent duplicate attempts and concurrent claims for the same destination within the campaign.
- Persist the attempt before sending the agent-first call command. Pass the selected DID and the campaign's customer ring timeout. Connect the agent and lead through the existing service, display call state, and reconcile missed events.
- Keep service outcome, agent disposition, and lead eligibility separate. Apply wrap-up and after-call work, and return eligible unanswered leads to review after the configured interval and within the retry limit.
- Confirm the complete flow with a registered Workholo agent and a consented test destination on an authorized trunk. Verify both-way audio, the selected caller ID, call history, and disposition.

## Capabilities

### New Capabilities

- `preview-campaign-calling` — Assigned-agent preview, call dispatch, recovery, disposition, and retry through telephony-service.

### Modified Capabilities

None.

## Impact

- Depends on `preview-dialer-campaigns`, `manage-do-not-dial`, and deployment of telephony-service's `set-outbound-customer-ring-timeout`.
- Extends the Workholo server, call storage, and agent panel. Uses telephony-service's agent/presence HTTP API, Kafka `telephony.commands` and `telephony.events`, and `GET /api/v1/calls/{callId}`.
- Voice sessions, scheduled callbacks, manual dialing, transfers, forms, and new dialing methods are follow-on changes.
