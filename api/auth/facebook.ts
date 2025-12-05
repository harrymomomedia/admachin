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

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        console.log(`Method ${req.method} not allowed`);
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Missing access token' });
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
        console.error('Missing Facebook credentials on server');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Exchange short-lived token for long-lived token
        const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;

        const longLivedRes = await fetch(longLivedUrl);
        const longLivedData = await longLivedRes.json();

        if (longLivedData.error) {
            console.error('Long-lived token exchange error:', longLivedData.error);
            return res.status(400).json({ error: longLivedData.error.message });
        }

        // Success! Return the long-lived token and expiry
        return res.status(200).json({
            access_token: longLivedData.access_token,
            expires_in: longLivedData.expires_in, // typically 60 days
            token_type: longLivedData.token_type
        });

    } catch (error) {
        console.error('Handler error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
