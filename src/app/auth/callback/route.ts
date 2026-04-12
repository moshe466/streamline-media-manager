

import type { NextRequest } from 'next/server';
import { exchangeCodeForToken as exchangeYouTubeCode, exchangeGoogleCodeForProfile } from '@/services/youtube';
import { exchangeCodeForToken as exchangeFacebookCode } from '@/services/facebook';
import { exchangeCodeForToken as exchangeTikTokCode } from '@/services/tiktok';
import { exchangeCodeForToken as exchangeTwitterCode } from '@/services/twitter';
import { unstable_noStore as noStore } from 'next/cache';
import { getRedirectUri } from '@/services/social.config';


export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function getErrorResponse(error: string) {
    const html = `
      <script>
        window.opener?.postMessage({ type: 'auth-error', error: '${error}' }, window.location.origin);
        window.close();
      </script>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' }, status: 400 });
}

function getSuccessResponse(type: string) {
     const html = `
          <script>
            window.opener?.postMessage({ type: '${type}-success' }, window.location.origin);
            window.close();
          </script>
      `;
    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}


export async function GET(req: NextRequest) {
  noStore();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const redirectUri = getRedirectUri();

  if (errorParam) {
    console.error(`OAuth Error from provider: ${errorParam}`);
    return getErrorResponse(errorParam);
  }

  if (!code || !state) {
    return getErrorResponse("Missing required parameters: code or state.");
  }
  
  try {
      let result: { success: boolean; error?: string };
      const authState = state.split(':')[0];
      const userId = state.split(':')[1];

      switch (authState) {
        case 'youtube_auth':
          result = await exchangeYouTubeCode(code, redirectUri, userId);
          break;
        case 'facebook_auth':
        case 'instagram_auth':
          result = await exchangeFacebookCode(code, redirectUri, userId);
          break;
        case 'tiktok_auth':
           result = await exchangeTikTokCode(code, state);
           break;
        case 'twitter_auth':
           result = await exchangeTwitterCode(code, state);
          break;
        case 'google-questionnaire-auth':
            const googleAuthHtml = `
                <script>
                  window.opener?.postMessage({ type: 'google-questionnaire-auth', code: '${code}', state: '${state}' }, window.location.origin);
                  window.close();
                </script>
              `;
            return new Response(googleAuthHtml, { headers: { 'Content-Type': 'text/html' } });
        default:
          throw new Error(`Invalid state for authentication provider: ${authState}`);
      }
      
      if (!result.success) {
          throw new Error(result.error || 'Authentication token exchange failed.');
      }
      
      return getSuccessResponse(authState);

  } catch (e) {
      console.error(`Error during token exchange:`, e);
      return getErrorResponse((e as Error).message);
  }
}
