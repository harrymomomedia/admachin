/**
 * BlockNoteEditorCell - BlockNote editor wrapper for DataTable cells
 *
 * Provides consistent interface matching TiptapEditorCell.
 * Content is saved to our database on blur/change.
 */

import { BlockNoteEditor } from './BlockNoteEditor';

export interface BlockNoteEditorCellProps {
    /** Unique ID for the cell (e.g., row.id) */
    cellId: string;
    /** Prefix for identification (e.g., 'adcopy') */
    cellPrefix?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Additional className */
    className?: string;
    /** Initial content from database */
    initialContent?: string;
    /** Called when content should be saved to database */
    onSave?: (html: string) => void;
    /** Called on content change (debounced) */
    onChange?: (html: string) => void;
    /** Dark mode */
    darkMode?: boolean;
    /** Hide formatting menu */
    hideMenu?: boolean;
    /** Auto-focus on mount */
    autoFocus?: boolean;
}

/**
 * BlockNote editor for DataTable cells
 * Content saves to our database via onSave callback
 */
export function BlockNoteEditorCell({
    cellId,
    cellPrefix = 'blocknote',
    placeholder = "Type '/' for commands...",
    className,
    initialContent,
    onSave,
    onChange,
    darkMode = false,
    hideMenu = false,
    autoFocus = false,
}: BlockNoteEditorCellProps) {
    return (
        <div className={className} data-cell-id={`${cellPrefix}-${cellId}`}>
            <BlockNoteEditor
                initialContent={initialContent}
                placeholder={placeholder}
                onSave={onSave}
                onChange={onChange}
                darkMode={darkMode}
                hideMenu={hideMenu}
                autoFocus={autoFocus}
            />
        </div>
    );
}

/**
 * Extract text from BlockNote JSON blocks recursively
 */
function extractTextFromBlocks(blocks: unknown[]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
        if (typeof block !== 'object' || block === null) continue;

        const b = block as Record<string, unknown>;

        // Extract text from content array (inline content)
        if (Array.isArray(b.content)) {
            for (const item of b.content) {
                if (typeof item === 'object' && item !== null) {
                    const i = item as Record<string, unknown>;
                    if (typeof i.text === 'string') {
                        textParts.push(i.text);
                    }
                }
            }
        }

        // Recurse into children (nested blocks like toggle content)
        if (Array.isArray(b.children)) {
            const childText = extractTextFromBlocks(b.children);
            if (childText) textParts.push(childText);
        }
    }

    return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Display-only version for showing content in table cells
 * Shows the content from our database
 * Supports both JSON (current) and HTML (legacy) content formats
 */
export function BlockNoteEditorCellDisplay({
    content,
    onClick,
    className,
}: {
    content?: string;
    onClick?: () => void;
    className?: string;
}) {
    if (!content || content === '<p></p>' || content === '[]' || content.trim() === '') {
        return (
            <div
                className={`text-gray-400 text-sm italic ${className || ''}`}
                onClick={onClick}
            >
                Click to edit...
            </div>
        );
    }

    let textContent = '';

    // Check if content is JSON (BlockNote document format)
    if (content.startsWith('[')) {
        try {
            const blocks = JSON.parse(content);
            if (Array.isArray(blocks)) {
                textContent = extractTextFromBlocks(blocks);
            }
        } catch {
            // Not valid JSON, treat as HTML
            textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    } else {
        // Legacy HTML content - strip tags
        textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return (
        <span className={className} onClick={onClick}>
            {textContent || '-'}
        </span>
    );
}
