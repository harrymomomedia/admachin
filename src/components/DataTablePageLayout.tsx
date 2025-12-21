import type { ReactNode } from 'react';

interface DataTablePageLayoutProps {
    children: ReactNode;
}

/**
 * Shared layout component for pages that contain a DataTable.
 * DataTable now handles its own toolbar with title, quick filters, and actions.
 * This layout just provides the flex container structure.
 */
export function DataTablePageLayout({
    children
}: DataTablePageLayoutProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 max-w-full h-full">
            {/* Content (DataTable) - flex-1 ensures it fills remaining space */}
            <div className="flex-1 flex flex-col min-h-0">
                {children}
            </div>
        </div>
    );
}
