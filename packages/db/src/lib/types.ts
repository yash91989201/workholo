// AUTO-GENERATED FILE. DO NOT EDIT.
import type { z } from "zod";
import type {
  AccountInsertSchema,
  AccountModelSchema,
  AccountUpdateSchema,
  InvitationInsertSchema,
  InvitationModelSchema,
  InvitationUpdateSchema,
  MemberInsertSchema,
  MemberModelSchema,
  MemberUpdateSchema,
  OrganizationInsertSchema,
  OrganizationModelSchema,
  OrganizationUpdateSchema,
  SessionInsertSchema,
  SessionModelSchema,
  SessionUpdateSchema,
  TeamInsertSchema,
  TeamMemberInsertSchema,
  TeamMemberModelSchema,
  TeamMemberUpdateSchema,
  TeamModelSchema,
  TeamUpdateSchema,
  UserInsertSchema,
  UserModelSchema,
  UserUpdateSchema,
  VerificationInsertSchema,
  VerificationModelSchema,
  VerificationUpdateSchema,
} from "./models/auth";
import type {
  CallInsertSchema,
  CallModelSchema,
  CallUpdateSchema,
  RecordingInsertSchema,
  RecordingModelSchema,
  RecordingUpdateSchema,
} from "./models/calls";
import type {
  CampaignInsertSchema,
  CampaignLeadListInsertSchema,
  CampaignLeadListModelSchema,
  CampaignLeadListUpdateSchema,
  CampaignModelSchema,
  CampaignNumberInsertSchema,
  CampaignNumberModelSchema,
  CampaignNumberUpdateSchema,
  CampaignUpdateSchema,
} from "./models/campaigns";
import type {
  DispositionEntryInsertSchema,
  DispositionEntryModelSchema,
  DispositionEntryUpdateSchema,
  DispositionListInsertSchema,
  DispositionListModelSchema,
  DispositionListUpdateSchema,
} from "./models/dispositions";
import type {
  DoNotDialEntryInsertSchema,
  DoNotDialEntryModelSchema,
  DoNotDialEntryUpdateSchema,
} from "./models/do-not-dial";
import type {
  LeadInsertSchema,
  LeadListInsertSchema,
  LeadListModelSchema,
  LeadListUpdateSchema,
  LeadModelSchema,
  LeadUpdateSchema,
} from "./models/leads";
import type {
  OutboundNumberAssignmentInsertSchema,
  OutboundNumberAssignmentModelSchema,
  OutboundNumberAssignmentUpdateSchema,
  OutboundNumberInsertSchema,
  OutboundNumberModelSchema,
  OutboundNumberUpdateSchema,
} from "./models/numbers";

export type AccountInsertType = z.infer<typeof AccountInsertSchema>;
export type AccountModelType = z.infer<typeof AccountModelSchema>;
export type AccountUpdateType = z.infer<typeof AccountUpdateSchema>;
export type CallInsertType = z.infer<typeof CallInsertSchema>;
export type CallModelType = z.infer<typeof CallModelSchema>;
export type CallUpdateType = z.infer<typeof CallUpdateSchema>;
export type CampaignInsertType = z.infer<typeof CampaignInsertSchema>;
export type CampaignLeadListInsertType = z.infer<typeof CampaignLeadListInsertSchema>;
export type CampaignLeadListModelType = z.infer<typeof CampaignLeadListModelSchema>;
export type CampaignLeadListUpdateType = z.infer<typeof CampaignLeadListUpdateSchema>;
export type CampaignModelType = z.infer<typeof CampaignModelSchema>;
export type CampaignNumberInsertType = z.infer<typeof CampaignNumberInsertSchema>;
export type CampaignNumberModelType = z.infer<typeof CampaignNumberModelSchema>;
export type CampaignNumberUpdateType = z.infer<typeof CampaignNumberUpdateSchema>;
export type CampaignUpdateType = z.infer<typeof CampaignUpdateSchema>;
export type DispositionEntryInsertType = z.infer<typeof DispositionEntryInsertSchema>;
export type DispositionEntryModelType = z.infer<typeof DispositionEntryModelSchema>;
export type DispositionEntryUpdateType = z.infer<typeof DispositionEntryUpdateSchema>;
export type DispositionListInsertType = z.infer<typeof DispositionListInsertSchema>;
export type DispositionListModelType = z.infer<typeof DispositionListModelSchema>;
export type DispositionListUpdateType = z.infer<typeof DispositionListUpdateSchema>;
export type DoNotDialEntryInsertType = z.infer<typeof DoNotDialEntryInsertSchema>;
export type DoNotDialEntryModelType = z.infer<typeof DoNotDialEntryModelSchema>;
export type DoNotDialEntryUpdateType = z.infer<typeof DoNotDialEntryUpdateSchema>;
export type InvitationInsertType = z.infer<typeof InvitationInsertSchema>;
export type InvitationModelType = z.infer<typeof InvitationModelSchema>;
export type InvitationUpdateType = z.infer<typeof InvitationUpdateSchema>;
export type LeadInsertType = z.infer<typeof LeadInsertSchema>;
export type LeadListInsertType = z.infer<typeof LeadListInsertSchema>;
export type LeadListModelType = z.infer<typeof LeadListModelSchema>;
export type LeadListUpdateType = z.infer<typeof LeadListUpdateSchema>;
export type LeadModelType = z.infer<typeof LeadModelSchema>;
export type LeadUpdateType = z.infer<typeof LeadUpdateSchema>;
export type MemberInsertType = z.infer<typeof MemberInsertSchema>;
export type MemberModelType = z.infer<typeof MemberModelSchema>;
export type MemberUpdateType = z.infer<typeof MemberUpdateSchema>;
export type OrganizationInsertType = z.infer<typeof OrganizationInsertSchema>;
export type OrganizationModelType = z.infer<typeof OrganizationModelSchema>;
export type OrganizationUpdateType = z.infer<typeof OrganizationUpdateSchema>;
export type OutboundNumberAssignmentInsertType = z.infer<typeof OutboundNumberAssignmentInsertSchema>;
export type OutboundNumberAssignmentModelType = z.infer<typeof OutboundNumberAssignmentModelSchema>;
export type OutboundNumberAssignmentUpdateType = z.infer<typeof OutboundNumberAssignmentUpdateSchema>;
export type OutboundNumberInsertType = z.infer<typeof OutboundNumberInsertSchema>;
export type OutboundNumberModelType = z.infer<typeof OutboundNumberModelSchema>;
export type OutboundNumberUpdateType = z.infer<typeof OutboundNumberUpdateSchema>;
export type RecordingInsertType = z.infer<typeof RecordingInsertSchema>;
export type RecordingModelType = z.infer<typeof RecordingModelSchema>;
export type RecordingUpdateType = z.infer<typeof RecordingUpdateSchema>;
export type SessionInsertType = z.infer<typeof SessionInsertSchema>;
export type SessionModelType = z.infer<typeof SessionModelSchema>;
export type SessionUpdateType = z.infer<typeof SessionUpdateSchema>;
export type TeamInsertType = z.infer<typeof TeamInsertSchema>;
export type TeamMemberInsertType = z.infer<typeof TeamMemberInsertSchema>;
export type TeamMemberModelType = z.infer<typeof TeamMemberModelSchema>;
export type TeamMemberUpdateType = z.infer<typeof TeamMemberUpdateSchema>;
export type TeamModelType = z.infer<typeof TeamModelSchema>;
export type TeamUpdateType = z.infer<typeof TeamUpdateSchema>;
export type UserInsertType = z.infer<typeof UserInsertSchema>;
export type UserModelType = z.infer<typeof UserModelSchema>;
export type UserUpdateType = z.infer<typeof UserUpdateSchema>;
export type VerificationInsertType = z.infer<typeof VerificationInsertSchema>;
export type VerificationModelType = z.infer<typeof VerificationModelSchema>;
export type VerificationUpdateType = z.infer<typeof VerificationUpdateSchema>;
