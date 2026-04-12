

// This file defines configuration values for social media integrations.
// It does NOT use "use server".

/**
 * Returns the standard redirect URI for all OAuth 2.0 authentication flows.
 * This URI must be registered in the developer console of each respective platform (Google, Facebook, TikTok, etc.).
 * @returns The production redirect URI.
 */
export function getRedirectUri(): string {
  // We are standardizing on a single, production-ready redirect URI
  // to prevent mismatches between different environments.
  return "https://app.mizrachitv.co.il/auth/callback";
}
