import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Organization access control. `defaultStatements` covers organization, member,
 * invitation, team, and ac; call/recording are added for telephony surfaces.
 */
const statement = {
  ...defaultStatements,
  call: ["read", "monitor", "whisper", "barge"],
  recording: ["read"],
} as const;

export const ac = createAccessControl(statement);

/** Owner: organization settings plus people management. No live supervision. */
export const owner = ac.newRole({
  ...defaultStatements,
  call: ["read"],
  recording: ["read"],
});

/** Admin: people management and live supervision, but no organization settings. */
export const admin = ac.newRole({
  organization: [],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  team: [],
  ac: ["read"],
  call: ["read", "monitor", "whisper", "barge"],
  recording: ["read"],
});

/** Agent: own call and recording reads only. */
export const agent = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  call: ["read"],
  recording: ["read"],
});

export const organizationRoles = { owner, admin, agent };
