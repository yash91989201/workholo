import z from "zod";

import { SessionUserSchema } from "./shared";

const organizationIdShape = { organizationId: z.string() };

const membershipSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  suspendedAt: z.date().nullable(),
  role: z.string(),
});

export const GetMeOutputSchema = z.object({
  user: SessionUserSchema.optional(),
  membership: membershipSchema.nullable(),
});

export const ListDirectoryInputSchema = z.object(organizationIdShape);
export const ListDirectoryOutputSchema = z.array(
  z.object({
    id: z.string(),
    userId: z.string(),
    role: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.date(),
    teams: z.array(z.string()),
  })
);

export const ListInvitationsInputSchema = z.object(organizationIdShape);
export const ListInvitationsOutputSchema = z.array(
  z.object({
    id: z.string(),
    email: z.string(),
    role: z.string().nullable(),
    expiresAt: z.date(),
    createdAt: z.date(),
    teamName: z.string().nullable(),
    inviteUrl: z.string(),
  })
);

export const ListTeamsInputSchema = z.object(organizationIdShape);
export const ListTeamsOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    memberCount: z.number(),
    createdAt: z.date(),
  })
);

export const ListTeamMembersInputSchema = z.object({
  ...organizationIdShape,
  teamId: z.string(),
});
export const ListTeamMembersOutputSchema = z.array(
  z.object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.date(),
  })
);
