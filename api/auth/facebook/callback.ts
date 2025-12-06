// Facebook OAuth Callback - SIMPLIFIED VERSION
// Removed ALL imports to isolate crash issue

export default async function handler(request: Request) {
    console.log('[FB Callback] === FUNCTION STARTED ===');

    try {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        console.log('[FB Callback] Parsed URL');
        console.log('[FB Callback] Has code:', !!code);
        console.log('[FB Callback] Has error:', !!error);

        // Handle user cancellation
        if (error) {
            console.log('[FB Callback] User cancelled or error occurred');
            const errorReason = url.searchParams.get('error_reason') || 'Unknown error';
            return Response.redirect(`${url.origin}/ad-accounts?error=${encodeURIComponent(errorReason)}`, 302);
        }

        if (!code) {
            console.log('[FB Callback] No authorization code received');
            return Response.redirect(`${url.origin}/ad-accounts?error=no_code`, 302);
        }

        console.log('[FB Callback] Success - have authorization code');

        // For now, just redirect with the code to prove the function works
        // We'll add token exchange back once this works
        return Response.redirect(`${url.origin}/ad-accounts?success=true&message=callback_works`, 302);

    } catch (err) {
        console.error('[FB Callback] CRASH:', err);
        return new Response('Error: ' + (err instanceof Error ? err.message : 'Unknown'), { status: 500 });
    }
}
