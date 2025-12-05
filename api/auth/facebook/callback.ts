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
    email?: string;
}

// ... existing code ...

if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    console.error('Missing Facebook App ID or Secret');
    const origin = new URL(request.url).origin;
    return Response.redirect(`${origin}/ad-accounts?error=${encodeURIComponent('Server configuration error: Missing Facebook App ID or Secret')}`, 302);
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
