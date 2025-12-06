import { useState, useEffect } from 'react';
import { Users, Building2, FolderKanban, Plus, Mail, Trash2, Shield } from 'lucide-react';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Editor' | 'Viewer';
    status: 'Active' | 'Suspended' | 'Pending';
    joinedAt: number;
}

interface Project {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    campaignCount: number;
}

interface PendingInvitation {
    email: string;
    role: string;
    invitedAt: number;
}

export function TeamSettings() {
    const [teamName, setTeamName] = useState('Momomedia');
    const [teamLogo, setTeamLogo] = useState('');
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Invite member modal state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Editor');

    // Add project modal state
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load team settings
            const settingsRes = await fetch('/api/team/settings');
            const settingsData = await settingsRes.json();
            setTeamName(settingsData.teamName || 'Momomedia');
            setTeamLogo(settingsData.teamLogo || '');

            // Load members
            const membersRes = await fetch('/api/team/members');
            const membersData = await membersRes.json();
            setMembers(membersData.members || []);
            setPendingInvitations(membersData.pendingInvitations || []);

            // Load projects
            const projectsRes = await fetch('/api/team/projects');
            const projectsData = await projectsRes.json();
            setProjects(projectsData.projects || []);
        } catch (error) {
            console.error('Failed to load team data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveTeamInfo = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/team/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamName, teamLogo })
            });
            alert('Team information saved!');
        } catch (error) {
            console.error('Failed to save team info:', error);
            alert('Failed to save team information');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInviteMember = async () => {
        if (!inviteEmail || !inviteRole) {
            alert('Please enter email and select a role');
            return;
        }

        try {
            const res = await fetch('/api/team/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, role: inviteRole })
            });
            const data = await res.json();

            if (data.success) {
                setPendingInvitations(data.pendingInvitations);
                setInviteEmail('');
                setInviteRole('Editor');
                setShowInviteModal(false);
                alert(`Invitation sent to ${inviteEmail} (Note: Email sending not implemented yet)`);
            }
        } catch (error) {
            console.error('Failed to invite member:', error);
            alert('Failed to send invitation');
        }
    };

    const handleAddProject = async () => {
        if (!newProjectName) {
            alert('Please enter a project name');
            return;
        }

        try {
            const res = await fetch('/api/team/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProjectName, description: newProjectDesc })
            });
            const data = await res.json();

            if (data.success) {
                setProjects(data.projects);
                setNewProjectName('');
                setNewProjectDesc('');
                setShowAddProject(false);
            }
        } catch (error) {
            console.error('Failed to add project:', error);
            alert('Failed to add project');
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) {
            return;
        }

        try {
            const res = await fetch(`/api/team/projects?id=${projectId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
            alert('Failed to delete project');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading team settings...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Team Settings</h1>
            </div>

            {/* Organization Section */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Organization</h2>
                </div>

                <div className="space-y-4 max-w-2xl">
                    <div>
                        <label className="block text-sm font-medium mb-2">Team Name</label>
                        <input
                            type="text"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Enter team name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Team Logo URL</label>
                        <input
                            type="text"
                            value={teamLogo}
                            onChange={(e) => setTeamLogo(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="https://example.com/logo.png (optional)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Enter a URL to your company logo
                        </p>
                    </div>

                    <button
                        onClick={saveTeamInfo}
                        disabled={isSaving}
                        className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Projects Section */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <FolderKanban className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Projects</h2>
                    </div>
                    <button
                        onClick={() => setShowAddProject(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add Project
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => (
                        <div key={project.id} className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold">{project.name}</h3>
                                <button
                                    onClick={() => handleDeleteProject(project.id)}
                                    className="text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            {project.description && (
                                <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                            )}
                            <div className="text-xs text-muted-foreground">
                                {project.campaignCount} campaigns
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Project Modal */}
                {showAddProject && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-semibold mb-4">Add New Project</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Project Name</label>
                                    <input
                                        type="text"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="e.g., Auto Insurance"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Description (optional)</label>
                                    <textarea
                                        value={newProjectDesc}
                                        onChange={(e) => setNewProjectDesc(e.target.value)}
                                        className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        rows={3}
                                        placeholder="Brief description of this project"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAddProject}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Add Project
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddProject(false);
                                            setNewProjectName('');
                                            setNewProjectDesc('');
                                        }}
                                        className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Team Members Section */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Team Members</h2>
                    </div>
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Mail className="h-4 w-4" />
                        Invite Member
                    </button>
                </div>

                <div className="space-y-3">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-medium">
                                    {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-semibold">{member.name}</div>
                                    <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${member.role === 'Admin' ? 'bg-primary/10 text-primary' :
                                    member.role === 'Editor' ? 'bg-blue-500/10 text-blue-600' :
                                        'bg-muted text-muted-foreground'
                                    }`}>
                                    {member.role}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${member.status === 'Active' ? 'bg-green-500/10 text-green-600' :
                                    'bg-muted text-muted-foreground'
                                    }`}>
                                    {member.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pending Invitations */}
                {pendingInvitations.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-border">
                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Pending Invitations</h3>
                        <div className="space-y-2">
                            {pendingInvitations.map((inv, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border border-dashed border-border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <div className="text-sm">{inv.email}</div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{inv.role}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Invite Modal */}
                {showInviteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="colleague@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Role</label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as 'Admin' | 'Editor' | 'Viewer')}
                                        className="w-full bg-muted/50 border border-border rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="Viewer">Viewer - Read-only access</option>
                                        <option value="Editor">Editor - Can create & edit</option>
                                        <option value="Admin">Admin - Full access</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleInviteMember}
                                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        Send Invitation
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowInviteModal(false);
                                            setInviteEmail('');
                                            setInviteRole('Editor');
                                        }}
                                        className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Role Definitions */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Role Definitions</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border border-border rounded-lg">
                        <h3 className="font-semibold text-sm mb-2">Admin</h3>
                        <p className="text-xs text-muted-foreground">
                            Full access to all features including team management, billing, and settings
                        </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                        <h3 className="font-semibold text-sm mb-2">Editor</h3>
                        <p className="text-xs text-muted-foreground">
                            Can create and edit campaigns, creatives, and view analytics
                        </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                        <h3 className="font-semibold text-sm mb-2">Viewer</h3>
                        <p className="text-xs text-muted-foreground">
                            Read-only access to campaigns and analytics
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
