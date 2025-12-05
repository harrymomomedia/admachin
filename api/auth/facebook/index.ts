// Facebook OAuth Initiation - Redirects user to Facebook's OAuth dialog
// Endpoint: GET /api/auth/facebook

export const config = {
    runtime: 'edge',
};

export default function handler(request: Request) {
    const FACEBOOK_APP_ID = process.env.VITE_FB_APP_ID || process.env.FB_APP_ID;

    if (!FACEBOOK_APP_ID) {
        return new Response(JSON.stringify({ error: 'Facebook App ID not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Build the callback URL based on the request origin
    const url = new URL(request.url);
    const origin = url.origin;
    const redirectUri = `${origin}/api/auth/facebook/callback`;

    // Permissions needed for Marketing API
    const scope = [
        'ads_management',
        'ads_read',
        'business_management',
        'pages_read_engagement',
        'pages_show_list',
    ].join(',');

    // Build Facebook OAuth URL
    const facebookOAuthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    facebookOAuthUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    facebookOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookOAuthUrl.searchParams.set('scope', scope);
    facebookOAuthUrl.searchParams.set('response_type', 'code');
    facebookOAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

    // Redirect to Facebook
    return Response.redirect(facebookOAuthUrl.toString(), 302);
}
