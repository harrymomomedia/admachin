/**
 * TiptapEditorCell - Full Tiptap editor for DataTable cells
 *
 * Uses Tiptap Cloud for collaboration and AI, but ALSO syncs
 * content back to our database on blur/change.
 */

import { TiptapEditor } from './TiptapEditor';

export interface TiptapEditorCellProps {
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
    /** Hide the header bar with undo/redo and theme toggle */
    hideHeader?: boolean;
}

/**
 * Full collaborative editor for DataTable cells
 * Content syncs to Tiptap Cloud AND saves to our database
 */
export function TiptapEditorCell({
    roomId,
    roomPrefix = 'admachin',
    placeholder = "Type '/' for commands...",
    className,
    initialContent,
    onSave,
    hideHeader = false,
}: TiptapEditorCellProps) {
    // Create unique room for this cell
    const room = `${roomPrefix}-${roomId}`;

    return (
        <div className={className}>
            <TiptapEditor
                room={room}
                placeholder={placeholder}
                initialContent={initialContent}
                onSave={onSave}
                hideHeader={hideHeader}
            />
        </div>
    );
}

/**
 * Display-only version for showing content in table cells
 * Shows the content from our database
 */
export function TiptapEditorCellDisplay({
    content,
    onClick,
}: {
    content?: string;
    onClick?: () => void;
}) {
    if (!content || content === '<p></p>' || content.trim() === '') {
        return (
            <div
                className="text-gray-400 text-sm italic"
                onClick={onClick}
            >
                Click to edit...
            </div>
        );
    }

    // Strip HTML tags for clean display in table cells
    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    return (
        <span onClick={onClick}>
            {textContent || '-'}
        </span>
    );
}
