const activeAttemptStatuses = new Set([
  "queued",
  "initiating",
  "agent_ringing",
  "agent_answered",
  "lead_ringing",
  "connected",
]);

export type InviteAttempt = {
  id: string;
  status: string;
};

export async function authorizeInvite(
  callId: string,
  readAttempt: () => Promise<InviteAttempt | null>,
  remainingReads = 3
): Promise<boolean> {
  const activeAttempt = await readAttempt();
  if (activeAttempt?.id === callId) {
    return activeAttemptStatuses.has(activeAttempt.status);
  }
  if (remainingReads <= 1) {
    return false;
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  return authorizeInvite(callId, readAttempt, remainingReads - 1);
}

export async function authorizeIncomingInvite(
  callId: string,
  readAttempt: () => Promise<InviteAttempt | null>,
  reject: () => Promise<void>
): Promise<boolean> {
  const authorized = await authorizeInvite(callId, readAttempt);
  if (!authorized) {
    await reject();
  }
  return authorized;
}
