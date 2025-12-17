import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Settings, LogOut, ChevronUp, User } from 'lucide-react';
import { cn } from '../utils/cn';

interface UserProfileDropdownProps {
    isCollapsed?: boolean;
}

export function UserProfileDropdown({ isCollapsed = false }: UserProfileDropdownProps) {
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
    const firstName = user.first_name || user.email.split('@')[0];
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
                className={cn(
                    "flex items-center gap-3 rounded-md text-sm font-medium transition-colors w-full",
                    isCollapsed ? "justify-center p-2" : "px-3 py-2",
                    "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={isCollapsed ? displayName : undefined}
            >
                {/* Avatar */}
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={displayName}
                        className="h-8 w-8 rounded-full object-cover shadow-sm flex-shrink-0"
                    />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium shadow-sm text-sm flex-shrink-0">
                        {initials}
                    </div>
                )}

                {!isCollapsed && (
                    <>
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                                {firstName}
                                {role === 'admin' && (
                                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                                        {role}
                                    </span>
                                )}
                            </div>
                        </div>
                        <ChevronUp className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                            isOpen && "rotate-180"
                        )} />
                    </>
                )}
            </button>

            {/* Dropdown Menu - Opens upward */}
            {isOpen && (
                <div className={cn(
                    "absolute bottom-full mb-2 bg-card rounded-lg shadow-lg border border-border py-2 z-50",
                    isCollapsed ? "left-full ml-2 bottom-0 mb-0 w-56" : "left-0 right-0 min-w-[200px]"
                )}>
                    {/* User Info (when collapsed) */}
                    {isCollapsed && (
                        <div className="px-4 py-2 border-b border-border mb-2">
                            <div className="font-medium text-foreground">{displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{email}</div>
                        </div>
                    )}

                    {/* Menu Items */}
                    <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        Admin
                    </Link>

                    <Link
                        to="/settings"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                        <User className="h-4 w-4 text-muted-foreground" />
                        Profile
                    </Link>

                    <div className="border-t border-border my-2" />

                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors w-full"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
