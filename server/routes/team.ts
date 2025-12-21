/**
 * Team API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { TeamStorage, Project, PendingInvitation } from '../services/teamStorage.js';

const router = Router();

// ============================================
// /api/team/settings
// ============================================
router.get('/settings', async (_req: Request, res: Response) => {
    try {
        const settings = await TeamStorage.get();
        return res.json({
            teamName: settings.teamName,
            teamLogo: settings.teamLogo
        });
    } catch (error) {
        console.error('[Team Settings API] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch team settings' });
    }
});

router.post('/settings', async (req: Request, res: Response) => {
    try {
        const { teamName, teamLogo } = req.body;

        if (!teamName || typeof teamName !== 'string') {
            return res.status(400).json({ error: 'Team name is required' });
        }

        const updatedSettings = await TeamStorage.updateTeamInfo(teamName, teamLogo);

        return res.json({
            teamName: updatedSettings.teamName,
            teamLogo: updatedSettings.teamLogo
        });
    } catch (error) {
        console.error('[Team Settings API] POST error:', error);
        return res.status(500).json({ error: 'Failed to update team settings' });
    }
});

// ============================================
// /api/team/members
// ============================================
router.get('/members', async (_req: Request, res: Response) => {
    try {
        const settings = await TeamStorage.get();
        return res.json({
            members: settings.members,
            pendingInvitations: settings.pendingInvitations
        });
    } catch (error) {
        console.error('[Team Members API] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch members' });
    }
});

router.post('/members', async (req: Request, res: Response) => {
    try {
        const { email, role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }

        // Add to pending invitations (not actually sending email in Phase 1)
        const invitation: PendingInvitation = {
            email,
            role,
            invitedAt: Date.now(),
            invitedBy: '1' // Harry Jung's ID
        };
        const updatedSettings = await TeamStorage.addPendingInvitation(invitation);

        return res.json({
            success: true,
            pendingInvitations: updatedSettings.pendingInvitations
        });
    } catch (error) {
        console.error('[Team Members API] POST error:', error);
        return res.status(500).json({ error: 'Failed to invite member' });
    }
});

router.put('/members', async (req: Request, res: Response) => {
    try {
        const { memberId, updates } = req.body;

        if (!memberId || !updates) {
            return res.status(400).json({ error: 'Member ID and updates are required' });
        }

        const updatedSettings = await TeamStorage.updateMember(memberId, updates);

        return res.json({
            success: true,
            members: updatedSettings.members
        });
    } catch (error) {
        console.error('[Team Members API] PUT error:', error);
        return res.status(500).json({ error: 'Failed to update member' });
    }
});

router.delete('/members', async (req: Request, res: Response) => {
    try {
        const memberId = req.query.id as string;

        if (!memberId) {
            return res.status(400).json({ error: 'Member ID is required' });
        }

        const updatedSettings = await TeamStorage.removeMember(memberId);

        return res.json({
            success: true,
            members: updatedSettings.members
        });
    } catch (error) {
        console.error('[Team Members API] DELETE error:', error);
        return res.status(500).json({ error: 'Failed to remove member' });
    }
});

// ============================================
// /api/team/projects
// ============================================
router.get('/projects', async (_req: Request, res: Response) => {
    try {
        const settings = await TeamStorage.get();
        return res.json({
            projects: settings.projects
        });
    } catch (error) {
        console.error('[Team Projects API] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

router.post('/projects', async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Project name is required' });
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

        return res.json({
            success: true,
            projects: updatedSettings.projects
        });
    } catch (error) {
        console.error('[Team Projects API] POST error:', error);
        return res.status(500).json({ error: 'Failed to create project' });
    }
});

router.put('/projects', async (req: Request, res: Response) => {
    try {
        const { projectId, updates } = req.body;

        if (!projectId || !updates) {
            return res.status(400).json({ error: 'Project ID and updates are required' });
        }

        const updatedSettings = await TeamStorage.updateProject(projectId, updates);

        return res.json({
            success: true,
            projects: updatedSettings.projects
        });
    } catch (error) {
        console.error('[Team Projects API] PUT error:', error);
        return res.status(500).json({ error: 'Failed to update project' });
    }
});

router.delete('/projects', async (req: Request, res: Response) => {
    try {
        const projectId = req.query.id as string;

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        const updatedSettings = await TeamStorage.removeProject(projectId);

        return res.json({
            success: true,
            projects: updatedSettings.projects
        });
    } catch (error) {
        console.error('[Team Projects API] DELETE error:', error);
        return res.status(500).json({ error: 'Failed to delete project' });
    }
});

export default router;
