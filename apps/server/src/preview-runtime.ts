import {
  dispatchPreviewCalls,
  type PreviewCallCommand,
  projectPreviewCall,
  reconcilePreviewCalls,
} from "@workholo/api/services/preview-dispatch";
import type {
  PreviewCallUpdate,
  PreviewTelephonyClient,
} from "@workholo/api/services/preview-telephony";
import { parsePreviewCallEvent } from "@workholo/api/services/preview-telephony";
import type { Database } from "@workholo/db";
import { Kafka, logLevel, type SASLOptions } from "kafkajs";
import type { CoercedEnvSchema } from "./env";

type RuntimeConfig = Pick<
  CoercedEnvSchema,
  | "KAFKA_BROKERS"
  | "KAFKA_CLIENT_ID"
  | "KAFKA_GROUP_ID"
  | "KAFKA_SSL"
  | "KAFKA_SASL_MECHANISM"
  | "KAFKA_SASL_USERNAME"
  | "KAFKA_SASL_PASSWORD"
>;

const COMMAND_TOPIC = "telephony.commands";
const EVENT_TOPIC = "telephony.events";
const WORK_INTERVAL_MS = 2000;
const RECONCILE_INTERVAL_MS = 5000;

function saslOptions(config: RuntimeConfig): SASLOptions | undefined {
  const hasMechanism = Boolean(config.KAFKA_SASL_MECHANISM);
  const hasUsername = Boolean(config.KAFKA_SASL_USERNAME);
  const hasPassword = Boolean(config.KAFKA_SASL_PASSWORD);
  if (hasMechanism !== hasUsername || hasUsername !== hasPassword) {
    throw new Error(
      "Kafka SASL mechanism, username, and password must be set together"
    );
  }
  if (!(hasMechanism && config.KAFKA_SASL_MECHANISM)) {
    return undefined;
  }
  return {
    mechanism: config.KAFKA_SASL_MECHANISM,
    username: config.KAFKA_SASL_USERNAME ?? "",
    password: config.KAFKA_SASL_PASSWORD ?? "",
  } as SASLOptions;
}

export function serializePreviewCommand(command: PreviewCallCommand) {
  return {
    id: command.commandId,
    type: "call.initiate",
    issued_at: command.issuedAt.toISOString(),
    expires_at: command.expiresAt.toISOString(),
    data: {
      call_id: command.callId,
      agent_id: command.agentId,
      to: command.to,
      caller_id: command.callerId,
      customer_ring_timeout_seconds: command.customerRingTimeoutSeconds,
    },
  };
}

export async function startPreviewRuntime(
  config: RuntimeConfig,
  db: Database,
  telephony: PreviewTelephonyClient
): Promise<() => Promise<void>> {
  const brokers = (config.KAFKA_BROKERS ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
  if (brokers.length === 0) {
    throw new Error("KAFKA_BROKERS must contain at least one broker");
  }
  const sasl = saslOptions(config);
  const kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID || "workholo-server",
    brokers,
    ssl: config.KAFKA_SSL === true,
    ...(sasl ? { sasl } : {}),
    retry: { retries: 0 },
    logLevel: logLevel.ERROR,
  });
  const producer = kafka.producer({ allowAutoTopicCreation: false });
  const consumer = kafka.consumer({
    groupId: config.KAFKA_GROUP_ID || "workholo-preview-calls-v1",
  });
  await producer.connect();
  let groupJoinTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveGroupJoined: (() => void) | undefined;
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: EVENT_TOPIC, fromBeginning: false });
    const groupJoined = new Promise<void>((resolve, reject) => {
      resolveGroupJoined = resolve;
      groupJoinTimer = setTimeout(
        () =>
          reject(new Error("Kafka event consumer group did not become ready")),
        10_000
      );
      consumer.on(consumer.events.GROUP_JOIN, () => {
        if (groupJoinTimer) {
          clearTimeout(groupJoinTimer);
        }
        resolve();
      });
    });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }
        let update: PreviewCallUpdate | null;
        try {
          update = parsePreviewCallEvent(message.value.toString("utf8"));
        } catch (error) {
          console.error("Invalid telephony event", error);
          return;
        }
        if (update) {
          if (message.key?.toString("utf8") !== update.agentId) {
            console.error(
              "Telephony event key did not match its agent ID",
              update.id
            );
            return;
          }
          await projectPreviewCall(db, update);
        }
      },
    });
    await groupJoined;
  } catch (error) {
    if (groupJoinTimer) {
      clearTimeout(groupJoinTimer);
    }
    resolveGroupJoined?.();
    await consumer.disconnect().catch((disconnectError) => {
      console.error("Failed to disconnect Kafka consumer", disconnectError);
    });
    await producer.disconnect();
    throw error;
  }

  const publish = async (key: string, command: PreviewCallCommand) => {
    await producer.send({
      topic: COMMAND_TOPIC,
      messages: [
        {
          key,
          value: JSON.stringify(serializePreviewCommand(command)),
        },
      ],
      timeout: 4000,
    });
  };
  let dispatching = false;
  let reconciling = false;
  const runDispatch = async () => {
    if (dispatching) {
      return;
    }
    dispatching = true;
    try {
      await dispatchPreviewCalls(db, publish);
    } catch (error) {
      console.error("Preview dispatch worker failed", error);
    } finally {
      dispatching = false;
    }
  };
  const runReconcile = async () => {
    if (reconciling) {
      return;
    }
    reconciling = true;
    try {
      await reconcilePreviewCalls(db, telephony);
    } catch (error) {
      console.error("Preview reconciliation worker failed", error);
    } finally {
      reconciling = false;
    }
  };
  const dispatchTimer = setInterval(runDispatch, WORK_INTERVAL_MS);
  const reconcileTimer = setInterval(runReconcile, RECONCILE_INTERVAL_MS);
  await runDispatch();
  await runReconcile();

  return async () => {
    clearInterval(dispatchTimer);
    clearInterval(reconcileTimer);
    await consumer.stop();
    await consumer.disconnect();
    await producer.disconnect();
  };
}
