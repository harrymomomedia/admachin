import { Link as LinkIcon } from 'lucide-react';

interface UrlCellProps {
    value: unknown;
    isEditing?: boolean;
    maxLength?: number;
    placeholder?: string;
}

/**
 * Reusable URL cell renderer for DataTable.
 * Shows truncated URL with an external link icon.
 */
export function UrlCell({
    value,
    isEditing = false,
    maxLength = 25,
    placeholder = '-'
}: UrlCellProps) {
    // Let DataTable handle editing mode
    if (isEditing) return null;

    const urlStr = String(value || '');

    if (!value) {
        return <span className="text-gray-400 text-xs">{placeholder}</span>;
    }

    // Remove protocol for display
    const displayUrl = urlStr.replace(/^https?:\/\//, '');
    // Show end of URL with ellipsis at start (right-aligned truncation)
    const truncated = displayUrl.length > maxLength
        ? `...${displayUrl.slice(-maxLength)}`
        : displayUrl;

    return (
        <div className="flex items-center gap-1.5 w-full">
            <span
                className="text-xs text-gray-700 truncate flex-1 cursor-pointer hover:text-blue-600"
                title={urlStr}
            >
                {truncated}
            </span>
            <a
                href={urlStr}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                title="Open URL"
            >
                <LinkIcon className="w-3.5 h-3.5" />
            </a>
        </div>
    );
}

// Re-export for backwards compatibility
export { UrlCell as UrlColumn };
