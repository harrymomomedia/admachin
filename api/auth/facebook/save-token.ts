// Save Facebook Token - Client-side SDK approach
// Endpoint: POST /api/auth/facebook/save-token

import { TokenStorage } from '../../services/tokenStorage.js';

interface SaveTokenRequest {
    accessToken: string;
}

interface FacebookMeResponse {
    id: string;
    name: string;
    email?: string;
}

/**
 * Validate token and get user info from Facebook
 */
async function validateTokenAndGetUser(accessToken: string): Promise<FacebookMeResponse> {
    const url = new URL('https://graph.facebook.com/v21.0/me');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,name,email');

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error('Invalid or expired access token');
    }

    return response.json();
}

export default async function handler(request: Request) {
    console.log('[Save Token] Request received');

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const body = await request.json() as SaveTokenRequest;
        const { accessToken } = body;

        if (!accessToken) {
            console.error('[Save Token] No access token provided');
            return new Response(JSON.stringify({ error: 'Access token required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('[Save Token] Validating token with Facebook...');

        // Validate token and get user info
        const user = await validateTokenAndGetUser(accessToken);

        console.log('[Save Token] Token validated, user:', user.name, user.id);

        // Facebook SDK tokens are short-lived (1-2 hours), but we'll store them
        // In production, you'd want to exchange for a long-lived token here
        const tokenExpiry = Date.now() + (2 * 60 * 60 * 1000); // 2 hours

        console.log('[Save Token] Saving session to storage...');

        await TokenStorage.save({
            accessToken: accessToken,
            tokenExpiry: tokenExpiry,
            userName: user.name,
            userId: user.id,
            connectedAt: Date.now()
        });

        console.log('[Save Token] Session saved successfully');

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[Save Token] Error:', err);

        const errorMessage = err instanceof Error ? err.message : 'Failed to save token';

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
