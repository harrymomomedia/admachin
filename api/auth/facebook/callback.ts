// Facebook OAuth Callback - Handles the redirect from Facebook and exchanges tokens
// Endpoint: GET /api/auth/facebook/callback

// NOTE: Switched to Node.js runtime to support local file system persistence
// In production with KV, this could be switched back to Edge if using @vercel/kv HTTP API
// export const config = {
//     runtime: 'edge',
// };

import { TokenStorage } from '../../services/tokenStorage.js';

interface FacebookTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
}

interface FacebookUserResponse {
    id: string;
    name: string;
    email?: string;
}

/**
 * Exchange authorization code for short-lived access token
 */
async function exchangeCodeForToken(
    code: string,
    redirectUri: string,
    appId: string,
    appSecret: string
): Promise<string> {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code', code);

    const response = await fetch(url.toString());
    const data = await response.json() as FacebookTokenResponse;

    if (!data.access_token) {
        throw new Error('Failed to exchange code for token');
    }

    return data.access_token;
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
async function getLongLivedToken(
    shortLivedToken: string,
    appId: string,
    appSecret: string
): Promise<{ token: string; expiresIn: number }> {
    const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', shortLivedToken);

    const response = await fetch(url.toString());
    const data = await response.json() as FacebookTokenResponse;

    if (!data.access_token) {
        throw new Error('Failed to exchange for long-lived token');
    }

    return {
        token: data.access_token,
        expiresIn: data.expires_in || 5184000, // Default to 60 days in seconds
    };
}

/**
 * Get user info from Facebook
 */
async function getMe(accessToken: string): Promise<FacebookUserResponse> {
    const url = new URL('https://graph.facebook.com/v21.0/me');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,name,email');

    const response = await fetch(url.toString());
    return response.json() as Promise<FacebookUserResponse>;
}

export default async function handler(request: Request) {
    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        console.error('Missing Facebook App ID or Secret');
        const origin = new URL(request.url).origin;
        return Response.redirect(`${origin}/ad-accounts?error=${encodeURIComponent('Server configuration error: Missing Facebook App ID or Secret')}`, 302);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    // Handle user cancellation or errors
    if (error) {
        const errorReason = url.searchParams.get('error_reason') || 'Unknown error';
        return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent(errorReason)}`, 302);
    }

    if (!code) {
        console.error('[FB OAuth] No code received from Facebook');
        return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent('Authentication failed: No code received from Facebook')}`, 302);
    }

    try {
        const origin = url.origin;
        const redirectUri = `${origin}/api/auth/facebook/callback`;

        // Step 1: Exchange code for short-lived token
        console.log('[FB OAuth] Exchanging code for token...');
        const shortLivedToken = await exchangeCodeForToken(code, redirectUri, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET);

        // Step 2: Exchange for long-lived token (60 days!)
        console.log('[FB OAuth] Getting long-lived token...');
        const { token: longLivedToken, expiresIn } = await getLongLivedToken(shortLivedToken, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET);

        // Step 3: Get user info
        console.log('[FB OAuth] Getting user info...');
        const user = await getMe(longLivedToken);

        // Step 4: Persist the session to the Server Store (Auto-Login System)
        console.log(`[FB OAuth] Saving permanent session for user: ${user.name}`);
        const tokenExpiry = Date.now() + (expiresIn * 1000);

        await TokenStorage.save({
            accessToken: longLivedToken,
            tokenExpiry: tokenExpiry,
            userName: user.name,
            userId: user.id,
            connectedAt: Date.now()
        });

        // Redirect back to app - success!
        // The frontend will now call /api/auth/facebook/session and find the token we just saved.
        return Response.redirect(`${url.origin}/ad-accounts?success=true&connected_user=${encodeURIComponent(user.name)}`, 302);

    } catch (err) {
        console.error('[FB OAuth] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent(errorMessage)}`, 302);
    }
}
