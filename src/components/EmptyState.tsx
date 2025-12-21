import type { LucideIcon } from 'lucide-react';
import { FileQuestion, Image, Video, FileText, BarChart3 } from 'lucide-react';
import { cn } from '../utils/cn';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: 'default' | 'compact';
    className?: string;
}

// Pre-defined empty states for common use cases
export const emptyStatePresets = {
    adCopy: {
        icon: FileText,
        title: 'No ad copy yet',
        description: 'Create your first ad copy to get started.',
    },
    creatives: {
        icon: Image,
        title: 'No creatives uploaded',
        description: 'Upload images or videos to use in your ads.',
    },
    videos: {
        icon: Video,
        title: 'No videos generated',
        description: 'Generate AI videos to see them here.',
    },
    plans: {
        icon: BarChart3,
        title: 'No ad plans yet',
        description: 'Create a plan to organize your ad campaigns.',
    },
    search: {
        icon: FileQuestion,
        title: 'No results found',
        description: 'Try adjusting your search or filters.',
    },
};

export function EmptyState({
    icon: Icon = FileQuestion,
    title,
    description,
    action,
    variant = 'default',
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center text-center",
                variant === 'default' ? "py-16 px-4" : "py-8 px-4",
                className
            )}
        >
            <div
                className={cn(
                    "rounded-full bg-gray-100 flex items-center justify-center mb-4",
                    variant === 'default' ? "w-16 h-16" : "w-12 h-12"
                )}
            >
                <Icon
                    className={cn(
                        "text-gray-400",
                        variant === 'default' ? "w-8 h-8" : "w-6 h-6"
                    )}
                />
            </div>
            <h3
                className={cn(
                    "font-semibold text-gray-900",
                    variant === 'default' ? "text-lg" : "text-base"
                )}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        "text-gray-500 mt-1 max-w-sm",
                        variant === 'default' ? "text-sm" : "text-xs"
                    )}
                >
                    {description}
                </p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className={cn(
                        "mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium",
                        variant === 'default' ? "text-sm" : "text-xs"
                    )}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
