// AUTO-GENERATED FILE. DO NOT EDIT.
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
} from "../../schema/auth";

export const AccountModelSchema = createSelectSchema(account);
export const AccountInsertSchema = createInsertSchema(account);
export const AccountUpdateSchema = createUpdateSchema(account);

export const InvitationModelSchema = createSelectSchema(invitation);
export const InvitationInsertSchema = createInsertSchema(invitation);
export const InvitationUpdateSchema = createUpdateSchema(invitation);

export const MemberModelSchema = createSelectSchema(member);
export const MemberInsertSchema = createInsertSchema(member);
export const MemberUpdateSchema = createUpdateSchema(member);

export const OrganizationModelSchema = createSelectSchema(organization);
export const OrganizationInsertSchema = createInsertSchema(organization);
export const OrganizationUpdateSchema = createUpdateSchema(organization);

export const SessionModelSchema = createSelectSchema(session);
export const SessionInsertSchema = createInsertSchema(session);
export const SessionUpdateSchema = createUpdateSchema(session);

export const UserModelSchema = createSelectSchema(user);
export const UserInsertSchema = createInsertSchema(user);
export const UserUpdateSchema = createUpdateSchema(user);

export const VerificationModelSchema = createSelectSchema(verification);
export const VerificationInsertSchema = createInsertSchema(verification);
export const VerificationUpdateSchema = createUpdateSchema(verification);
