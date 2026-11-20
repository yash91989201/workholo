import z from "zod";

export const InviteUserFormSchema = z
  .object({
    email: z.email("Enter a valid email"),
    role: z.enum(["admin", "agent"]),
    teamId: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "agent" && value.teamId.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Agent invitations need a team",
        path: ["teamId"],
      });
    }
  });
