/**
 * NotionEditorLocal - Tiptap editor that saves to database
 *
 * Uses Tiptap with all features but stores content in our database,
 * not Tiptap Cloud. Content is saved on blur or after typing stops.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Typography } from '@tiptap/extension-typography';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

// Styles
import '../../@/components/tiptap-templates/notion-like/notion-like-editor.scss';

export interface NotionEditorLocalProps {
    /** Initial HTML content */
    content?: string;
    /** Called when content changes (debounced) */
    onChange?: (html: string) => void;
    /** Called on blur with final content */
    onBlur?: (html: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Additional className */
    className?: string;
    /** Auto-focus on mount */
    autoFocus?: boolean;
    /** Debounce delay for onChange in ms */
    debounceMs?: number;
}

/**
 * Local Tiptap editor that saves to database
 * Content is persisted via onChange/onBlur callbacks
 */
export function NotionEditorLocal({
    content = '',
    onChange,
    onBlur,
    placeholder = "Type '/' for commands...",
    className,
    autoFocus = false,
    debounceMs = 1000,
}: NotionEditorLocalProps) {
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedContent = useRef<string>(content);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
                emptyNodeClass: 'is-empty',
            }),
            Typography,
            Highlight.configure({ multicolor: true }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Color,
            TextStyle,
        ],
        content,
        autofocus: autoFocus,
        editorProps: {
            attributes: {
                class: 'notion-like-editor prose prose-sm max-w-none focus:outline-none min-h-[100px]',
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();

            // Debounce onChange
            if (onChange && debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            if (onChange) {
                debounceRef.current = setTimeout(() => {
                    if (html !== lastSavedContent.current) {
                        lastSavedContent.current = html;
                        onChange(html);
                    }
                }, debounceMs);
            }
        },
        onBlur: ({ editor }) => {
            // Clear any pending debounce
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }

            const html = editor.getHTML();
            if (onBlur && html !== lastSavedContent.current) {
                lastSavedContent.current = html;
                onBlur(html);
            }
        },
    });

    // Update content when prop changes (from outside)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content, { emitUpdate: false });
            lastSavedContent.current = content;
        }
    }, [content, editor]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    if (!editor) {
        return (
            <div className="animate-pulse bg-gray-100 rounded h-24" />
        );
    }

    return (
        <div className={`notion-editor-local ${className || ''}`}>
            <EditorContent editor={editor} />
        </div>
    );
}

/**
 * Display version - renders HTML content read-only
 */
export function NotionEditorLocalDisplay({
    content,
    className,
    onClick,
}: {
    content?: string;
    className?: string;
    onClick?: () => void;
}) {
    if (!content || content === '<p></p>') {
        return (
            <div
                className={`text-gray-400 text-sm italic cursor-pointer hover:bg-gray-50 p-2 rounded ${className || ''}`}
                onClick={onClick}
            >
                Click to edit...
            </div>
        );
    }

    return (
        <div
            className={`prose prose-sm max-w-none cursor-pointer hover:bg-gray-50 p-2 rounded ${className || ''}`}
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    );
}
