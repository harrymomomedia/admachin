import { useState, useEffect } from 'react';
import { Users, FolderKanban } from 'lucide-react';
import {
    getProjects, createProject, deleteProject,
    getUsers, createUser, deleteUser, updateUser,
    assignUserToProject, removeUserFromProject,
    getSubprojects, createSubproject, deleteSubproject,
    type Project, type User, type Subproject
} from '../lib/supabase-service';
import {
    UsersTab,
    ProjectsTab,
    SubprojectsTab,
    AddUserModal,
    EditUserModal,
    AddProjectModal,
    AssignUserModal,
    AddSubprojectModal
} from '../components/team-settings';

export function TeamSettings() {
    const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'subprojects'>('users');

    // Data state
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [projectAssignments, setProjectAssignments] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    // Modal visibility state
    const [showAddUser, setShowAddUser] = useState(false);
    const [showAddProject, setShowAddProject] = useState(false);
    const [showAddSubproject, setShowAddSubproject] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [assigningProject, setAssigningProject] = useState<Project | null>(null);


    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, projectsData, subprojectsData] = await Promise.all([
                getUsers(),
                getProjects(),
                getSubprojects()
            ]);
            setUsers(usersData);
            setProjects(projectsData);
            setSubprojects(subprojectsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async (data: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role: 'admin' | 'member';
    }) => {
        const user = await createUser(data.firstName, data.lastName, data.email, data.password, data.role);
        setUsers([user, ...users]);
    };

    const openEditUser = (user: User) => {
        setEditingUser(user);
    };

    const handleEditUser = async (userId: string, data: {
        firstName: string;
        lastName: string;
        email: string;
        password?: string;
        role: 'admin' | 'member';
        avatarUrl: string | null;
    }) => {
        const updates: { first_name?: string; last_name?: string; email?: string; password?: string; role?: string; avatar_url?: string | null } = {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            role: data.role,
            avatar_url: data.avatarUrl
        };
        if (data.password) {
            updates.password = data.password;
        }

        const updatedUser = await updateUser(userId, updates);
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
        setEditingUser(null);
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            await deleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleAddProject = async (data: { name: string; description: string }) => {
        const project = await createProject(data.name, data.description);
        setProjects([project, ...projects]);
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            await deleteProject(projectId);
            setProjects(projects.filter(p => p.id !== projectId));
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const handleAssignUser = async (projectId: string, userId: string) => {
        try {
            await assignUserToProject(projectId, userId);
            setProjectAssignments(prev => ({
                ...prev,
                [projectId]: [...(prev[projectId] || []), userId]
            }));
            setAssigningProject(null);
        } catch (error) {
            console.error('Error assigning user:', error);
        }
    };

    const handleRemoveUserFromProject = async (projectId: string, userId: string) => {
        try {
            await removeUserFromProject(projectId, userId);
            setProjectAssignments(prev => ({
                ...prev,
                [projectId]: (prev[projectId] || []).filter(id => id !== userId)
            }));
        } catch (error) {
            console.error('Error removing user from project:', error);
        }
    };

    const handleAddSubproject = async (projectId: string, name: string) => {
        const sub = await createSubproject(projectId, name);
        setSubprojects([sub, ...subprojects]);
    };

    const handleDeleteSubproject = async (subId: string) => {
        if (!confirm('Are you sure you want to delete this subproject?')) return;

        try {
            await deleteSubproject(subId);
            setSubprojects(subprojects.filter(s => s.id !== subId));
        } catch (error) {
            console.error('Error deleting subproject:', error);
            alert('Error deleting subproject.');
        }
    };

    const getUserDisplayName = (user: User) => {
        if (user.first_name || user.last_name) {
            return `${user.first_name || ''} ${user.last_name || ''}`.trim();
        }
        return user.email;
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Manage users and projects.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        Users
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'projects'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <FolderKanban className="w-4 h-4" />
                        Projects
                    </button>
                    <button
                        onClick={() => setActiveTab('subprojects')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'subprojects'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <FolderKanban className="w-4 h-4" />
                        Subprojects
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'users' && (
                <UsersTab
                    users={users}
                    isLoading={isLoading}
                    onAddClick={() => setShowAddUser(true)}
                    onEditClick={openEditUser}
                    onDeleteClick={handleDeleteUser}
                />
            )}

            {activeTab === 'projects' && (
                <ProjectsTab
                    projects={projects}
                    users={users}
                    projectAssignments={projectAssignments}
                    isLoading={isLoading}
                    onAddClick={() => setShowAddProject(true)}
                    onDeleteClick={handleDeleteProject}
                    onAssignUserClick={setAssigningProject}
                    onRemoveUserFromProject={handleRemoveUserFromProject}
                    getUserDisplayName={getUserDisplayName}
                />
            )}

            {activeTab === 'subprojects' && (
                <SubprojectsTab
                    subprojects={subprojects}
                    projects={projects}
                    isLoading={isLoading}
                    onAddClick={() => setShowAddSubproject(true)}
                    onDeleteClick={handleDeleteSubproject}
                />
            )}

            {/* Modals */}
            <AddUserModal
                isOpen={showAddUser}
                onClose={() => setShowAddUser(false)}
                onAdd={handleAddUser}
            />

            <EditUserModal
                user={editingUser}
                onClose={() => setEditingUser(null)}
                onSave={handleEditUser}
            />

            <AddProjectModal
                isOpen={showAddProject}
                onClose={() => setShowAddProject(false)}
                onAdd={handleAddProject}
            />

            <AssignUserModal
                project={assigningProject}
                users={users}
                assignedUserIds={assigningProject ? (projectAssignments[assigningProject.id] || []) : []}
                onClose={() => setAssigningProject(null)}
                onAssign={handleAssignUser}
                getUserDisplayName={getUserDisplayName}
            />

            <AddSubprojectModal
                isOpen={showAddSubproject}
                projects={projects}
                onClose={() => setShowAddSubproject(false)}
                onAdd={handleAddSubproject}
            />
        </div>
    );
}
