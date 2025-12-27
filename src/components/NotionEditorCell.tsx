/**
 * NotionEditorCell - Full Tiptap editor for DataTable cells
 *
 * Uses Tiptap Cloud for collaboration and AI, but ALSO syncs
 * content back to our database on blur/change.
 */

import { NotionEditor } from './NotionEditor';

export interface NotionEditorCellProps {
    /** Unique ID for collaboration room (e.g., row.id) */
    roomId: string;
    /** Prefix for the room (e.g., 'adcopy') */
    roomPrefix?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Additional className */
    className?: string;
    /** Initial content from database */
    initialContent?: string;
    /** Called when content should be saved to database */
    onSave?: (html: string) => void;
}

/**
 * Full collaborative editor for DataTable cells
 * Content syncs to Tiptap Cloud AND saves to our database
 */
export function NotionEditorCell({
    roomId,
    roomPrefix = 'admachin',
    placeholder = "Type '/' for commands...",
    className,
    initialContent,
    onSave,
}: NotionEditorCellProps) {
    // Create unique room for this cell
    const room = `${roomPrefix}-${roomId}`;

    return (
        <div className={className}>
            <NotionEditor
                room={room}
                placeholder={placeholder}
                initialContent={initialContent}
                onSave={onSave}
            />
        </div>
    );
}

/**
 * Display-only version for showing content in table cells
 * Shows the content from our database
 */
export function NotionEditorCellDisplay({
    content,
    onClick,
}: {
    content?: string;
    onClick?: () => void;
}) {
    if (!content || content === '<p></p>' || content.trim() === '') {
        return (
            <div
                className="text-gray-400 text-sm italic cursor-pointer hover:bg-gray-50 p-2 rounded"
                onClick={onClick}
            >
                Click to edit...
            </div>
        );
    }

    return (
        <div
            className="prose prose-sm max-w-none cursor-pointer hover:bg-gray-50 p-2 rounded line-clamp-3"
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}
