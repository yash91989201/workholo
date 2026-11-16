/** Keep post-login redirects on this origin; reject protocol-relative and absolute URLs. */
export function safeRedirect(
  href: string | undefined,
  fallback = "/dashboard"
) {
  if (!href?.startsWith("/") || href.startsWith("//")) {
    return fallback;
  }
  return href;
}
