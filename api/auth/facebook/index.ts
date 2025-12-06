// Facebook OAuth Initiation - Using Facebook Login for Business with config_id
// Endpoint: GET /api/auth/facebook

export const config = {
    runtime: 'edge',
};

export default function handler(request: Request) {
    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID;
    const FACEBOOK_CONFIG_ID = process.env.FACEBOOK_CONFIG_ID;

    if (!FACEBOOK_APP_ID) {
        return new Response(JSON.stringify({ error: 'Facebook App ID not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Build the callback URL based on the request origin
    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/auth/facebook/callback2`;

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

    // Redirect to Facebook
    return Response.redirect(facebookOAuthUrl.toString(), 302);
}
