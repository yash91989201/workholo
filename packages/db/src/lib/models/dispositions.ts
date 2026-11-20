// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { dispositionEntry, dispositionList } from "../../schema/dispositions";

export const DispositionEntryModelSchema = createSelectSchema(dispositionEntry);
export const DispositionEntryInsertSchema =
  createInsertSchema(dispositionEntry);
export const DispositionEntryUpdateSchema =
  createUpdateSchema(dispositionEntry);

export const DispositionListModelSchema = createSelectSchema(dispositionList);
export const DispositionListInsertSchema = createInsertSchema(dispositionList);
export const DispositionListUpdateSchema = createUpdateSchema(dispositionList);
