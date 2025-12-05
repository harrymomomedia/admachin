// Facebook OAuth Callback - Handles the redirect from Facebook and exchanges tokens
// Endpoint: GET /api/auth/facebook/callback

export const config = {
    runtime: 'edge',
};

interface FacebookTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
}

interface FacebookUserResponse {
    id: string;
    name: string;
}

interface AdAccountResponse {
    data: Array<{
        id: string;
        name: string;
        account_id: string;
        account_status: number;
        currency: string;
        timezone_name: string;
        amount_spent?: string;
        balance?: string;
        business?: { id: string; name: string };
    }>;
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

/**
 * Get user's ad accounts
 */
async function getAdAccounts(accessToken: string): Promise<AdAccountResponse> {
    const url = new URL('https://graph.facebook.com/v21.0/me/adaccounts');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,business{id,name}');

    const response = await fetch(url.toString());
    return response.json() as Promise<AdAccountResponse>;
}

export default async function handler(request: Request) {
    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        console.error('Missing Facebook App ID or Secret');
        return Response.redirect(`${request.url.origin}/ad-accounts?error=${encodeURIComponent('Server configuration error: Missing Facebook App ID or Secret')}`, 302);
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Optional: for CSRF protection

    if (!code) {
        console.error('[FB OAuth] No code received from Facebook');
        return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent('Authentication failed: No code received from Facebook')}`, 302);
    }

    const redirectUri = `${url.origin}/api/auth/facebook/callback`;

    try {
        // Step 1: Exchange authorization code for short-lived access token
        console.log('[FB OAuth] Exchanging code for short-lived token...');
        const shortLivedToken = await exchangeCodeForToken(code, redirectUri, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET);

        // Step 2: Exchange short-lived token for long-lived access token
        console.log('[FB OAuth] Exchanging short-lived token for long-lived token...');
        const { token: longLivedToken, expiresIn } = await getLongLivedToken(
            shortLivedToken,
            FACEBOOK_APP_ID,
            FACEBOOK_APP_SECRET
        );

        // Step 3: Get user info
        console.log('[FB OAuth] Getting user info...');
        const user = await getMe(longLivedToken);

        // Step 4: Get ad accounts
        console.log('[FB OAuth] Getting ad accounts...');
        const adAccounts = await getAdAccounts(longLivedToken);

        // Build the profile data to pass to frontend
        const profileData = {
            id: user.id,
            name: user.name || `Facebook Profile`,
            email: user.email, // Use the email from the user object
            accessToken: longLivedToken,
            tokenExpiry: Date.now() + (expiresIn * 1000), // Convert to timestamp
            adAccounts: adAccounts.data || [],
            connectedAt: Date.now(),
        };

        // Encode the data for passing via URL (will be decoded by frontend)
        const encodedData = encodeURIComponent(JSON.stringify(profileData));

        // Redirect back to app with the profile data
        return Response.redirect(`${url.origin}/ad-accounts?success=true&profile=${encodedData}`, 302);

    } catch (err) {
        console.error('[FB OAuth] Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent(errorMessage)}`, 302);
    }
}
