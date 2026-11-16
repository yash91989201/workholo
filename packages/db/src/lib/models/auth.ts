// AUTO-GENERATED FILE. DO NOT EDIT.
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { account, session, user, verification } from "../../schema/auth";

export const AccountModelSchema = createSelectSchema(account);
export const AccountInsertSchema = createInsertSchema(account);
export const AccountUpdateSchema = createUpdateSchema(account);

export const SessionModelSchema = createSelectSchema(session);
export const SessionInsertSchema = createInsertSchema(session);
export const SessionUpdateSchema = createUpdateSchema(session);

export const UserModelSchema = createSelectSchema(user);
export const UserInsertSchema = createInsertSchema(user);
export const UserUpdateSchema = createUpdateSchema(user);

export const VerificationModelSchema = createSelectSchema(verification);
export const VerificationInsertSchema = createInsertSchema(verification);
export const VerificationUpdateSchema = createUpdateSchema(verification);
