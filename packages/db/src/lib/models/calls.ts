// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { call, recording } from "../../schema/calls";

export const CallModelSchema = createSelectSchema(call);
export const CallInsertSchema = createInsertSchema(call);
export const CallUpdateSchema = createUpdateSchema(call);

export const RecordingModelSchema = createSelectSchema(recording);
export const RecordingInsertSchema = createInsertSchema(recording);
export const RecordingUpdateSchema = createUpdateSchema(recording);
