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
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            {children}
        </div>
    );
}
