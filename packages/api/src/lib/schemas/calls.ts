import z from "zod";

const listInputShape = {
  organizationId: z.string(),
  limit: z.number().int().min(1).max(100).default(50),
};

const callRowSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  agentId: z.string(),
  direction: z.string(),
  status: z.string(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
});

const recordingRowSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  callId: z.string(),
  agentId: z.string(),
  url: z.string(),
  createdAt: z.date(),
});

export const ListCallsInputSchema = z.object(listInputShape);
export const ListCallsOutputSchema = z.array(callRowSchema);

export const ListRecordingsInputSchema = z.object(listInputShape);
export const ListRecordingsOutputSchema = z.array(recordingRowSchema);
