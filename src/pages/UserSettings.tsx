import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, Save, Loader2, Check, AlertCircle } from 'lucide-react';

export function UserSettings() {
    const { user, updateProfile, updatePassword, refreshUser } = useAuth();

    // Profile state
    const [firstName, setFirstName] = useState(user?.first_name || '');
    const [lastName, setLastName] = useState(user?.last_name || '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileSuccess(false);
        setProfileError(null);

        const { error } = await updateProfile({ firstName, lastName });

        if (error) {
            setProfileError(error.message);
        } else {
            setProfileSuccess(true);
            await refreshUser();
            setTimeout(() => setProfileSuccess(false), 3000);
        }

        setProfileLoading(false);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordSuccess(false);
        setPasswordError(null);

        // Verify current password
        if (user?.password && currentPassword !== user.password) {
            setPasswordError('Current password is incorrect');
            setPasswordLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            setPasswordLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            setPasswordLoading(false);
            return;
        }

        const { error } = await updatePassword(newPassword);

        if (error) {
            setPasswordError(error.message);
        } else {
            setPasswordSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(false), 3000);
        }

        setPasswordLoading(false);
    };

    // Get display info
    const displayName = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
        : 'User';

    const initials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
            </div>

            {/* Profile Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
                        <p className="text-sm text-gray-500">Update your personal information</p>
                    </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-5">
                    {/* Avatar Display */}
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                            {initials}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">{displayName || 'User'}</p>
                            <p className="text-xs text-gray-500">{user?.email}</p>
                            {user?.role && (
                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                    {user.role}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* First Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            First Name
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter your first name"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Last Name
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter your last name"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                    </div>

                    {/* Error/Success Messages */}
                    {profileError && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            {profileError}
                        </div>
                    )}
                    {profileSuccess && (
                        <div className="flex items-center gap-2 bg-green-50 text-green-600 text-sm p-3 rounded-xl border border-green-100">
                            <Check className="h-4 w-4 flex-shrink-0" />
                            Profile updated successfully!
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={profileLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                        {profileLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </button>
                </form>
            </div>

            {/* Password Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-50 rounded-lg">
                        <Lock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Password</h2>
                        <p className="text-sm text-gray-500">Update your password</p>
                    </div>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        {!user?.password && (
                            <p className="text-xs text-gray-400 mt-1">Leave blank if no password is currently set</p>
                        )}
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Error/Success Messages */}
                    {passwordError && (
                        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            {passwordError}
                        </div>
                    )}
                    {passwordSuccess && (
                        <div className="flex items-center gap-2 bg-green-50 text-green-600 text-sm p-3 rounded-xl border border-green-100">
                            <Check className="h-4 w-4 flex-shrink-0" />
                            Password updated successfully!
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={passwordLoading || !newPassword || !confirmPassword}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                        {passwordLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Lock className="h-4 w-4" />
                        )}
                        Update Password
                    </button>
                </form>
            </div>
        </div>
    );
}
