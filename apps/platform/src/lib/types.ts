// AUTO-GENERATED FILE. DO NOT EDIT.
import type { z } from "zod";
import type { SignInFormSchema, SignUpFormSchema } from "./schemas/auth";
import type { RegisterOutboundNumberFormSchema } from "./schemas/number";
import type { SuspendOrganizationFormSchema } from "./schemas/organization";
import type { ImpersonateUserFormSchema } from "./schemas/user";

export type ImpersonateUserFormType = z.infer<typeof ImpersonateUserFormSchema>;
export type RegisterOutboundNumberFormType = z.infer<typeof RegisterOutboundNumberFormSchema>;
export type SignInFormType = z.infer<typeof SignInFormSchema>;
export type SignUpFormType = z.infer<typeof SignUpFormSchema>;
export type SuspendOrganizationFormType = z.infer<typeof SuspendOrganizationFormSchema>;
