// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  previewAttempt,
  previewClaim,
  previewDestination,
  previewPhone,
} from "../../schema/preview";

export const PreviewAttemptModelSchema = createSelectSchema(previewAttempt);
export const PreviewAttemptInsertSchema = createInsertSchema(previewAttempt);
export const PreviewAttemptUpdateSchema = createUpdateSchema(previewAttempt);

export const PreviewClaimModelSchema = createSelectSchema(previewClaim);
export const PreviewClaimInsertSchema = createInsertSchema(previewClaim);
export const PreviewClaimUpdateSchema = createUpdateSchema(previewClaim);

export const PreviewDestinationModelSchema =
  createSelectSchema(previewDestination);
export const PreviewDestinationInsertSchema =
  createInsertSchema(previewDestination);
export const PreviewDestinationUpdateSchema =
  createUpdateSchema(previewDestination);

export const PreviewPhoneModelSchema = createSelectSchema(previewPhone);
export const PreviewPhoneInsertSchema = createInsertSchema(previewPhone);
export const PreviewPhoneUpdateSchema = createUpdateSchema(previewPhone);
