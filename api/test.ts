// Simple test endpoint - absolutely minimal
export default async function handler(request: Request) {
    return new Response('Hello from Vercel!', { status: 200 });
}
