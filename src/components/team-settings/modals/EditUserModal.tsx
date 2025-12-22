import { useState, useEffect } from 'react';
import { X, Check, Camera } from 'lucide-react';
import { AvatarUploadModal } from '../../AvatarUploadModal';
import type { User } from '../../../lib/supabase-service';

interface EditUserModalProps {
    user: User | null;
    onClose: () => void;
    onSave: (userId: string, data: {
        firstName: string;
        lastName: string;
        email: string;
        password?: string;
        role: 'admin' | 'member';
        avatarUrl: string | null;
    }) => Promise<void>;
}

export function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'member'>('member');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [showAvatarUpload, setShowAvatarUpload] = useState(false);

    // Reset form when user changes
    useEffect(() => {
        if (user) {
            setFirstName(user.first_name || '');
            setLastName(user.last_name || '');
            setEmail(user.email);
            setPassword('');
            setRole((user.role as 'admin' | 'member') || 'member');
            setAvatarUrl(user.avatar_url || null);
        }
    }, [user]);

    if (!user) return null;

    const handleSubmit = async () => {
        if (!firstName.trim() || !lastName.trim() || !email.trim()) return;

        await onSave(user.id, {
            firstName,
            lastName,
            email,
            password: password || undefined,
            role,
            avatarUrl
        });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Edit User</h3>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={`${firstName} ${lastName}`}
                                    className="w-20 h-20 rounded-full object-cover border-4 border-gray-100"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-semibold border-4 border-gray-100">
                                    {(firstName[0] || '').toUpperCase()}{(lastName[0] || '').toUpperCase()}
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
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400">(leave blank to keep current)</span></label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!firstName.trim() || !lastName.trim() || !email.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Avatar Upload Modal */}
            <AvatarUploadModal
                isOpen={showAvatarUpload}
                onClose={() => setShowAvatarUpload(false)}
                onSave={(url) => {
                    setAvatarUrl(url || null);
                    setShowAvatarUpload(false);
                }}
                currentAvatarUrl={avatarUrl}
                userId={user.id}
                userName={`${firstName} ${lastName}`.trim()}
            />
        </>
    );
}
