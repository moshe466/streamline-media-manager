
import { getSystemCredentials, saveSystemCredentials } from "@/services/users";
import { logEvent } from "@/services/logger";
import { getDb } from "@/lib/firebase-admin";
import * as crypto from "crypto";
import { createCodeVerifier, createCodeChallengeS256 } from "@/lib/pkce";
import { getRedirectUri } from "@/services/social.config";
import { loadPkceVerifier } from "@/services/twitter-server-auth";

const usedAuthCodes = new Set<string>();

async function getTwitterClientConfig() {
  const credentials = await getSystemCredentials();
  const clientId = credentials.twitterClientId;
  if (!clientId) {
    throw new Error("Twitter Client ID is not configured in settings.");
  }
  return { clientId };
}

export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<{ success: boolean; error?: string }> {
  if (usedAuthCodes.has(code)) {
    const errorMessage =
      "Authorization code has already been used. Please try authenticating again.";
    await logEvent("TWITTER_AUTH_FAILURE", errorMessage);
    return { success: false, error: errorMessage };
  }

  try {
    const { clientId } = await getTwitterClientConfig();
    const codeVerifier = await loadPkceVerifier(state);

    if (!codeVerifier) {
      throw new Error(
        "Invalid or expired state parameter. Please try the authentication process again."
      );
    }

    usedAuthCodes.add(code);
    setTimeout(() => usedAuthCodes.delete(code), 5 * 60 * 1000);

    const params = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    });

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });

    const tokenData = await response.json();

    if (!response.ok) {
      console.error("Twitter API Error during token exchange:", tokenData);
      const errorDescription =
        tokenData.error_description ||
        tokenData.error ||
        "Failed to exchange code for Twitter token.";
      throw new Error(errorDescription);
    }

    await saveSystemCredentials({
      twitterAccessToken: tokenData.access_token,
      twitterRefreshToken: tokenData.refresh_token,
    });

    await logEvent(
      "TWITTER_AUTH_SUCCESS",
      "Successfully exchanged code for Twitter API token."
    );
    return { success: true };
  } catch (error) {
    console.error("Error exchanging code for Twitter token:", error);
    await logEvent(
      "TWITTER_AUTH_FAILURE",
      `Failed to exchange code for token. Error: ${(error as Error).message}`
    );
    return { success: false, error: (error as Error).message };
  }
}

export async function refreshAccessToken(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { clientId } = await getTwitterClientConfig();
    const credentials = await getSystemCredentials();
    const refreshToken = credentials.twitterRefreshToken;

    if (!refreshToken) {
      throw new Error("No refresh token available to renew Twitter access.");
    }

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: clientId,
    });

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await response.json();

    if (!response.ok) {
      console.error("Twitter token refresh failed:", tokenData);
      throw new Error(tokenData.error_description || "Failed to refresh token.");
    }

    await saveSystemCredentials({
      twitterAccessToken: tokenData.access_token,
      twitterRefreshToken: tokenData.refresh_token,
    });

    await logEvent(
      "TWITTER_TOKEN_REFRESH",
      "Successfully refreshed Twitter API token."
    );
    return { success: true };
  } catch (error) {
    console.error("Error refreshing Twitter token:", error);
    await logEvent(
      "TWITTER_TOKEN_REFRESH_FAILURE",
      `Failed to refresh token. Error: ${(error as Error).message}`
    );
    return { success: false, error: (error as Error).message };
  }
}
