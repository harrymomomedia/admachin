import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings, LogOut, ChevronDown, User } from 'lucide-react';

export function UserProfileDropdown() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    // Get display info from user
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
    const email = user.email;
    const role = user.role || 'member';

    // Get initials
    const initials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    const handleSignOut = () => {
        setIsOpen(false);
        signOut();
        navigate('/login');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-border hover:bg-muted/50 px-2 py-1 rounded-lg transition-colors"
            >
                <div className="text-right hidden md:block">
                    <div className="text-sm font-semibold text-foreground">
                        {displayName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        {email.length > 20 ? email.slice(0, 20) + '...' : email}
                        {role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                                {role}
                            </span>
                        )}
                    </div>
                </div>

                {/* Avatar */}
                <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm text-sm">
                    {initials}
                </div>

                <ChevronDown className={`h-4 w-4 text-muted-foreground hidden md:block transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    {/* User Info (Mobile) */}
                    <div className="md:hidden px-4 py-2 border-b border-gray-100 mb-2">
                        <div className="font-medium text-gray-900">{displayName}</div>
                        <div className="text-xs text-gray-500 truncate">{email}</div>
                    </div>

                    {/* Menu Items */}
                    <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <Settings className="h-4 w-4 text-gray-400" />
                        Admin
                    </Link>

                    <Link
                        to="/settings"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <User className="h-4 w-4 text-gray-400" />
                        Profile
                    </Link>

                    <div className="border-t border-gray-100 my-2" />

                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
