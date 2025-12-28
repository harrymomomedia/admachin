/**
 * BlockNoteEditor - Block-based rich text editor
 *
 * Uses BlockNote (built on Tiptap/Prosemirror) for a Notion-style
 * block editor experience. Content is saved to our database on blur/change.
 * Images are uploaded to Supabase storage.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

// BlockNote native styles - use these as-is
import '@blocknote/core/fonts/inter.css';
import '@blocknote/react/style.css'; // Side menu height adjustments for different block types
import '@blocknote/mantine/style.css';

// Layout-only styles (padding for inline/fullscreen modes)
import './blocknote-editor.scss';

// Supabase storage upload
import { uploadFileToStorage } from '../lib/supabase';

export interface BlockNoteEditorProps {
    /** Initial HTML content (will be converted to blocks) */
    initialContent?: string;
    /** Called when content changes (debounced) */
    onChange?: (html: string) => void;
    /** Called on blur with final content */
    onSave?: (html: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Additional className for the wrapper */
    className?: string;
    /** Auto-focus on mount */
    autoFocus?: boolean;
    /** Debounce delay for onChange in ms */
    debounceMs?: number;
    /** Dark mode */
    darkMode?: boolean;
    /** Hide the formatting menu */
    hideMenu?: boolean;
}

/**
 * Upload handler for BlockNote images
 * Uploads to Supabase storage and returns the public URL
 */
async function uploadFile(file: File): Promise<string> {
    try {
        const url = await uploadFileToStorage(file, 'editor-uploads', 'blocknote');
        return url;
    } catch (error) {
        console.error('Failed to upload file:', error);
        throw error;
    }
}

/**
 * BlockNote editor component
 * Content is persisted via onChange/onSave callbacks
 */
export function BlockNoteEditor({
    initialContent = '',
    onChange,
    onSave,
    placeholder = "Type '/' for commands...",
    className,
    autoFocus = false,
    debounceMs = 1000,
    darkMode = false,
    hideMenu = false,
}: BlockNoteEditorProps) {
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContent = useRef<string>(initialContent);
    const isInitialized = useRef(false);

    // Create the BlockNote editor with upload handler
    const editor = useCreateBlockNote({
        uploadFile, // Enable image uploads to Supabase
        domAttributes: {
            editor: {
                class: 'blocknote-editor-content',
            },
        },
    });

    // Set initial content after editor is created
    // Supports both JSON (preferred, preserves all block types) and HTML (legacy fallback)
    useEffect(() => {
        if (editor && initialContent && !isInitialized.current) {
            isInitialized.current = true;
            const parseAndSetContent = async () => {
                try {
                    if (initialContent && initialContent !== '<p></p>' && initialContent !== '[]') {
                        // Try to parse as JSON first (preserves toggles, etc.)
                        if (initialContent.startsWith('[')) {
                            try {
                                const blocks = JSON.parse(initialContent);
                                if (Array.isArray(blocks) && blocks.length > 0) {
                                    editor.replaceBlocks(editor.document, blocks);
                                    return;
                                }
                            } catch {
                                // Not valid JSON, fall through to HTML parsing
                            }
                        }
                        // Fallback: parse as HTML (for legacy content)
                        const blocks = await editor.tryParseHTMLToBlocks(initialContent);
                        if (blocks && blocks.length > 0) {
                            editor.replaceBlocks(editor.document, blocks);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse initial content:', e);
                }
            };
            parseAndSetContent();
        }
    }, [editor, initialContent]);

    // Convert blocks to JSON (preserves all block types including toggles)
    const getContent = useCallback((): string => {
        if (!editor) return '[]';
        try {
            // Use JSON to preserve all block types (toggle, etc.)
            return JSON.stringify(editor.document);
        } catch (e) {
            console.warn('Failed to convert blocks to JSON:', e);
            return '[]';
        }
    }, [editor]);

    // Handle content changes - fires immediately so parent state stays current
    // This ensures editingValue in DataTable is always up-to-date when popup closes
    const handleChange = useCallback(() => {
        if (!onChange) return;

        // Clear any pending debounce (for onSave, not onChange)
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Fire onChange immediately so parent state is always current
        const content = getContent();
        if (content !== lastSavedContent.current) {
            onChange(content);
        }

        // Debounce onSave separately (auto-save to database)
        if (onSave) {
            debounceRef.current = setTimeout(() => {
                const currentContent = getContent();
                if (currentContent !== lastSavedContent.current) {
                    lastSavedContent.current = currentContent;
                    onSave(currentContent);
                }
            }, debounceMs);
        }
    }, [onChange, onSave, getContent, debounceMs]);

    // Handle blur
    const handleBlur = useCallback(() => {
        // Clear any pending debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }

        if (onSave) {
            const content = getContent();
            if (content !== lastSavedContent.current) {
                lastSavedContent.current = content;
                onSave(content);
            }
        }
    }, [onSave, getContent]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    // Auto-focus
    useEffect(() => {
        if (autoFocus && editor) {
            editor.focus();
        }
    }, [autoFocus, editor]);

    if (!editor) {
        return (
            <div className="animate-pulse bg-gray-100 rounded h-24" />
        );
    }

    return (
        <div
            className={`blocknote-editor-wrapper ${darkMode ? 'dark' : ''} ${className || ''}`}
            onBlur={handleBlur}
        >
            <BlockNoteView
                editor={editor}
                onChange={handleChange}
                theme={darkMode ? 'dark' : 'light'}
                formattingToolbar={!hideMenu}
                slashMenu={true}
                sideMenu={true}
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
 * Display version - renders BlockNote content as read-only text
 * Supports both JSON (current) and HTML (legacy) content formats
 */
export function BlockNoteEditorDisplay({
    content,
    className,
    onClick,
}: {
    content?: string;
    className?: string;
    onClick?: () => void;
}) {
    if (!content || content === '<p></p>' || content === '[]' || content.trim() === '') {
        return (
            <div
                className={`text-gray-400 text-sm italic cursor-pointer hover:bg-gray-50 p-2 rounded ${className || ''}`}
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
        <span
            className={className}
            onClick={onClick}
        >
            {textContent || '-'}
        </span>
    );
}
