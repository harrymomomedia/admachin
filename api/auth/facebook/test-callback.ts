// Minimal test endpoint - NO imports, just basic redirect
export default async function handler(request: Request) {
    console.log('[Test Callback] Function invoked');

    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (!code) {
        console.log('[Test Callback] No code, redirecting with error');
        return Response.redirect(`${url.origin}/ad-accounts?error=no_code`, 302);
    }

    console.log('[Test Callback] Code received, redirecting with success');
    return Response.redirect(`${url.origin}/ad-accounts?test=success&code=${code.substring(0, 10)}`, 302);
}
