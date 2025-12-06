// Facebook OAuth Callback - ZERO IMPORTS VERSION
// All code inlined to avoid import issues

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
        expiresIn: data.expires_in || 5184000,
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

    if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json() as Promise<FacebookUserResponse>;
}

/**
 * Save to Redis - INLINED
 */
async function saveToRedis(session: any): Promise<void> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    console.log('[Save] Redis URL exists:', !!url);
    console.log('[Save] Redis Token exists:', !!token);

    if (!url || !token) {
        console.error('[Save] Redis not configured');
        return;
    }

    try {
        // Use Upstash REST API directly
        const response = await fetch(`${url}/set/momomedia_team_session`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(session)
        });

        if (!response.ok) {
            throw new Error(`Redis save failed: ${response.statusText}`);
        }

        console.log('[Save] Session saved to Redis');
    } catch (err) {
        console.error('[Save] Redis error:', err);
    }
}

export default async function handler(request: any) {
    console.log('[FB Callback] === CALLBACK STARTED ===');

    // Construct absolute URL from request
    // Vercel passes headers as plain object, not Headers API
    const headers = request.headers || {};
    const protocol = headers['x-forwarded-proto'] || 'https';
    const host = headers['x-forwarded-host'] || headers['host'] || 'admachin-momomedia.vercel.app';
    const requestUrl = request.url.startsWith('http') ? request.url : `${protocol}://${host}${request.url}`;

    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        console.error('[FB Callback] Missing Facebook App ID or Secret');
        const origin = new URL(requestUrl).origin;
        return new Response(null, {
            status: 302,
            headers: { 'Location': `${origin}/ad-accounts?error=${encodeURIComponent('Server configuration error')}` }
        });
    }

    const url = new URL(requestUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    // Handle user cancellation or errors
    if (error) {
        console.log('[FB Callback] User cancelled or error:', error);
        const errorReason = url.searchParams.get('error_reason') || 'Authentication cancelled';
        return new Response(null, {
            status: 302,
            headers: { 'Location': `${url.origin}/ad-accounts?error=${encodeURIComponent(errorReason)}` }
        });
    }

    if (!code) {
        console.error('[FB Callback] No authorization code received');
        return new Response(null, {
            status: 302,
            headers: { 'Location': `${url.origin}/ad-accounts?error=${encodeURIComponent('No authorization code received')}` }
        });
    }

    try {
        const origin = url.origin;
        const redirectUri = `${origin}/api/auth/facebook/callback`;

        console.log('[FB Callback] Step 1: Exchanging code for token...');
        const shortLivedToken = await exchangeCodeForToken(code, redirectUri, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET);
        console.log('[FB Callback] ✓ Got short-lived token');

        console.log('[FB Callback] Step 2: Getting long-lived token...');
        const { token: longLivedToken, expiresIn } = await getLongLivedToken(shortLivedToken, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET);
        console.log('[FB Callback] ✓ Got long-lived token, expires in:', expiresIn, 'seconds');

        console.log('[FB Callback] Step 3: Getting user info...');
        const user = await getMe(longLivedToken);
        console.log('[FB Callback] ✓ Got user info:', user.name, user.id);

        console.log('[FB Callback] Step 4: Saving session...');
        const tokenExpiry = Date.now() + (expiresIn * 1000);

        // TEMPORARILY DISABLED - Testing if Redis is causing timeout
        // saveToRedis({
        //     accessToken: longLivedToken,
        //     tokenExpiry: tokenExpiry,
        //     userName: user.name,
        //     userId: user.id,
        //     connectedAt: Date.now()
        // }).catch(err => console.error('[FB Callback] Redis save failed:', err));

        console.log('[FB Callback] Skipping Redis for now - testing redirect');
        console.log('[FB Callback] Token:', longLivedToken.substring(0, 20) + '...');
        console.log('[FB Callback] User:', user.name, user.id);

        console.log('[FB Callback] SUCCESS! Redirecting to app...');
        const redirectUrl = `${url.origin}/ad-accounts?success=true&connected_user=${encodeURIComponent(user.name)}`;
        console.log('[FB Callback] Redirect URL:', redirectUrl);

        // Manual redirect for Vercel Node.js runtime
        return new Response(null, {
            status: 302,
            headers: {
                'Location': redirectUrl
            }
        });

    } catch (err) {
        console.error('[FB Callback] ERROR:', err);
        console.error('[FB Callback] Stack:', err instanceof Error ? err.stack : 'No stack');
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        const origin = new URL(requestUrl).origin;
        return new Response(null, {
            status: 302,
            headers: { 'Location': `${origin}/ad-accounts?error=${encodeURIComponent(errorMessage)}` }
        });
    }
}
