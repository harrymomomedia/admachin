import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Missing access token' });
    }

    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

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
        const data = await response.json();

        if (data.error) {
            console.error('Token refresh error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        return res.status(200).json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            token_type: data.token_type
        });

    } catch (error) {
        console.error('Refresh handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
