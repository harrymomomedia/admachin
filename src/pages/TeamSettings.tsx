import { useState, useEffect } from 'react';
import { Users, FolderKanban, Plus, Trash2, UserPlus, X, Check, Pencil, Camera } from 'lucide-react';
import {
    getProjects, createProject, deleteProject,
    getUsers, createUser, deleteUser, updateUser,
    assignUserToProject, removeUserFromProject,
    getSubprojects, createSubproject, deleteSubproject,
    type Project, type User, type Subproject
} from '../lib/supabase-service';
import { AvatarUploadModal } from '../components/AvatarUploadModal';

export function TeamSettings() {
    const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'subprojects'>('users');

    // Data state
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [projectAssignments, setProjectAssignments] = useState<Record<string, string[]>>({}); // projectId -> userIds[]
    const [isLoading, setIsLoading] = useState(true);

    // Add User modal state
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserFirstName, setNewUserFirstName] = useState('');
    const [newUserLastName, setNewUserLastName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
    const [isSubmittingUser, setIsSubmittingUser] = useState(false);
    const [addUserError, setAddUserError] = useState<string | null>(null);

    // Subprojects modal state
    const [showAddSubproject, setShowAddSubproject] = useState(false);
    const [selectedProjectForSub, setSelectedProjectForSub] = useState<string>('');
    const [newSubprojectName, setNewSubprojectName] = useState('');

    // Edit User modal state
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editUserFirstName, setEditUserFirstName] = useState('');
    const [editUserLastName, setEditUserLastName] = useState('');
    const [editUserEmail, setEditUserEmail] = useState('');
    const [editUserPassword, setEditUserPassword] = useState('');
    const [editUserRole, setEditUserRole] = useState<'admin' | 'member'>('member');
    const [editUserAvatarUrl, setEditUserAvatarUrl] = useState<string | null>(null);
    const [showAvatarUpload, setShowAvatarUpload] = useState(false);

    // Add Project modal state
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');

    // Assign user modal state
    const [assigningProject, setAssigningProject] = useState<Project | null>(null);
    const [selectedUserForAssignment, setSelectedUserForAssignment] = useState<string>('');

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

    const handleAddUser = async () => {
        if (!newUserFirstName.trim() || !newUserLastName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) return;
        if (isSubmittingUser) return; // Prevent double-clicks

        setIsSubmittingUser(true);
        setAddUserError(null);

        try {
            const user = await createUser(newUserFirstName, newUserLastName, newUserEmail, newUserPassword, newUserRole);
            setUsers([user, ...users]);
            setShowAddUser(false);
            setNewUserFirstName('');
            setNewUserLastName('');
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('member');
            setAddUserError(null);
        } catch (error: unknown) {
            console.error('Error creating user:', error);
            // Check for duplicate email error
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('already exists')) {
                setAddUserError('A user with this email already exists.');
            } else {
                setAddUserError(`Error creating user: ${errorMessage}`);
            }
        } finally {
            setIsSubmittingUser(false);
        }
    };

    const openEditUser = (user: User) => {
        setEditingUser(user);
        setEditUserFirstName(user.first_name || '');
        setEditUserLastName(user.last_name || '');
        setEditUserEmail(user.email);
        setEditUserPassword('');
        setEditUserRole(user.role as 'admin' | 'member');
        setEditUserAvatarUrl(user.avatar_url || null);
    };

    const handleEditUser = async () => {
        if (!editingUser || !editUserFirstName.trim() || !editUserLastName.trim() || !editUserEmail.trim()) return;

        try {
            const updates: { first_name?: string; last_name?: string; email?: string; password?: string; role?: string; avatar_url?: string | null } = {
                first_name: editUserFirstName,
                last_name: editUserLastName,
                email: editUserEmail,
                role: editUserRole,
                avatar_url: editUserAvatarUrl
            };
            // Only update password if provided
            if (editUserPassword.trim()) {
                updates.password = editUserPassword;
            }

            const updatedUser = await updateUser(editingUser.id, updates);
            setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
            setEditingUser(null);
        } catch (error) {
            console.error('Error updating user:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error updating user: ${errorMessage}`);
        }
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

    const handleAddProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            const project = await createProject(newProjectName, newProjectDesc);
            setProjects([project, ...projects]);
            setShowAddProject(false);
            setNewProjectName('');
            setNewProjectDesc('');
        } catch (error) {
            console.error('Error creating project:', error);
        }
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

    const handleAssignUser = async () => {
        if (!assigningProject || !selectedUserForAssignment) return;

        try {
            await assignUserToProject(assigningProject.id, selectedUserForAssignment);
            setProjectAssignments(prev => ({
                ...prev,
                [assigningProject.id]: [...(prev[assigningProject.id] || []), selectedUserForAssignment]
            }));
            setAssigningProject(null);
            setSelectedUserForAssignment('');
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

    const handleAddSubproject = async () => {
        if (!selectedProjectForSub || !newSubprojectName.trim()) return;

        try {
            const sub = await createSubproject(selectedProjectForSub, newSubprojectName);
            setSubprojects([sub, ...subprojects]);
            setNewSubprojectName('');
            setSelectedProjectForSub('');
            setShowAddSubproject(false);
        } catch (error) {
            console.error('Error creating subproject:', error);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const msg = (error as any)?.message || 'Unknown error';
            alert(`Error creating subproject: ${msg}`);
        }
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

    const getAssignedUsers = (projectId: string) => {
        const userIds = projectAssignments[projectId] || [];
        return users.filter(u => userIds.includes(u.id));
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

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Users</h2>
                        <button
                            onClick={() => setShowAddUser(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add User
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="pl-6 pr-2 py-3 font-medium text-gray-500 w-20">Photo</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">First Name</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Last Name</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Email</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Created</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            Loading users...
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            No users yet. Add your first user.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map(user => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="pl-6 pr-2 py-3">
                                                {user.avatar_url ? (
                                                    <img
                                                        src={user.avatar_url}
                                                        alt={`${user.first_name} ${user.last_name}`}
                                                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                        {(user.first_name?.[0] || '').toUpperCase()}{(user.last_name?.[0] || '').toUpperCase()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {user.first_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {user.last_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEditUser(user)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Edit user"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
                        <button
                            onClick={() => setShowAddProject(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Project
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Description</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Assigned Users</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Created</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            Loading projects...
                                        </td>
                                    </tr>
                                ) : projects.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No projects yet. Add your first project.
                                        </td>
                                    </tr>
                                ) : (
                                    projects.map(project => (
                                        <tr key={project.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{project.name}</td>
                                            <td className="px-6 py-4 text-gray-600">{project.description || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {getAssignedUsers(project.id).map(user => (
                                                        <span
                                                            key={user.id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                                                        >
                                                            {getUserDisplayName(user)}
                                                            <button
                                                                onClick={() => handleRemoveUserFromProject(project.id, user.id)}
                                                                className="hover:text-red-600"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    <button
                                                        onClick={() => setAssigningProject(project)}
                                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Assign user"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(project.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleDeleteProject(project.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Subprojects Tab */}
            {activeTab === 'subprojects' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Subprojects</h2>
                        <button
                            onClick={() => setShowAddSubproject(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Subproject
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-500">Subproject Name</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Project</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Created</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            Loading subprojects...
                                        </td>
                                    </tr>
                                ) : subprojects.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            No subprojects yet. Add your first subproject.
                                        </td>
                                    </tr>
                                ) : (
                                    subprojects.map(sub => {
                                        const project = projects.find(p => p.id === sub.project_id);
                                        return (
                                            <tr key={sub.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{sub.name}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                        {project?.name || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {new Date(sub.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleDeleteSubproject(sub.id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete subproject"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add New User</h3>
                            <button type="button" onClick={() => { setShowAddUser(false); setAddUserError(null); }} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Error Message */}
                        {addUserError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {addUserError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newUserFirstName}
                                        onChange={(e) => setNewUserFirstName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="John"
                                        disabled={isSubmittingUser}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newUserLastName}
                                        onChange={(e) => setNewUserLastName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Doe"
                                        disabled={isSubmittingUser}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={(e) => setNewUserEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="john@example.com"
                                    disabled={isSubmittingUser}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                                <input
                                    type="password"
                                    value={newUserPassword}
                                    onChange={(e) => setNewUserPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="••••••••"
                                    disabled={isSubmittingUser}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    value={newUserRole}
                                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'member')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmittingUser}
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => { setShowAddUser(false); setAddUserError(null); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={isSubmittingUser}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddUser}
                                disabled={isSubmittingUser || !newUserFirstName.trim() || !newUserLastName.trim() || !newUserEmail.trim() || !newUserPassword.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingUser ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Add User
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit User</h3>
                            <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Avatar Upload Section */}
                        <div className="flex justify-center mb-6">
                            <button
                                onClick={() => setShowAvatarUpload(true)}
                                className="relative group"
                                type="button"
                            >
                                {editUserAvatarUrl ? (
                                    <img
                                        src={editUserAvatarUrl}
                                        alt={`${editUserFirstName} ${editUserLastName}`}
                                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-100"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-semibold border-4 border-gray-100">
                                        {(editUserFirstName[0] || '').toUpperCase()}{(editUserLastName[0] || '').toUpperCase()}
                                    </div>
                                )}
                                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white" />
                                </div>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editUserFirstName}
                                        onChange={(e) => setEditUserFirstName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editUserLastName}
                                        onChange={(e) => setEditUserLastName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    value={editUserEmail}
                                    onChange={(e) => setEditUserEmail(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400">(leave blank to keep current)</span></label>
                                <input
                                    type="password"
                                    value={editUserPassword}
                                    onChange={(e) => setEditUserPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                <select
                                    value={editUserRole}
                                    onChange={(e) => setEditUserRole(e.target.value as 'admin' | 'member')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditUser}
                                disabled={!editUserFirstName.trim() || !editUserLastName.trim() || !editUserEmail.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Project Modal */}
            {showAddProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add New Project</h3>
                            <button onClick={() => setShowAddProject(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="My Project"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newProjectDesc}
                                    onChange={(e) => setNewProjectDesc(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Project description..."
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddProject(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddProject}
                                disabled={!newProjectName.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Add Project
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign User Modal */}
            {assigningProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Assign User to {assigningProject.name}</h3>
                            <button onClick={() => setAssigningProject(null)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                            <select
                                value={selectedUserForAssignment}
                                onChange={(e) => setSelectedUserForAssignment(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a user...</option>
                                {users
                                    .filter(u => !(projectAssignments[assigningProject.id] || []).includes(u.id))
                                    .map(user => (
                                        <option key={user.id} value={user.id}>
                                            {getUserDisplayName(user)} ({user.email})
                                        </option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setAssigningProject(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignUser}
                                disabled={!selectedUserForAssignment}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <UserPlus className="w-4 h-4" />
                                Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Subproject Modal */}
            {showAddSubproject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add New Subproject</h3>
                            <button onClick={() => setShowAddSubproject(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project <span className="text-red-500">*</span></label>
                                <select
                                    value={selectedProjectForSub}
                                    onChange={(e) => setSelectedProjectForSub(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select a project...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subproject Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newSubprojectName}
                                    onChange={(e) => setNewSubprojectName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Women's Prison"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowAddSubproject(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSubproject}
                                disabled={!selectedProjectForSub || !newSubprojectName.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Add Subproject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Avatar Upload Modal */}
            {editingUser && (
                <AvatarUploadModal
                    isOpen={showAvatarUpload}
                    onClose={() => setShowAvatarUpload(false)}
                    onSave={(avatarUrl) => {
                        setEditUserAvatarUrl(avatarUrl || null);
                        setShowAvatarUpload(false);
                    }}
                    currentAvatarUrl={editUserAvatarUrl}
                    userId={editingUser.id}
                    userName={`${editUserFirstName} ${editUserLastName}`.trim()}
                />
            )}
        </div>
    );
}
