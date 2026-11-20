// AUTO-GENERATED FILE. DO NOT EDIT.
import type { z } from "zod";
import type {
  ListCallsInputSchema,
  ListCallsOutputSchema,
  ListRecordingsInputSchema,
  ListRecordingsOutputSchema,
} from "./schemas/calls";
import type {
  AddDispositionEntryInputSchema,
  AddDispositionEntryOutputSchema,
  ArchiveDispositionListInputSchema,
  ArchiveDispositionListOutputSchema,
  CreateDispositionListInputSchema,
  CreateDispositionListOutputSchema,
  GetDispositionEntryInputSchema,
  GetDispositionEntryOutputSchema,
  GetDispositionListInputSchema,
  GetDispositionListOutputSchema,
  ListActiveDispositionEntriesInputSchema,
  ListActiveDispositionEntriesOutputSchema,
  ListActiveDispositionListsInputSchema,
  ListActiveDispositionListsOutputSchema,
  ListDispositionListsInputSchema,
  ListDispositionListsOutputSchema,
  RetireDispositionEntryInputSchema,
  RetireDispositionEntryOutputSchema,
  UpdateDispositionListInputSchema,
  UpdateDispositionListOutputSchema,
} from "./schemas/dispositions";
import type {
  CheckHealthOutputSchema,
  GetPrivateDataOutputSchema,
} from "./schemas/index";
import type {
  AddLeadInputSchema,
  AddLeadOutputSchema,
  ArchiveLeadListInputSchema,
  ArchiveLeadListOutputSchema,
  CreateLeadListInputSchema,
  CreateLeadListOutputSchema,
  GetLeadListInputSchema,
  GetLeadListOutputSchema,
  ImportLeadsInputSchema,
  ImportLeadsOutputSchema,
  ListActiveLeadListsInputSchema,
  ListActiveLeadListsOutputSchema,
  ListActiveLeadsInputSchema,
  ListActiveLeadsOutputSchema,
  ListLeadListsInputSchema,
  ListLeadListsOutputSchema,
  RemoveLeadInputSchema,
  RemoveLeadOutputSchema,
  UpdateLeadListInputSchema,
  UpdateLeadListOutputSchema,
} from "./schemas/leads";
import type {
  AssignOutboundNumberInputSchema,
  AssignOutboundNumberOutputSchema,
  ListEligibleOutboundNumbersInputSchema,
  ListEligibleOutboundNumbersOutputSchema,
  ListOutboundNumbersOutputSchema,
  RegisterOutboundNumberInputSchema,
  RegisterOutboundNumberOutputSchema,
  SetOutboundNumberEnabledInputSchema,
  SetOutboundNumberEnabledOutputSchema,
  UnassignOutboundNumberInputSchema,
  UnassignOutboundNumberOutputSchema,
} from "./schemas/numbers";
import type {
  GetMeOutputSchema,
  ListDirectoryInputSchema,
  ListDirectoryOutputSchema,
  ListInvitationsInputSchema,
  ListInvitationsOutputSchema,
  ListTeamMembersInputSchema,
  ListTeamMembersOutputSchema,
  ListTeamsInputSchema,
  ListTeamsOutputSchema,
} from "./schemas/organization";
import type {
  DeleteOrganizationInputSchema,
  DeleteOrganizationOutputSchema,
  ListOrganizationsInputSchema,
  ListOrganizationsOutputSchema,
  RestoreOrganizationInputSchema,
  RestoreOrganizationOutputSchema,
  SuspendOrganizationInputSchema,
  SuspendOrganizationOutputSchema,
} from "./schemas/platform";
import type { SessionUserSchema } from "./schemas/shared";

export type AddDispositionEntryInputType = z.infer<typeof AddDispositionEntryInputSchema>;
export type AddDispositionEntryOutputType = z.infer<typeof AddDispositionEntryOutputSchema>;
export type AddLeadInputType = z.infer<typeof AddLeadInputSchema>;
export type AddLeadOutputType = z.infer<typeof AddLeadOutputSchema>;
export type ArchiveDispositionListInputType = z.infer<typeof ArchiveDispositionListInputSchema>;
export type ArchiveDispositionListOutputType = z.infer<typeof ArchiveDispositionListOutputSchema>;
export type ArchiveLeadListInputType = z.infer<typeof ArchiveLeadListInputSchema>;
export type ArchiveLeadListOutputType = z.infer<typeof ArchiveLeadListOutputSchema>;
export type AssignOutboundNumberInputType = z.infer<typeof AssignOutboundNumberInputSchema>;
export type AssignOutboundNumberOutputType = z.infer<typeof AssignOutboundNumberOutputSchema>;
export type CheckHealthOutputType = z.infer<typeof CheckHealthOutputSchema>;
export type CreateDispositionListInputType = z.infer<typeof CreateDispositionListInputSchema>;
export type CreateDispositionListOutputType = z.infer<typeof CreateDispositionListOutputSchema>;
export type CreateLeadListInputType = z.infer<typeof CreateLeadListInputSchema>;
export type CreateLeadListOutputType = z.infer<typeof CreateLeadListOutputSchema>;
export type DeleteOrganizationInputType = z.infer<typeof DeleteOrganizationInputSchema>;
export type DeleteOrganizationOutputType = z.infer<typeof DeleteOrganizationOutputSchema>;
export type GetDispositionEntryInputType = z.infer<typeof GetDispositionEntryInputSchema>;
export type GetDispositionEntryOutputType = z.infer<typeof GetDispositionEntryOutputSchema>;
export type GetDispositionListInputType = z.infer<typeof GetDispositionListInputSchema>;
export type GetDispositionListOutputType = z.infer<typeof GetDispositionListOutputSchema>;
export type GetLeadListInputType = z.infer<typeof GetLeadListInputSchema>;
export type GetLeadListOutputType = z.infer<typeof GetLeadListOutputSchema>;
export type GetMeOutputType = z.infer<typeof GetMeOutputSchema>;
export type GetPrivateDataOutputType = z.infer<typeof GetPrivateDataOutputSchema>;
export type ImportLeadsInputType = z.infer<typeof ImportLeadsInputSchema>;
export type ImportLeadsOutputType = z.infer<typeof ImportLeadsOutputSchema>;
export type ListActiveDispositionEntriesInputType = z.infer<typeof ListActiveDispositionEntriesInputSchema>;
export type ListActiveDispositionEntriesOutputType = z.infer<typeof ListActiveDispositionEntriesOutputSchema>;
export type ListActiveDispositionListsInputType = z.infer<typeof ListActiveDispositionListsInputSchema>;
export type ListActiveDispositionListsOutputType = z.infer<typeof ListActiveDispositionListsOutputSchema>;
export type ListActiveLeadListsInputType = z.infer<typeof ListActiveLeadListsInputSchema>;
export type ListActiveLeadListsOutputType = z.infer<typeof ListActiveLeadListsOutputSchema>;
export type ListActiveLeadsInputType = z.infer<typeof ListActiveLeadsInputSchema>;
export type ListActiveLeadsOutputType = z.infer<typeof ListActiveLeadsOutputSchema>;
export type ListCallsInputType = z.infer<typeof ListCallsInputSchema>;
export type ListCallsOutputType = z.infer<typeof ListCallsOutputSchema>;
export type ListDirectoryInputType = z.infer<typeof ListDirectoryInputSchema>;
export type ListDirectoryOutputType = z.infer<typeof ListDirectoryOutputSchema>;
export type ListDispositionListsInputType = z.infer<typeof ListDispositionListsInputSchema>;
export type ListDispositionListsOutputType = z.infer<typeof ListDispositionListsOutputSchema>;
export type ListEligibleOutboundNumbersInputType = z.infer<typeof ListEligibleOutboundNumbersInputSchema>;
export type ListEligibleOutboundNumbersOutputType = z.infer<typeof ListEligibleOutboundNumbersOutputSchema>;
export type ListInvitationsInputType = z.infer<typeof ListInvitationsInputSchema>;
export type ListInvitationsOutputType = z.infer<typeof ListInvitationsOutputSchema>;
export type ListLeadListsInputType = z.infer<typeof ListLeadListsInputSchema>;
export type ListLeadListsOutputType = z.infer<typeof ListLeadListsOutputSchema>;
export type ListOrganizationsInputType = z.infer<typeof ListOrganizationsInputSchema>;
export type ListOrganizationsOutputType = z.infer<typeof ListOrganizationsOutputSchema>;
export type ListOutboundNumbersOutputType = z.infer<typeof ListOutboundNumbersOutputSchema>;
export type ListRecordingsInputType = z.infer<typeof ListRecordingsInputSchema>;
export type ListRecordingsOutputType = z.infer<typeof ListRecordingsOutputSchema>;
export type ListTeamMembersInputType = z.infer<typeof ListTeamMembersInputSchema>;
export type ListTeamMembersOutputType = z.infer<typeof ListTeamMembersOutputSchema>;
export type ListTeamsInputType = z.infer<typeof ListTeamsInputSchema>;
export type ListTeamsOutputType = z.infer<typeof ListTeamsOutputSchema>;
export type RegisterOutboundNumberInputType = z.infer<typeof RegisterOutboundNumberInputSchema>;
export type RegisterOutboundNumberOutputType = z.infer<typeof RegisterOutboundNumberOutputSchema>;
export type RemoveLeadInputType = z.infer<typeof RemoveLeadInputSchema>;
export type RemoveLeadOutputType = z.infer<typeof RemoveLeadOutputSchema>;
export type RestoreOrganizationInputType = z.infer<typeof RestoreOrganizationInputSchema>;
export type RestoreOrganizationOutputType = z.infer<typeof RestoreOrganizationOutputSchema>;
export type RetireDispositionEntryInputType = z.infer<typeof RetireDispositionEntryInputSchema>;
export type RetireDispositionEntryOutputType = z.infer<typeof RetireDispositionEntryOutputSchema>;
export type SessionUserType = z.infer<typeof SessionUserSchema>;
export type SetOutboundNumberEnabledInputType = z.infer<typeof SetOutboundNumberEnabledInputSchema>;
export type SetOutboundNumberEnabledOutputType = z.infer<typeof SetOutboundNumberEnabledOutputSchema>;
export type SuspendOrganizationInputType = z.infer<typeof SuspendOrganizationInputSchema>;
export type SuspendOrganizationOutputType = z.infer<typeof SuspendOrganizationOutputSchema>;
export type UnassignOutboundNumberInputType = z.infer<typeof UnassignOutboundNumberInputSchema>;
export type UnassignOutboundNumberOutputType = z.infer<typeof UnassignOutboundNumberOutputSchema>;
export type UpdateDispositionListInputType = z.infer<typeof UpdateDispositionListInputSchema>;
export type UpdateDispositionListOutputType = z.infer<typeof UpdateDispositionListOutputSchema>;
export type UpdateLeadListInputType = z.infer<typeof UpdateLeadListInputSchema>;
export type UpdateLeadListOutputType = z.infer<typeof UpdateLeadListOutputSchema>;
