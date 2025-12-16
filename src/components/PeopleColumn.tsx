import { cn } from '../utils/cn';

export interface PeopleOption {
    id: string;
    first_name: string;
    last_name?: string;
    name?: string;
    email: string;
    avatar_url?: string | null;
}

interface PeopleColumnProps {
    value: unknown; // user_id
    users: PeopleOption[];
    showFullName?: boolean;
}

/**
 * Generates a consistent color based on a string (user id or name).
 * Returns a tailwind bg class.
 */
function getAvatarColor(str: string): string {
    const colors = [
        'bg-pink-500',
        'bg-purple-500',
        'bg-indigo-500',
        'bg-blue-500',
        'bg-cyan-500',
        'bg-teal-500',
        'bg-green-500',
        'bg-amber-500',
        'bg-orange-500',
        'bg-red-500',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

/**
 * Gets initials from a user's name.
 */
function getInitials(user: PeopleOption): string {
    if (user.first_name) {
        const first = user.first_name.charAt(0).toUpperCase();
        const last = user.last_name?.charAt(0).toUpperCase() || '';
        return first + last;
    }
    if (user.name) {
        const parts = user.name.split(' ');
        return parts.map(p => p.charAt(0).toUpperCase()).slice(0, 2).join('');
    }
    return user.email.charAt(0).toUpperCase();
}

/**
 * Gets display name for a user.
 */
function getDisplayName(user: PeopleOption, showFullName?: boolean): string {
    if (showFullName) {
        if (user.first_name) {
            return `${user.first_name} ${user.last_name || ''}`.trim();
        }
        return user.name || user.email;
    }
    return user.first_name || user.name?.split(' ')[0] || user.email.split('@')[0];
}

/**
 * Reusable People column renderer for DataTable.
 * Shows a circular avatar with initials/image and the user's name.
 *
 * Usage in column definition:
 * ```
 * {
 *     key: 'user_id',
 *     header: 'Owner',
 *     type: 'people',
 *     users: users, // Array of PeopleOption
 * }
 * ```
 */
export function PeopleColumn({
    value,
    users,
    showFullName = false
}: PeopleColumnProps) {
    const userId = String(value || '');
    const user = users.find(u => u.id === userId);

    if (!user) {
        return <span className="text-gray-400 text-xs">-</span>;
    }

    const initials = getInitials(user);
    const displayName = getDisplayName(user, showFullName);
    const avatarColor = getAvatarColor(user.id);

    return (
        <div className="flex items-center gap-2">
            {/* Avatar */}
            <div
                className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0",
                    !user.avatar_url && avatarColor
                )}
            >
                {user.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={displayName}
                        className="w-full h-full rounded-full object-cover"
                    />
                ) : (
                    initials
                )}
            </div>
            {/* Name */}
            <span className="text-xs text-gray-700 truncate">
                {displayName}
            </span>
        </div>
    );
}

/**
 * Avatar-only version for compact displays.
 */
export function PeopleAvatar({
    user,
    size = 'sm'
}: {
    user: PeopleOption;
    size?: 'sm' | 'md' | 'lg';
}) {
    const initials = getInitials(user);
    const avatarColor = getAvatarColor(user.id);
    const displayName = getDisplayName(user, true);

    const sizeClasses = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
    };

    return (
        <div
            className={cn(
                "rounded-full flex items-center justify-center text-white font-medium flex-shrink-0",
                sizeClasses[size],
                !user.avatar_url && avatarColor
            )}
            title={displayName}
        >
            {user.avatar_url ? (
                <img
                    src={user.avatar_url}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                initials
            )}
        </div>
    );
}
