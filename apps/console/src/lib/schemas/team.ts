import z from "zod";

export const CreateTeamFormSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
});

export const RenameTeamFormSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
});
