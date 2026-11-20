# Preview campaign calling deployment

Campaign dispatch requires a Workholo server build with the preview migrations and a telephony-service build that implements the existing agent HTTP API, call read API, Kafka topics, and per-call `customer_ring_timeout_seconds` support (the `set-outbound-customer-ring-timeout` change). The inspected telephony-service source contains this implementation but is uncommitted; no released compatible build was verified. Deploy the reviewed change's resulting build and verify the timeout field before enabling dispatch. The customer timeout is an integer from 1 to 120 seconds and applies only after the agent answers.

## Configure the Workholo server

Set these variables in the server's secret environment (the Docker Compose `server` service receives them through `apps/server/.env`):

- `TELEPHONY_API_URL`: trusted telephony-service base URL.
- `TELEPHONY_API_TOKEN`: service bearer token.
- `KAFKA_BROKERS`: comma-separated broker addresses.
- `KAFKA_CLIENT_ID`: optional Kafka client ID; defaults to `workholo-server`.
- `KAFKA_GROUP_ID`: optional durable consumer group; defaults to `workholo-preview-calls-v1`. Keep it stable between restarts.
- `KAFKA_SSL`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, and `KAFKA_SASL_PASSWORD` when the broker requires TLS/SASL.

The server starts its event consumer before its dispatch and reconciliation loops. Keep broker auto-topic creation disabled and provision a principal that can produce to `telephony.commands` and consume `telephony.events`. Telephony-service must consume `telephony.commands` and publish `telephony.events`. Workholo commits each event only after the database projection completes. The producer has no internal resend loop; after an ambiguous send the durable worker retries the same command and call IDs after rechecking current policy.

## Rollout and recovery

1. Apply the Workholo database migrations.
2. Deploy telephony-service with the customer timeout contract and verify its authenticated agent and call-read APIs.
3. Provision the Kafka topics and least-privilege principals, then deploy telephony-service with command consumption and event publication enabled. Confirm its command consumer group has joined before publishing. A new group starts at the latest offset.
4. Deploy Workholo with the consumer group configured. Confirm it has connected and is consuming `telephony.events` before enabling campaign dispatch.
5. Confirm SIP/WSS registration and presence through the agent UI before starting a campaign.

Use a separate staging broker for staging; the topic names are fixed to `telephony.commands` and `telephony.events`. Do not run dispatch tests against a production or shared trunk: any command can initiate a real carrier call.

On a publish timeout or process crash, the attempt remains unavailable for redial. Reconciliation reads `GET /api/v1/calls/{callId}`; a delayed 404 does not release the attempt. Keep the same broker group and let the worker retry the durable command before its expiry. If an attempt remains ambiguous after expiry, pause dispatch and resolve it operationally; never create a replacement attempt until the original call is confirmed terminal or proven never published. A service 404, missing retained Kafka record, or API/network error is not proof that the call was never published.

Only after an authoritative broker/send audit proves a command was never accepted, pause the Workholo dispatch worker and run a guarded update for that call UUID. The update below only resets an expired, unacknowledged, still-queued attempt; when workers resume, the normal worker marks it `dispatch_expired` and does not send the expired command:

```sql
UPDATE preview_attempt AS attempt
SET publish_started = false,
    next_publish_at = now()
FROM "call"
WHERE "call".id = attempt.id
  AND attempt.id = '<call-uuid>'
  AND attempt.publish_started = true
  AND attempt.published_at IS NULL
  AND "call".status = 'queued'
  AND attempt.expires_at <= now()
RETURNING attempt.id;
```

If those exact guards match no row, or publication remains ambiguous, leave the attempt blocked and escalate for operational review; do not clear it or create another attempt.

## Offline verification

Apply the migrations to an isolated test Postgres database. Set `TEST_DATABASE_URL` to that database and run `bun test packages/api/src/services/preview.integration.test.ts`. The suite uses simulated telephony requests and publish acknowledgments. The telephony-service Go suite exercises agent-first origination and separate ring limits with a simulated FreeSWITCH connection.
