// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { outboundNumber, outboundNumberAssignment } from "../../schema/numbers";

export const OutboundNumberModelSchema = createSelectSchema(outboundNumber);
export const OutboundNumberInsertSchema = createInsertSchema(outboundNumber);
export const OutboundNumberUpdateSchema = createUpdateSchema(outboundNumber);

export const OutboundNumberAssignmentModelSchema = createSelectSchema(
  outboundNumberAssignment
);
export const OutboundNumberAssignmentInsertSchema = createInsertSchema(
  outboundNumberAssignment
);
export const OutboundNumberAssignmentUpdateSchema = createUpdateSchema(
  outboundNumberAssignment
);
