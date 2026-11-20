# Spec Delta

## Purpose

Lets assigned agents review and call campaign leads through telephony-service and retain the result, disposition, and next eligible time.

## ADDED Requirements

### Requirement: Access a campaign phone and its calls
Only an eligible agent assigned to an active campaign SHALL be able to prepare its phone session or claim its leads. Phone credentials SHALL be returned only to the authenticated agent for that agent's own endpoint. Campaign calls SHALL follow the existing organization and own-call history permissions.

#### Scenario: Ineligible agent is denied
- **WHEN** an unassigned agent or an agent from another organization tries to join the campaign or fetch its phone credentials
- **THEN** access is denied without revealing campaign or credential data

### Requirement: Reserve one preview
An available agent SHALL be offered at most one outstanding preview. Within a campaign only one agent SHALL hold a preview or active attempt for any normalized destination at a time. Workholo SHALL release unconfirmed previews on expiry or Skip without placing a call or spending a retry.

#### Scenario: Agents compete for the same destination
- **WHEN** two agents claim work and the same number appears in two selected lists
- **THEN** only one receives a preview of that destination in the campaign

#### Scenario: Review expires or agent skips
- **WHEN** the preview expires or the agent skips it before confirming Dial
- **THEN** the lead is released without a call or retry debit

### Requirement: Authorize dispatch from current policy
Dispatch SHALL require explicit Dial on a valid preview and shall recheck current membership, campaign revision and state, lead eligibility, account suppression, and eligible caller ID. The command SHALL use the fixed DID or a randomly selected eligible pool DID and the customer ring limit. If a check fails, Workholo SHALL send no command.

#### Scenario: Lead is suppressed during review
- **WHEN** the lead is added to the organization's DND list after the preview starts and before dispatch
- **THEN** the call is blocked and the lead does not ring

#### Scenario: Campaign pauses before dispatch
- **WHEN** a campaign is paused and reactivated while an earlier preview or a command is still waiting for first dispatch
- **THEN** Workholo rejects the stale authorization and does not publish that command

#### Scenario: Caller ID is no longer assigned
- **WHEN** an agent dials from a fixed-DID campaign whose DID is no longer assigned to the organization
- **THEN** Workholo blocks the call without substituting a service default

### Requirement: Place one agent-first call per confirmation
Workholo SHALL durably correlate each accepted Dial with one call ID and use that ID on redelivery. The agent phone SHALL only accept matching outbound campaign invites. Telephony-service SHALL ring the agent first, then dial the lead through the trunk after the agent answers. The campaign Ring Timeout SHALL limit the customer leg only.

#### Scenario: Preview connects the lead
- **WHEN** a registered agent confirms Dial and both endpoints answer
- **THEN** the service bridges two-way audio and the customer sees the selected caller ID

#### Scenario: Repeated Dial submission
- **WHEN** the agent repeats Dial for the same preview or the command is redelivered
- **THEN** the same attempt is used and the lead is called at most once

#### Scenario: Agent does not answer
- **WHEN** the agent endpoint does not answer within its service timeout
- **THEN** the customer leg is never dialed

### Requirement: Reconcile call state for the agent
Workholo SHALL display progress and terminal outcomes from telephony-service. State SHALL advance monotonically. Duplicate and out-of-order messages SHALL leave completed work intact. If events are missing, Workholo SHALL consult service call state using the same call ID before making the attempt terminal or releasing it for another dial.

#### Scenario: Terminal event is missed
- **WHEN** a connected call ends but the agent panel misses the terminal event
- **THEN** Workholo reconciles the call by ID, records its terminal state once, and resumes the post-call workflow

### Requirement: Record disposition separately from the call outcome
Workholo SHALL retain telephony outcome, agent disposition, and lead eligibility as separate data. For a connected or customer-unanswered call, a positive wrap-up time SHALL allow one disposition from the options offered for that attempt. Expiry SHALL record an undisposed attempt. Zero wrap-up SHALL skip the prompt. After-call work SHALL block the agent's next preview until its interval ends.

#### Scenario: Call was missed and no disposition was entered
- **WHEN** the customer does not answer and the wrap-up timer expires
- **THEN** history retains the unanswered result and independently shows that no agent disposition was submitted

#### Scenario: List changes during the call
- **WHEN** the option presented for an attempt is retired before wrap-up
- **THEN** the agent can still submit that option for the current attempt and its original code and label are retained

#### Scenario: After-call work starts after wrap-up
- **WHEN** the agent submits a disposition with after-call work configured
- **THEN** the next preview becomes available only after the additional interval

### Requirement: Return only eligible retries to preview
Only a verified customer busy or no-answer result SHALL qualify for a retry under the initial policy. The lead SHALL reappear only when its status is selected, the configured interval has elapsed, and retries remain. Agent-side and infrastructure failures SHALL NOT spend a customer retry. Every retry SHALL require a new explicit Dial.

#### Scenario: Retry after no answer
- **WHEN** the campaign includes Not Answered, a customer attempt is unanswered, and one retry remains
- **THEN** the destination reappears for preview no earlier than the configured interval and is not dialed automatically

#### Scenario: Retry is disabled or status is excluded
- **WHEN** the lead is unanswered with zero retries or the campaign only selects New
- **THEN** it does not reappear as a retry
