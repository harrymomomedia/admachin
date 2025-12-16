import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

interface DataTablePageLayoutProps {
    title: string;
    subtitle?: string;
    onNewClick?: () => void;
    newButtonLabel?: string;
    children: ReactNode;
}

/**
 * Shared layout component for pages that contain a DataTable.
 * Provides consistent styling for header, spacing, and "New" button.
 */
export function DataTablePageLayout({
    title,
    subtitle,
    onNewClick,
    newButtonLabel = 'New',
    children
}: DataTablePageLayoutProps) {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header Bar */}
            <div className="flex items-center justify-between flex-shrink-0 px-3 py-1.5 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                    <h1 className="text-sm font-semibold text-foreground">{title}</h1>
                    {subtitle && (
                        <span className="text-xs text-muted-foreground">{subtitle}</span>
                    )}
                </div>
                {onNewClick && (
                    <button
                        onClick={onNewClick}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                        {newButtonLabel}
                    </button>
                )}
            </div>

            {/* Content (DataTable) */}
            {children}
        </div>
    );
}
