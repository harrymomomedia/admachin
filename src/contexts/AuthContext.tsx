import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getUsers, updateUser as updateUserInDb, type User } from '../lib/supabase-service';

const AUTH_STORAGE_KEY = 'admachin_auth_user';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => void;
    updateProfile: (data: { firstName?: string; lastName?: string; avatarUrl?: string | null }) => Promise<{ error: Error | null }>;
    updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load user from localStorage on mount
    useEffect(() => {
        const storedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUserId) {
            // Fetch the user from the database to get latest data
            getUsers().then(users => {
                const storedUser = users.find(u => u.id === storedUserId);
                setUser(storedUser || null);
                if (!storedUser) {
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                }
                setLoading(false);
            }).catch(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    const refreshUser = async () => {
        if (!user) return;
        try {
            const users = await getUsers();
            const updatedUser = users.find(u => u.id === user.id);
            if (updatedUser) {
                setUser(updatedUser);
            }
        } catch (err) {
            console.error('Failed to refresh user:', err);
        }
    };

    const signIn = async (email: string, password: string) => {
        setError(null);
        try {
            const users = await getUsers();
            const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            if (!foundUser) {
                const error = new Error('No account found with this email');
                setError(error.message);
                return { error };
            }

            // Check password (if password field exists and is set)
            // Note: For now, we'll allow login if password matches OR if password is not set
            if (foundUser.password && foundUser.password !== password) {
                const error = new Error('Incorrect password');
                setError(error.message);
                return { error };
            }

            // Login successful
            setUser(foundUser);
            localStorage.setItem(AUTH_STORAGE_KEY, foundUser.id);
            return { error: null };
        } catch (err) {
            const error = err as Error;
            setError(error.message);
            return { error };
        }
    };

    const signOut = () => {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setError(null);
    };

    const updateProfile = async (data: { firstName?: string; lastName?: string; avatarUrl?: string | null }) => {
        if (!user) {
            return { error: new Error('Not logged in') };
        }

        try {
            await updateUserInDb(user.id, {
                first_name: data.firstName,
                last_name: data.lastName,
                avatar_url: data.avatarUrl,
            });

            // Refresh user data
            await refreshUser();

            return { error: null };
        } catch (err) {
            const error = err as Error;
            setError(error.message);
            return { error };
        }
    };

    const updatePassword = async (newPassword: string) => {
        if (!user) {
            return { error: new Error('Not logged in') };
        }

        try {
            await updateUserInDb(user.id, { password: newPassword });
            return { error: null };
        } catch (err) {
            const error = err as Error;
            setError(error.message);
            return { error };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            signIn,
            signOut,
            updateProfile,
            updatePassword,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
