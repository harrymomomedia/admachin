import { Redis } from '@upstash/redis';

const KV_KEY = 'momomedia_team_settings';

// Helper to get the Redis client
function getRedisClient() {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (url && token) {
        return new Redis({ url, token });
    }
    return null;
}

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Suspended' | 'Pending';
    joinedAt: number;
    avatar?: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    createdBy: string;
    campaignCount: number;
}

export interface PendingInvitation {
    email: string;
    role: 'Admin' | 'Editor' | 'Viewer';
    invitedAt: number;
    invitedBy: string;
}

export interface TeamSettings {
    teamName: string;
    teamLogo?: string;
    members: TeamMember[];
    projects: Project[];
    pendingInvitations: PendingInvitation[];
}

// Default initial data
const DEFAULT_TEAM_SETTINGS: TeamSettings = {
    teamName: 'Momomedia',
    teamLogo: undefined,
    members: [
        {
            id: '1',
            name: 'Harry Jung',
            email: 'harry@momomedia.io',
            role: 'Admin',
            status: 'Active',
            joinedAt: Date.now(),
        }
    ],
    projects: [
        {
            id: '1',
            name: 'Auto Insurance',
            createdAt: Date.now(),
            createdBy: '1',
            campaignCount: 0
        },
        {
            id: '2',
            name: 'Auto Loan',
            createdAt: Date.now(),
            createdBy: '1',
            campaignCount: 0
        }
    ],
    pendingInvitations: []
};

export const TeamStorage = {
    async get(): Promise<TeamSettings> {
        try {
            const redis = getRedisClient();

            if (redis) {
                const settings = await redis.get<TeamSettings>(KV_KEY);
                if (settings) {
                    return settings;
                }
            }

            // Return default if nothing stored yet
            return DEFAULT_TEAM_SETTINGS;
        } catch (error) {
            console.warn('[TeamStorage] Failed to read settings:', error);
            return DEFAULT_TEAM_SETTINGS;
        }
    },

    async save(settings: TeamSettings): Promise<void> {
        try {
            const redis = getRedisClient();

            if (redis) {
                console.log('[TeamStorage] Saving to Redis');
                await redis.set(KV_KEY, settings);
                return;
            }

            if (process.env.NODE_ENV === 'production') {
                console.error('[TeamStorage] CRITICAL: Redis not configured in Production.');
                return;
            }

            console.warn('[TeamStorage] Development mode: Settings not persisted');
        } catch (error) {
            console.error('[TeamStorage] Failed to save settings:', error);
        }
    },

    async updateTeamInfo(teamName: string, teamLogo?: string): Promise<TeamSettings> {
        const settings = await this.get();
        settings.teamName = teamName;
        if (teamLogo !== undefined) {
            settings.teamLogo = teamLogo;
        }
        await this.save(settings);
        return settings;
    },

    async addMember(member: TeamMember): Promise<TeamSettings> {
        const settings = await this.get();
        settings.members.push(member);
        await this.save(settings);
        return settings;
    },

    async updateMember(memberId: string, updates: Partial<TeamMember>): Promise<TeamSettings> {
        const settings = await this.get();
        const memberIndex = settings.members.findIndex(m => m.id === memberId);
        if (memberIndex !== -1) {
            settings.members[memberIndex] = { ...settings.members[memberIndex], ...updates };
            await this.save(settings);
        }
        return settings;
    },

    async removeMember(memberId: string): Promise<TeamSettings> {
        const settings = await this.get();
        settings.members = settings.members.filter(m => m.id !== memberId);
        await this.save(settings);
        return settings;
    },

    async addProject(project: Project): Promise<TeamSettings> {
        const settings = await this.get();
        settings.projects.push(project);
        await this.save(settings);
        return settings;
    },

    async updateProject(projectId: string, updates: Partial<Project>): Promise<TeamSettings> {
        const settings = await this.get();
        const projectIndex = settings.projects.findIndex(p => p.id === projectId);
        if (projectIndex !== -1) {
            settings.projects[projectIndex] = { ...settings.projects[projectIndex], ...updates };
            await this.save(settings);
        }
        return settings;
    },

    async removeProject(projectId: string): Promise<TeamSettings> {
        const settings = await this.get();
        settings.projects = settings.projects.filter(p => p.id !== projectId);
        await this.save(settings);
        return settings;
    },

    async addPendingInvitation(invitation: PendingInvitation): Promise<TeamSettings> {
        const settings = await this.get();
        settings.pendingInvitations.push(invitation);
        await this.save(settings);
        return settings;
    },

    async removePendingInvitation(email: string): Promise<TeamSettings> {
        const settings = await this.get();
        settings.pendingInvitations = settings.pendingInvitations.filter(i => i.email !== email);
        await this.save(settings);
        return settings;
    }
};
