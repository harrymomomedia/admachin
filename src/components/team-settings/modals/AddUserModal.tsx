import { useState } from 'react';
import { X, Check } from 'lucide-react';

interface AddUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: {
        firstName: string;
        lastName: string;
        email: string;
        password: string;
        role: 'admin' | 'member';
    }) => Promise<void>;
}

export function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'member'>('member');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) return;
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await onAdd({ firstName, lastName, email, password, role });
            // Reset form
            setFirstName('');
            setLastName('');
            setEmail('');
            setPassword('');
            setRole('member');
            setError(null);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('already exists')) {
                setError('A user with this email already exists.');
            } else {
                setError('Failed to add user. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add New User</h3>
                    <button type="button" onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="John"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Doe"
                                disabled={isSubmitting}
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
                            placeholder="john@example.com"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isSubmitting}
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
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
    );
}
