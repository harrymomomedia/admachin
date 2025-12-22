import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import type { Project, User } from '../../../lib/supabase-service';

interface AssignUserModalProps {
    project: Project | null;
    users: User[];
    assignedUserIds: string[];
    onClose: () => void;
    onAssign: (projectId: string, userId: string) => Promise<void>;
    getUserDisplayName: (user: User) => string;
}

export function AssignUserModal({
    project,
    users,
    assignedUserIds,
    onClose,
    onAssign,
    getUserDisplayName
}: AssignUserModalProps) {
    const [selectedUserId, setSelectedUserId] = useState('');

    if (!project) return null;

    const availableUsers = users.filter(u => !assignedUserIds.includes(u.id));

    const handleSubmit = async () => {
        if (!selectedUserId) return;
        await onAssign(project.id, selectedUserId);
        setSelectedUserId('');
    };

    const handleClose = () => {
        setSelectedUserId('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Assign User to {project.name}</h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Select a user...</option>
                        {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>
                                {getUserDisplayName(user)} ({user.email})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedUserId}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserPlus className="w-4 h-4" />
                        Assign
                    </button>
                </div>
            </div>
        </div>
    );
}
