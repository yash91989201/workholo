// AUTO-GENERATED FILE. DO NOT EDIT.
import type { z } from "zod";
import type { SignInFormSchema, SignUpFormSchema } from "./schemas/auth";
import type {
  AddDispositionEntryFormSchema,
  CreateDispositionListFormSchema,
  UpdateDispositionListFormSchema,
} from "./schemas/disposition";
import type { AddDoNotDialEntryFormSchema } from "./schemas/do-not-dial";
import type {
  AddLeadFormSchema,
  CreateLeadListFormSchema,
  ImportLeadsFormSchema,
  UpdateLeadListFormSchema,
} from "./schemas/lead";
import type { CreateOrganizationFormSchema } from "./schemas/organization";
import type {
  CreateTeamFormSchema,
  RenameTeamFormSchema,
} from "./schemas/team";
import type { InviteUserFormSchema } from "./schemas/user";

export type AddDispositionEntryFormType = z.infer<typeof AddDispositionEntryFormSchema>;
export type AddDoNotDialEntryFormType = z.infer<typeof AddDoNotDialEntryFormSchema>;
export type AddLeadFormType = z.infer<typeof AddLeadFormSchema>;
export type CreateDispositionListFormType = z.infer<typeof CreateDispositionListFormSchema>;
export type CreateLeadListFormType = z.infer<typeof CreateLeadListFormSchema>;
export type CreateOrganizationFormType = z.infer<typeof CreateOrganizationFormSchema>;
export type CreateTeamFormType = z.infer<typeof CreateTeamFormSchema>;
export type ImportLeadsFormType = z.infer<typeof ImportLeadsFormSchema>;
export type InviteUserFormType = z.infer<typeof InviteUserFormSchema>;
export type RenameTeamFormType = z.infer<typeof RenameTeamFormSchema>;
export type SignInFormType = z.infer<typeof SignInFormSchema>;
export type SignUpFormType = z.infer<typeof SignUpFormSchema>;
export type UpdateDispositionListFormType = z.infer<typeof UpdateDispositionListFormSchema>;
export type UpdateLeadListFormType = z.infer<typeof UpdateLeadListFormSchema>;
