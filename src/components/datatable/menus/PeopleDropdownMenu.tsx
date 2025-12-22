import { useState, useRef, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { PeopleOption } from '../types';
import { getAvatarColor, getInitials } from '../cells/PeopleCell';

interface PeopleDropdownMenuProps {
    users: PeopleOption[];
    value: string;
    onSelect: (value: string) => void;
    onClear?: () => void;
    position: { top: number; left: number };
}

export function PeopleDropdownMenu({ users, value, onSelect, onClear, position }: PeopleDropdownMenuProps) {
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const dropdownHeight = rect.height;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - position.top - 10;

            if (spaceBelow < dropdownHeight && position.top > dropdownHeight) {
                setAdjustedPosition({
                    ...position,
                    top: position.top - dropdownHeight - 8
                });
            } else {
                setAdjustedPosition(position);
            }
        }
    }, [position]);

    const filteredUsers = users.filter(user => {
        const searchLower = search.toLowerCase();
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
        return fullName.includes(searchLower) || user.email.toLowerCase().includes(searchLower);
    });

    const selectedUser = users.find(u => u.id === value);

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] overflow-hidden"
            style={{ top: adjustedPosition.top, left: adjustedPosition.left, maxHeight: 'calc(100vh - 20px)' }}
        >
            {/* Selected user with X to clear */}
            {selectedUser && value && (
                <div className="p-2 border-b border-gray-100">
                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        <div
                            className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-medium flex-shrink-0",
                                !selectedUser.avatar_url && getAvatarColor(selectedUser.id)
                            )}
                        >
                            {selectedUser.avatar_url ? (
                                <img src={selectedUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                getInitials(selectedUser)
                            )}
                        </div>
                        {selectedUser.first_name || selectedUser.name || selectedUser.email}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear?.();
                            }}
                            className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                </div>
            )}

            {/* Search Input */}
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find a person"
                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                </div>
            </div>

            {/* Hint text */}
            <div className="px-3 py-1.5 text-[10px] text-gray-400">
                Select a person
            </div>

            {/* Users List */}
            <div className="max-h-[200px] overflow-y-auto py-1">
                {filteredUsers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic whitespace-nowrap">
                        No people found
                    </div>
                ) : (
                    filteredUsers.map((user) => (
                        <div
                            key={user.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(user.id);
                            }}
                            className={cn(
                                "px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2",
                                user.id === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                            )}
                        >
                            {/* Avatar */}
                            <div
                                className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0",
                                    !user.avatar_url && getAvatarColor(user.id)
                                )}
                            >
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    getInitials(user)
                                )}
                            </div>
                            {/* Name */}
                            <span className="flex-1">
                                {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user.name || user.email)}
                            </span>
                            {user.id === value && (
                                <Check className="w-3.5 h-3.5 text-blue-600 ml-auto" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
