
import crypto from "crypto";
import { savePkceChallenge } from "@/services/twitter-server-auth";
import { getSystemCredentials } from "@/services/users";
import { createCodeVerifier, createCodeChallengeS256 } from "@/lib/pkce";
import { getRedirectUri } from "@/services/social.config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { twitterClientId: clientId } = await getSystemCredentials();

    if (!clientId) {
      throw new Error("Twitter Client ID is not configured.");
    }

    const scopes = "users.read tweet.read tweet.write offline.access";

    const verifier = createCodeVerifier();
    const challenge = createCodeChallengeS256(verifier);
    const state = crypto.randomUUID();

    await savePkceChallenge(state, verifier);

    if (!challenge || challenge.length < 40) {
      throw new Error("PKCE S256 challenge generation failed");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      scope: scopes,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    console.log("[TWITTER START]", {
      state,
      scopes,
      challenge: challenge.slice(0, 12),
      at: new Date().toISOString(),
    });

    return Response.redirect(authUrl, 302);
  } catch (error) {
    console.error("Error creating Twitter authorization URL:", error);
    return new Response("Failed to start Twitter authentication.", { status: 500 });
  }
}
