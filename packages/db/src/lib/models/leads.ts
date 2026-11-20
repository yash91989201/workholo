// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { lead, leadList } from "../../schema/leads";

export const LeadModelSchema = createSelectSchema(lead);
export const LeadInsertSchema = createInsertSchema(lead);
export const LeadUpdateSchema = createUpdateSchema(lead);

export const LeadListModelSchema = createSelectSchema(leadList);
export const LeadListInsertSchema = createInsertSchema(leadList);
export const LeadListUpdateSchema = createUpdateSchema(leadList);
