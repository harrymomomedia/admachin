// NOTE: Switched to Node.js runtime for local file persistence
// export const config = {
//     runtime: 'edge',
// };

import { TokenStorage } from '../../services/tokenStorage.js';

interface FacebookSessionResponse {
    isAuthenticated: boolean;
    teamName?: string; // Added to support "Momomedia" Team concept
    profile?: {
        id: string;
        name: string;
        accessToken: string;
        tokenExpiry: number;
    };
    error?: string;
}

export default async function handler(request: Request) {
    // 1. Check for "Team Store" token (The persistent Source of Truth)
    let storedSession = await TokenStorage.get();

    // 2. Fallback to Env Vars (System Admin Override) - optional but good for dev
    if (!storedSession && (process.env.FB_ACCESS_TOKEN || process.env.VITE_DEFAULT_FB_TOKEN)) {
        const token = process.env.FB_ACCESS_TOKEN || process.env.VITE_DEFAULT_FB_TOKEN;
        const userName = process.env.FB_USER_NAME || process.env.VITE_DEFAULT_FB_USER_NAME || 'System User';
        if (token) {
            storedSession = {
                accessToken: token,
                tokenExpiry: Date.now() + (365 * 24 * 60 * 60 * 1000), // Far future
                userName: userName,
                userId: 'system_env_user',
                connectedAt: Date.now()
            };
        }
    }

    if (!storedSession) {
        return new Response(JSON.stringify({
            isAuthenticated: false
        } as FacebookSessionResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Return the "Team" Session
    const session: FacebookSessionResponse = {
        isAuthenticated: true,
        teamName: 'Momomedia', // Hardcoded Team Name as per architectural requirement
        profile: {
            id: storedSession.userId,
            name: storedSession.userName,
            accessToken: storedSession.accessToken,
            tokenExpiry: storedSession.tokenExpiry
        }
    };

    return new Response(JSON.stringify(session), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}
