/**
 * NotionEditorCell - Full Tiptap editor for DataTable cells
 *
 * This wraps the full NotionEditor with collaboration for inline editing.
 * Each cell gets a unique room based on row ID for real-time collaboration.
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
}

/**
 * Full collaborative editor for DataTable cells
 * Content is stored in Tiptap Cloud and synced in real-time
 */
export function NotionEditorCell({
    roomId,
    roomPrefix = 'admachin',
    placeholder = "Type '/' for commands...",
    className,
}: NotionEditorCellProps) {
    // Create unique room for this cell
    const room = `${roomPrefix}-${roomId}`;

    return (
        <div className={className}>
            <NotionEditor
                room={room}
                placeholder={placeholder}
            />
        </div>
    );
}

/**
 * Display-only version for showing content in table cells
 * Shows a preview of the collaborative document
 */
export function NotionEditorCellDisplay({
    roomId,
    roomPrefix = 'admachin',
}: {
    roomId: string;
    roomPrefix?: string;
}) {
    // For display, we could either:
    // 1. Connect read-only to the collab room
    // 2. Show a cached/static version from our database
    // For now, show a placeholder that links to the full editor
    return (
        <div className="text-gray-400 text-sm italic">
            Click to edit (Collaborative)
        </div>
    );
}
