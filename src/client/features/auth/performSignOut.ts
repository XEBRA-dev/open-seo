import { signOutAndRedirect } from "@/lib/auth-client";
import {
  getAccessLogoutHref,
  isCloudflareAccessClientAuthMode,
} from "@/lib/auth-mode";

/**
 * Ends the session in whichever system actually owns it.
 *
 * Better Auth's signOut is meaningless under Cloudflare Access: Access owns the
 * cookie, so clearing Better Auth's leaves the user signed in and bounces them
 * straight back through the Access gate. Access has to be signed out through
 * its own logout endpoint instead.
 *
 * Shared by the sidebar account menu and the Settings page so the two cannot
 * drift apart.
 */
export function performSignOut(): void {
  if (isCloudflareAccessClientAuthMode()) {
    window.location.assign(getAccessLogoutHref(window.location.origin));
    return;
  }

  signOutAndRedirect();
}
