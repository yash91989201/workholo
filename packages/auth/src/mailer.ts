export type InvitationEmail = {
  invitationId: string;
  email: string;
  role: string;
  organizationName: string;
  url: string;
};

/**
 * Invitation delivery boundary. The provider is not chosen yet; the interface
 * keeps role-based URL routing testable without one.
 */
export type InvitationMailer = {
  sendInvitation(email: InvitationEmail): Promise<void>;
};

export const noopInvitationMailer: InvitationMailer = {
  sendInvitation: () => Promise.resolve(),
};
