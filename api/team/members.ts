// Team Members API - CRUD for team members
import { TeamStorage } from '../services/teamStorage.js';

export default async function handler(request: Request) {
    const method = request.method;
    const url = new URL(request.url);

    if (method === 'GET') {
        try {
            const settings = await TeamStorage.get();
            return new Response(JSON.stringify({
                members: settings.members,
                pendingInvitations: settings.pendingInvitations
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Members API] GET error:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch members' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const { email, role } = body;

            if (!email || !role) {
                return new Response(JSON.stringify({ error: 'Email and role are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Add to pending invitations (not actually sending email in Phase 1)
            const updatedSettings = await TeamStorage.addPendingInvitation({
                email,
                role,
                invitedAt: Date.now(),
                invitedBy: '1' // Harry Jung's ID
            });

            return new Response(JSON.stringify({
                success: true,
                pendingInvitations: updatedSettings.pendingInvitations
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Members API] POST error:', error);
            return new Response(JSON.stringify({ error: 'Failed to invite member' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'PUT') {
        try {
            const body = await request.json();
            const { memberId, updates } = body;

            if (!memberId || !updates) {
                return new Response(JSON.stringify({ error: 'Member ID and updates are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const updatedSettings = await TeamStorage.updateMember(memberId, updates);

            return new Response(JSON.stringify({
                success: true,
                members: updatedSettings.members
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Members API] PUT error:', error);
            return new Response(JSON.stringify({ error: 'Failed to update member' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'DELETE') {
        try {
            const memberId = url.searchParams.get('id');

            if (!memberId) {
                return new Response(JSON.stringify({ error: 'Member ID is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const updatedSettings = await TeamStorage.removeMember(memberId);

            return new Response(JSON.stringify({
                success: true,
                members: updatedSettings.members
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Members API] DELETE error:', error);
            return new Response(JSON.stringify({ error: 'Failed to remove member' }), {
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
