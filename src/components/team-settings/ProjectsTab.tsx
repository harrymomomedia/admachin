import { Plus, Trash2, UserPlus, X } from 'lucide-react';
import type { Project, User } from '../../lib/supabase-service';

interface ProjectsTabProps {
    projects: Project[];
    users: User[];
    projectAssignments: Record<string, string[]>;
    isLoading: boolean;
    onAddClick: () => void;
    onDeleteClick: (projectId: string) => void;
    onAssignUserClick: (project: Project) => void;
    onRemoveUserFromProject: (projectId: string, userId: string) => void;
    getUserDisplayName: (user: User) => string;
}

export function ProjectsTab({
    projects,
    users,
    projectAssignments,
    isLoading,
    onAddClick,
    onDeleteClick,
    onAssignUserClick,
    onRemoveUserFromProject,
    getUserDisplayName
}: ProjectsTabProps) {
    const getAssignedUsers = (projectId: string): User[] => {
        const userIds = projectAssignments[projectId] || [];
        return users.filter(u => userIds.includes(u.id));
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
                <button
                    onClick={onAddClick}
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
                                                        onClick={() => onRemoveUserFromProject(project.id, user.id)}
                                                        className="hover:text-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                            <button
                                                onClick={() => onAssignUserClick(project)}
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
                                            onClick={() => onDeleteClick(project.id)}
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
    );
}
