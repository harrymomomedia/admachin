/**
 * Auth API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { TokenStorage } from '../services/tokenStorage.js';
import crypto from 'crypto';

const router = Router();

// Environment variables
const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
const FACEBOOK_CONFIG_ID = process.env.FACEBOOK_CONFIG_ID;

// Types
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
    account_id: string;
    name: string;
    account_status: number;
    currency?: string;
    timezone_name?: string;
}

interface AdAccountsResponse {
    data: AdAccountData[];
}

// Helper functions
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
    url.searchParams.set('fields', 'id,account_id,name,account_status,currency,timezone_name');
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString());
    if (!response.ok) {
        console.error('[FB Callback] Failed to fetch ad accounts:', response.statusText);
        return [];
    }

    const data = await response.json() as AdAccountsResponse;
    return data.data || [];
}

// ============================================
// GET /api/auth/facebook - Initiate OAuth
// ============================================
router.get('/facebook', (req: Request, res: Response) => {
    if (!FACEBOOK_APP_ID) {
        return res.status(500).json({ error: 'Facebook App ID not configured' });
    }

    // Build the callback URL based on the request origin
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3001';
    const origin = `${protocol}://${host}`;
    const redirectUri = `${origin}/api/auth/facebook/callback`;

    console.log('[FB OAuth] Initiating login...');
    console.log('[FB OAuth] Using config_id:', !!FACEBOOK_CONFIG_ID);

    // Build Facebook OAuth URL
    const facebookOAuthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    facebookOAuthUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    facebookOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookOAuthUrl.searchParams.set('response_type', 'code');
    facebookOAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

    // If config_id is set, use Facebook Login for Business
    if (FACEBOOK_CONFIG_ID) {
        console.log('[FB OAuth] Using Facebook Login for Business with config_id');
        facebookOAuthUrl.searchParams.set('config_id', FACEBOOK_CONFIG_ID);
    } else {
        // Fallback: manually specify scopes
        console.log('[FB OAuth] Using manual scopes (no config_id)');
        const scope = [
            'ads_management',
            'ads_read',
            'business_management',
            'pages_read_engagement',
            'pages_show_list',
        ].join(',');
        facebookOAuthUrl.searchParams.set('scope', scope);
    }

    console.log('[FB OAuth] Redirecting to:', facebookOAuthUrl.toString());
    return res.redirect(302, facebookOAuthUrl.toString());
});

// ============================================
// GET /api/auth/facebook/callback - OAuth callback
// ============================================
router.get('/facebook/callback', async (req: Request, res: Response) => {
    console.log('[FB Callback] === CALLBACK STARTED ===');

    // Get origin from headers
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3001';
    const origin = `${protocol}://${host}`;
    const frontendUrl = process.env.FRONTEND_URL || origin;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        console.error('[FB Callback] Missing Facebook App ID or Secret');
        return res.redirect(`${frontendUrl}/ad-accounts?error=server_config_error`);
    }

    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
        console.log('[FB Callback] User cancelled or error:', error);
        return res.redirect(`${frontendUrl}/ad-accounts?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        console.error('[FB Callback] No authorization code received');
        return res.redirect(`${frontendUrl}/ad-accounts?error=no_code`);
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
                account_id: acc.account_id,
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
        const successUrl = `${frontendUrl}/facebook/profiles?success=true&profile=${profileParam}`;

        return res.redirect(successUrl);

    } catch (err) {
        console.error('[FB Callback] ERROR:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        return res.redirect(`${frontendUrl}/facebook/profiles?error=${encodeURIComponent(errorMessage)}`);
    }
});

// ============================================
// GET /api/auth/facebook/session - Get current session
// ============================================
router.get('/facebook/session', async (_req: Request, res: Response) => {
    // Check for "Team Store" token (The persistent Source of Truth)
    const storedSession = await TokenStorage.get();

    if (!storedSession) {
        return res.json({ isAuthenticated: false });
    }

    // Return the "Team" Session
    return res.json({
        isAuthenticated: true,
        teamName: 'Momomedia', // Hardcoded Team Name as per architectural requirement
        profile: {
            id: storedSession.userId,
            name: storedSession.userName,
            accessToken: storedSession.accessToken,
            tokenExpiry: storedSession.tokenExpiry
        }
    });
});

// ============================================
// POST /api/auth/facebook/refresh - Refresh token
// ============================================
router.post('/facebook/refresh', async (req: Request, res: Response) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Missing access token' });
    }

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Exchange current (potentially old but valid) token for a new long-lived token
        const url = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
        url.searchParams.set('grant_type', 'fb_exchange_token');
        url.searchParams.set('client_id', FACEBOOK_APP_ID);
        url.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
        url.searchParams.set('fb_exchange_token', accessToken);

        const response = await fetch(url.toString());
        const data = await response.json() as { access_token?: string; expires_in?: number; token_type?: string; error?: { message: string } };

        if (data.error) {
            console.error('Token refresh error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        return res.json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            token_type: data.token_type
        });

    } catch (error) {
        console.error('Refresh handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
