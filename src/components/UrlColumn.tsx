import { Link as LinkIcon } from 'lucide-react';

interface UrlColumnProps {
    value: unknown;
    isEditing?: boolean;
    maxLength?: number;
    placeholder?: string;
}

/**
 * Reusable URL column renderer for DataTable.
 * Shows truncated URL with an external link icon.
 *
 * Usage in column definition:
 * ```
 * {
 *     key: 'url_field',
 *     header: 'URL',
 *     editable: true,
 *     type: 'text',
 *     render: (value, _row, isEditing) => (
 *         <UrlColumn value={value} isEditing={isEditing} />
 *     ),
 * }
 * ```
 */
export function UrlColumn({
    value,
    isEditing = false,
    maxLength = 25,
    placeholder = '-'
}: UrlColumnProps) {
    // Let DataTable handle editing mode
    if (isEditing) return null;

    const urlStr = String(value || '');

    if (!value) {
        return <span className="text-gray-400 text-xs">{placeholder}</span>;
    }

    // Remove protocol for display
    const displayUrl = urlStr.replace(/^https?:\/\//, '');
    const truncated = displayUrl.length > maxLength
        ? `${displayUrl.slice(0, maxLength)}...`
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
