// Team Settings API - GET/POST team info (name, logo)
import { TeamStorage } from '../services/teamStorage';

export default async function handler(request: Request) {
    const method = request.method;

    if (method === 'GET') {
        try {
            const settings = await TeamStorage.get();
            return new Response(JSON.stringify({
                teamName: settings.teamName,
                teamLogo: settings.teamLogo
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Settings API] GET error:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch team settings' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const { teamName, teamLogo } = body;

            if (!teamName || typeof teamName !== 'string') {
                return new Response(JSON.stringify({ error: 'Team name is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const updatedSettings = await TeamStorage.updateTeamInfo(teamName, teamLogo);

            return new Response(JSON.stringify({
                teamName: updatedSettings.teamName,
                teamLogo: updatedSettings.teamLogo
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Settings API] POST error:', error);
            return new Response(JSON.stringify({ error: 'Failed to update team settings' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}
