import { z } from "zod";

export const AUTH_MODES = [
  "cloudflare_access",
  "local_noauth",
  "hosted",
] as const;

type AuthMode = (typeof AUTH_MODES)[number];

const authModeSchema = z.enum(AUTH_MODES);

const warnedInvalidAuthModes = new Set<string>();

export function getAuthMode(value: string | null | undefined): AuthMode {
  const parsed = authModeSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  // Unset stays a silent fail-closed default; a SET-but-invalid value is a
  // typo the operator needs to hear about — silently coercing it made every
  // request fail with a Cloudflare Access error about a mode they never chose.
  if (value && !warnedInvalidAuthModes.has(value)) {
    warnedInvalidAuthModes.add(value);
    console.error(
      `Invalid AUTH_MODE "${value}" — falling back to "cloudflare_access". Valid values: ${AUTH_MODES.join(", ")}.`,
    );
  }

  return "cloudflare_access";
}

export function isHostedAuthMode(value: string | null | undefined) {
  return getAuthMode(value) === "hosted";
}

export function isHostedClientAuthMode() {
  // This is an explicit deploy-time contract: the operator must keep the
  // client build-time AUTH_MODE aligned with the server runtime AUTH_MODE.
  // We accept that tradeoff to avoid a startup round-trip just to ask the
  // backend which auth UI to render. Hosted deployments must therefore set
  // AUTH_MODE=hosted in both the client build environment and the runtime.
  return isHostedAuthMode(import.meta.env.AUTH_MODE);
}

export function isCloudflareAccessClientAuthMode() {
  // Same deploy-time contract as isHostedClientAuthMode. Unset fails closed to
  // cloudflare_access, which is what a self-host deploy leaves it as.
  return getAuthMode(import.meta.env.AUTH_MODE) === "cloudflare_access";
}

/**
 * Cloudflare Access owns the session in this mode, so signing out means
 * clearing its cookie, not Better Auth's. `returnTo` sends the browser back to
 * the app afterwards, which re-triggers the Access login; without it Access
 * renders its own bare "logged out" error page.
 */
export function getAccessLogoutHref(origin: string) {
  return `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(`${origin}/`)}`;
}

export function isEmailVerificationBypassed() {
  // Local-dev escape hatch (BYPASS_EMAIL_VERIFICATION=true). The server skips
  // verification and never marks users emailVerified, so the client must treat
  // the session as verified too — otherwise route guards and /verify-email
  // bounce each other in an infinite redirect loop.
  return import.meta.env.BYPASS_EMAIL_VERIFICATION === "true";
}
