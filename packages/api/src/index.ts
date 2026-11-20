import {
  requireOrg,
  requirePlatformAdmin,
  requireRoles,
  requireUser,
} from "./utils/middleware";
import { o } from "./utils/orpc";

export {
  requireOrg,
  requirePlatformAdmin,
  requireRoles,
  requireUser,
} from "./utils/middleware";
export { o } from "./utils/orpc";

export const publicProcedure = o;

/** Session is guaranteed from here on; kept concrete for downstream middleware. */
export const protectedProcedure = publicProcedure.use(requireUser);

export const platformProcedure = protectedProcedure.use(requirePlatformAdmin);

export const orgProcedure = publicProcedure.use(requireUser).use(requireOrg);

/** Console endpoints: owner or admin membership. */
export const consoleProcedure = orgProcedure.use(
  requireRoles(["owner", "admin"])
);
