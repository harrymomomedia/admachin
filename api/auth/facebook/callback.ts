// Facebook OAuth Callback - Using Vercel Node.js API format
// Fetches ad accounts and returns complete profile data

import type { VercelRequest, VercelResponse } from '@vercel/node';

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

interface AdAccountData {
    id: string;
    name: string;
    account_status: number;
    currency?: string;
    timezone_name?: string;
}

interface AdAccountsResponse {
    data: AdAccountData[];
}

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
    return { token: data.access_token, expiresIn: data.expires_in || 5184000 };
}

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

async function getAdAccounts(accessToken: string): Promise<AdAccountData[]> {
    const url = new URL('https://graph.facebook.com/v21.0/me/adaccounts');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,name,account_status,currency,timezone_name');
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString());
    if (!response.ok) {
        console.error('[FB Callback] Failed to fetch ad accounts:', response.statusText);
        return [];
    }

    const data = await response.json() as AdAccountsResponse;
    return data.data || [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('[FB Callback] === CALLBACK STARTED ===');

    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    // Get origin from headers
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'admachin-momomedia.vercel.app';
    const origin = `${protocol}://${host}`;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        console.error('[FB Callback] Missing Facebook App ID or Secret');
        return res.redirect(`${origin}/ad-accounts?error=server_config_error`);
    }

    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
        console.log('[FB Callback] User cancelled or error:', error);
        return res.redirect(`${origin}/ad-accounts?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        console.error('[FB Callback] No authorization code received');
        return res.redirect(`${origin}/ad-accounts?error=no_code`);
    }

    try {
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

        console.log('[FB Callback] Step 4: Getting ad accounts...');
        const adAccounts = await getAdAccounts(longLivedToken);
        console.log('[FB Callback] ✓ Got', adAccounts.length, 'ad accounts');

        // Build complete profile object matching ConnectedProfile type
        const profile = {
            id: user.id,
            name: user.name,
            email: user.email,
            accessToken: longLivedToken,
            tokenExpiry: Date.now() + (expiresIn * 1000),
            adAccounts: adAccounts.map(acc => ({
                id: acc.id,
                name: acc.name,
                account_status: acc.account_status,
                currency: acc.currency || 'USD',
                timezone_name: acc.timezone_name || 'America/Los_Angeles'
            })),
            connectedAt: Date.now()
        };

        console.log('[FB Callback] SUCCESS! Profile with', profile.adAccounts.length, 'accounts');

        // Encode profile as URL parameter
        const profileParam = encodeURIComponent(JSON.stringify(profile));
        const successUrl = `${origin}/facebook/profiles?success=true&profile=${profileParam}`;

        return res.redirect(successUrl);

    } catch (err) {
        console.error('[FB Callback] ERROR:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        return res.redirect(`${origin}/facebook/profiles?error=${encodeURIComponent(errorMessage)}`);
    }
}
