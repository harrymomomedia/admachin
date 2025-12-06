// Team Projects API - CRUD for projects
import { TeamStorage, Project } from '../services/teamStorage.js';

export default async function handler(request: Request) {
    const method = request.method;
    const url = new URL(request.url);

    if (method === 'GET') {
        try {
            const settings = await TeamStorage.get();
            return new Response(JSON.stringify({
                projects: settings.projects
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Projects API] GET error:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch projects' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const { name, description } = body;

            if (!name || typeof name !== 'string') {
                return new Response(JSON.stringify({ error: 'Project name is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const newProject: Project = {
                id: Date.now().toString(),
                name,
                description,
                createdAt: Date.now(),
                createdBy: '1', // Harry Jung's ID
                campaignCount: 0
            };

            const updatedSettings = await TeamStorage.addProject(newProject);

            return new Response(JSON.stringify({
                success: true,
                projects: updatedSettings.projects
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Projects API] POST error:', error);
            return new Response(JSON.stringify({ error: 'Failed to create project' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'PUT') {
        try {
            const body = await request.json();
            const { projectId, updates } = body;

            if (!projectId || !updates) {
                return new Response(JSON.stringify({ error: 'Project ID and updates are required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const updatedSettings = await TeamStorage.updateProject(projectId, updates);

            return new Response(JSON.stringify({
                success: true,
                projects: updatedSettings.projects
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Projects API] PUT error:', error);
            return new Response(JSON.stringify({ error: 'Failed to update project' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    if (method === 'DELETE') {
        try {
            const projectId = url.searchParams.get('id');

            if (!projectId) {
                return new Response(JSON.stringify({ error: 'Project ID is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const updatedSettings = await TeamStorage.removeProject(projectId);

            return new Response(JSON.stringify({
                success: true,
                projects: updatedSettings.projects
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('[Team Projects API] DELETE error:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete project' }), {
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
