import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { User } from '../../lib/supabase-service';

interface UsersTabProps {
    users: User[];
    isLoading: boolean;
    onAddClick: () => void;
    onEditClick: (user: User) => void;
    onDeleteClick: (userId: string) => void;
}

export function UsersTab({
    users,
    isLoading,
    onAddClick,
    onEditClick,
    onDeleteClick
}: UsersTabProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Users</h2>
                <button
                    onClick={onAddClick}
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
                                                onClick={() => onEditClick(user)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Edit user"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteClick(user.id)}
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
    );
}
