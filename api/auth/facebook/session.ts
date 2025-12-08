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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function handler(_request: Request) {
    // 1. Check for "Team Store" token (The persistent Source of Truth)
    const storedSession = await TokenStorage.get();

    // 2. Fallback to Env Vars - REMOVED for security/production parity
    // if (!storedSession && ...) { ... }

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
