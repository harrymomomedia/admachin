import { useEffect, useRef, useCallback, memo, useId } from 'react';
import EditorJS, { type OutputData, type API } from '@editorjs/editorjs';
// Block tools
import Header from '@editorjs/header';
import List from '@editorjs/list';
import NestedList from '@editorjs/nested-list';
import Quote from '@editorjs/quote';
import Code from '@editorjs/code';
import Checklist from '@editorjs/checklist';
import Delimiter from '@editorjs/delimiter';
import Table from '@editorjs/table';
import SimpleImage from '@editorjs/simple-image';
import Warning from '@editorjs/warning';
import Raw from '@editorjs/raw';
import Embed from '@editorjs/embed';
import Paragraph from '@editorjs/paragraph';
// Inline tools
import InlineCode from '@editorjs/inline-code';
import Marker from '@editorjs/marker';
import Underline from '@editorjs/underline';
import { cn } from '../utils/cn';

interface EditorjsEditorProps {
    content: string; // JSON string (Editor.js format) or legacy HTML
    onChange?: (json: string) => void; // Returns JSON string
    onBlur?: () => void;
    placeholder?: string;
    editable?: boolean;
    minHeight?: string;
    className?: string;
    autoFocus?: boolean;
}

// Convert HTML to Editor.js blocks
function htmlToBlocks(html: string): OutputData {
    if (!html || html.trim() === '') {
        return { time: Date.now(), blocks: [] };
    }

    // Try parsing as JSON first (Editor.js format)
    try {
        const parsed = JSON.parse(html);
        if (parsed.blocks && Array.isArray(parsed.blocks)) {
            return parsed;
        }
    } catch {
        // Not JSON, parse as HTML
    }

    // Parse HTML to blocks
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: OutputData['blocks'] = [];

    const processNode = (node: Element) => {
        const tagName = node.tagName.toLowerCase();

        switch (tagName) {
            case 'h1':
                blocks.push({ type: 'header', data: { text: node.innerHTML, level: 1 } });
                break;
            case 'h2':
                blocks.push({ type: 'header', data: { text: node.innerHTML, level: 2 } });
                break;
            case 'h3':
                blocks.push({ type: 'header', data: { text: node.innerHTML, level: 3 } });
                break;
            case 'h4':
                blocks.push({ type: 'header', data: { text: node.innerHTML, level: 4 } });
                break;
            case 'ul':
                // Check if it's a checklist
                if (node.classList.contains('checklist')) {
                    const items = Array.from(node.querySelectorAll('li')).map(li => ({
                        text: li.querySelector('span')?.innerHTML || li.textContent || '',
                        checked: li.classList.contains('checked') || li.querySelector('input[checked]') !== null
                    }));
                    blocks.push({ type: 'checklist', data: { items } });
                } else {
                    blocks.push({
                        type: 'list',
                        data: {
                            style: 'unordered',
                            items: Array.from(node.querySelectorAll(':scope > li')).map(li => li.innerHTML)
                        }
                    });
                }
                break;
            case 'ol':
                blocks.push({
                    type: 'list',
                    data: {
                        style: 'ordered',
                        items: Array.from(node.querySelectorAll(':scope > li')).map(li => li.innerHTML)
                    }
                });
                break;
            case 'blockquote':
                const quoteText = node.querySelector('p')?.innerHTML || node.innerHTML;
                const quoteCaption = node.querySelector('cite')?.innerHTML || '';
                blocks.push({
                    type: 'quote',
                    data: { text: quoteText, caption: quoteCaption }
                });
                break;
            case 'pre':
                blocks.push({
                    type: 'code',
                    data: { code: node.textContent || '' }
                });
                break;
            case 'hr':
                blocks.push({ type: 'delimiter', data: {} });
                break;
            case 'table':
                // Parse HTML table to Editor.js table format
                const rows: string[][] = [];
                const tableRows = node.querySelectorAll('tr');
                let withHeadings = false;
                tableRows.forEach((tr, index) => {
                    const cells = tr.querySelectorAll('th, td');
                    const rowData: string[] = [];
                    cells.forEach(cell => {
                        rowData.push(cell.innerHTML);
                        if (cell.tagName.toLowerCase() === 'th' && index === 0) {
                            withHeadings = true;
                        }
                    });
                    if (rowData.length > 0) {
                        rows.push(rowData);
                    }
                });
                if (rows.length > 0) {
                    blocks.push({
                        type: 'table',
                        data: { withHeadings, content: rows }
                    });
                }
                break;
            case 'figure':
                // Parse image figure
                const img = node.querySelector('img');
                if (img) {
                    const figcaption = node.querySelector('figcaption');
                    blocks.push({
                        type: 'image',
                        data: {
                            url: img.getAttribute('src') || '',
                            caption: figcaption?.innerHTML || img.getAttribute('alt') || '',
                            withBorder: node.classList.contains('with-border'),
                            withBackground: node.classList.contains('with-background'),
                            stretched: node.classList.contains('stretched')
                        }
                    });
                }
                break;
            case 'div':
                // Check for warning block
                if (node.classList.contains('editor-warning')) {
                    const title = node.querySelector('.warning-title')?.innerHTML || '';
                    const message = node.querySelector('.warning-message')?.innerHTML || '';
                    blocks.push({
                        type: 'warning',
                        data: { title, message }
                    });
                } else if (node.classList.contains('editor-embed')) {
                    // Embed block
                    const iframe = node.querySelector('iframe');
                    const caption = node.querySelector('.embed-caption')?.innerHTML || '';
                    blocks.push({
                        type: 'embed',
                        data: {
                            service: node.getAttribute('data-service') || '',
                            source: iframe?.getAttribute('src') || '',
                            caption
                        }
                    });
                } else if (node.textContent?.trim()) {
                    // Generic div - treat as paragraph
                    blocks.push({
                        type: 'paragraph',
                        data: { text: node.innerHTML }
                    });
                }
                break;
            case 'p':
            default:
                if (node.textContent?.trim()) {
                    blocks.push({
                        type: 'paragraph',
                        data: { text: node.innerHTML }
                    });
                }
                break;
        }
    };

    // Process body children
    Array.from(doc.body.children).forEach(processNode);

    // If no blocks found, treat entire content as paragraph
    if (blocks.length === 0 && html.trim()) {
        blocks.push({ type: 'paragraph', data: { text: html } });
    }

    return { time: Date.now(), blocks };
}

// Helper to render nested list items recursively
function renderNestedListItems(items: Array<{ content: string; items?: Array<unknown> }>, style: string): string {
    const tag = style === 'ordered' ? 'ol' : 'ul';
    const listItems = items.map(item => {
        let html = `<li>${item.content}`;
        if (item.items && Array.isArray(item.items) && item.items.length > 0) {
            html += renderNestedListItems(item.items as Array<{ content: string; items?: Array<unknown> }>, style);
        }
        html += '</li>';
        return html;
    }).join('');
    return `<${tag}>${listItems}</${tag}>`;
}

// Convert Editor.js blocks to HTML
function blocksToHtml(data: OutputData): string {
    if (!data.blocks || data.blocks.length === 0) {
        return '';
    }

    return data.blocks.map(block => {
        switch (block.type) {
            case 'header':
                const level = block.data.level || 1;
                return `<h${level}>${block.data.text}</h${level}>`;

            case 'paragraph':
                return `<p>${block.data.text}</p>`;

            case 'list':
                const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
                const items = block.data.items.map((item: string) => `<li>${item}</li>`).join('');
                return `<${tag}>${items}</${tag}>`;

            case 'nestedList':
                return renderNestedListItems(block.data.items, block.data.style || 'unordered');

            case 'checklist':
                const checks = block.data.items.map((item: { text: string; checked: boolean }) =>
                    `<li class="checklist-item${item.checked ? ' checked' : ''}"><input type="checkbox" ${item.checked ? 'checked' : ''} disabled /><span>${item.text}</span></li>`
                ).join('');
                return `<ul class="checklist">${checks}</ul>`;

            case 'quote':
                const caption = block.data.caption ? `<cite>${block.data.caption}</cite>` : '';
                return `<blockquote><p>${block.data.text}</p>${caption}</blockquote>`;

            case 'code':
                return `<pre><code>${block.data.code}</code></pre>`;

            case 'delimiter':
                return '<hr class="delimiter" />';

            case 'table':
                const rows = block.data.content || [];
                const withHeadings = block.data.withHeadings;
                let tableHtml = '<table class="editor-table">';
                rows.forEach((row: string[], index: number) => {
                    const cellTag = withHeadings && index === 0 ? 'th' : 'td';
                    const rowTag = withHeadings && index === 0 ? 'thead' : (index === 1 ? 'tbody' : '');
                    const rowEndTag = withHeadings && index === 0 ? '</thead>' : '';
                    if (rowTag) tableHtml += `<${rowTag}>`;
                    tableHtml += '<tr>';
                    row.forEach(cell => {
                        tableHtml += `<${cellTag}>${cell}</${cellTag}>`;
                    });
                    tableHtml += '</tr>';
                    tableHtml += rowEndTag;
                });
                if (!withHeadings || rows.length > 1) tableHtml += '</tbody>';
                tableHtml += '</table>';
                return tableHtml;

            case 'image':
            case 'simpleImage':
                const imgUrl = block.data.url || '';
                const imgCaption = block.data.caption || '';
                const stretched = block.data.stretched ? ' stretched' : '';
                const withBorder = block.data.withBorder ? ' with-border' : '';
                const withBackground = block.data.withBackground ? ' with-background' : '';
                return `<figure class="editor-image${stretched}${withBorder}${withBackground}"><img src="${imgUrl}" alt="${imgCaption}" />${imgCaption ? `<figcaption>${imgCaption}</figcaption>` : ''}</figure>`;

            case 'warning':
                return `<div class="editor-warning"><div class="warning-title">${block.data.title || ''}</div><div class="warning-message">${block.data.message || ''}</div></div>`;

            case 'raw':
                return block.data.html || '';

            case 'embed':
                const service = block.data.service || '';
                const source = block.data.source || block.data.embed || '';
                const embedCaption = block.data.caption || '';
                return `<div class="editor-embed" data-service="${service}"><iframe src="${source}" frameborder="0" allowfullscreen></iframe>${embedCaption ? `<div class="embed-caption">${embedCaption}</div>` : ''}</div>`;

            default:
                return `<p>${block.data.text || ''}</p>`;
        }
    }).join('\n');
}

export const EditorjsEditor = memo(function EditorjsEditor({
    content,
    onChange,
    onBlur,
    placeholder = "Click here to start writing...",
    editable = true,
    minHeight = '150px',
    className,
    autoFocus = false,
}: EditorjsEditorProps) {
    const editorRef = useRef<EditorJS | null>(null);
    const holderRef = useRef<HTMLDivElement>(null);
    const isReady = useRef(false);
    const isInitializing = useRef(false);
    const uniqueId = useId().replace(/:/g, '');

    // Initialize editor
    useEffect(() => {
        if (!holderRef.current || editorRef.current || isInitializing.current) return;

        isInitializing.current = true;
        const initialData = htmlToBlocks(content);

        const editor = new EditorJS({
            holder: holderRef.current,
            data: initialData,
            readOnly: !editable,
            autofocus: autoFocus,
            placeholder: placeholder,
            tools: {
                // Paragraph (default text block)
                paragraph: {
                    class: Paragraph as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        placeholder: 'Start typing or press Tab for commands...'
                    }
                },
                // Header
                header: {
                    class: Header as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        placeholder: 'Enter a heading',
                        levels: [1, 2, 3, 4],
                        defaultLevel: 2
                    }
                },
                // Lists
                list: {
                    class: List as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        defaultStyle: 'unordered'
                    }
                },
                nestedList: {
                    class: NestedList as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        defaultStyle: 'unordered'
                    }
                },
                checklist: {
                    class: Checklist as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                },
                // Quote
                quote: {
                    class: Quote as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        quotePlaceholder: 'Enter a quote',
                        captionPlaceholder: 'Quote author'
                    }
                },
                // Code
                code: {
                    class: Code as unknown as EditorJS.ToolConstructable,
                },
                // Delimiter (horizontal rule)
                delimiter: Delimiter,
                // Table
                table: {
                    class: Table as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        rows: 2,
                        cols: 3,
                        withHeadings: true
                    }
                },
                // Image (URL-based, no upload needed)
                image: {
                    class: SimpleImage as unknown as EditorJS.ToolConstructable,
                },
                // Warning/Alert block
                warning: {
                    class: Warning as unknown as EditorJS.ToolConstructable,
                    inlineToolbar: true,
                    config: {
                        titlePlaceholder: 'Title',
                        messagePlaceholder: 'Message'
                    }
                },
                // Raw HTML
                raw: {
                    class: Raw as unknown as EditorJS.ToolConstructable,
                    config: {
                        placeholder: 'Enter raw HTML code'
                    }
                },
                // Embed (YouTube, Vimeo, etc.)
                embed: {
                    class: Embed as unknown as EditorJS.ToolConstructable,
                    config: {
                        services: {
                            youtube: true,
                            vimeo: true,
                            twitter: true,
                            instagram: true,
                            facebook: true,
                            codepen: true,
                            pinterest: true,
                            github: true
                        }
                    }
                },
                // Inline tools
                inlineCode: {
                    class: InlineCode as unknown as EditorJS.ToolConstructable,
                },
                marker: {
                    class: Marker as unknown as EditorJS.ToolConstructable,
                },
                underline: Underline,
            },
            onChange: async (api: API) => {
                if (!isReady.current) return;
                try {
                    const data = await api.saver.save();
                    // Save as JSON to preserve Editor.js block structure
                    const json = JSON.stringify(data);
                    onChange?.(json);
                } catch (error) {
                    console.error('Editor.js save error:', error);
                }
            },
            onReady: () => {
                isReady.current = true;
            },
        });

        editorRef.current = editor;

        return () => {
            if (editorRef.current && editorRef.current.destroy) {
                editorRef.current.destroy();
                editorRef.current = null;
                isReady.current = false;
                isInitializing.current = false;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Handle blur
    const handleBlur = useCallback((e: React.FocusEvent) => {
        // Only trigger blur if focus is leaving the editor entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            onBlur?.();
        }
    }, [onBlur]);

    return (
        <div
            className={cn(
                "editorjs-editor",
                !editable && "pointer-events-none opacity-75",
                className
            )}
            onBlur={handleBlur}
            style={{ minHeight }}
        >
            <div
                id={`editorjs-${uniqueId}`}
                ref={holderRef}
            />
        </div>
    );
});

// Extract plain text from Editor.js blocks (for preview display)
function blocksToPlainText(data: OutputData): string {
    if (!data.blocks || data.blocks.length === 0) {
        return '';
    }

    return data.blocks.map(block => {
        switch (block.type) {
            case 'header':
            case 'paragraph':
                // Strip HTML tags from text
                return block.data.text?.replace(/<[^>]*>/g, '') || '';
            case 'list':
            case 'nestedList':
                return (block.data.items || []).map((item: string | { content: string }) =>
                    typeof item === 'string' ? item.replace(/<[^>]*>/g, '') : item.content?.replace(/<[^>]*>/g, '') || ''
                ).join(' ');
            case 'checklist':
                return (block.data.items || []).map((item: { text: string }) =>
                    item.text?.replace(/<[^>]*>/g, '') || ''
                ).join(' ');
            case 'quote':
                return block.data.text?.replace(/<[^>]*>/g, '') || '';
            case 'code':
                return block.data.code || '';
            case 'table':
                return (block.data.content || []).flat().map((cell: string) =>
                    cell?.replace(/<[^>]*>/g, '') || ''
                ).join(' ');
            case 'warning':
                return `${block.data.title || ''} ${block.data.message || ''}`.replace(/<[^>]*>/g, '');
            default:
                return block.data.text?.replace(/<[^>]*>/g, '') || '';
        }
    }).filter(Boolean).join(' ');
}

// Read-only display for Editor.js content (plain text for table cell preview)
export function EditorjsEditorDisplay({ content, className }: { content: string; className?: string }) {
    // Convert to plain text for preview
    let text = content;
    try {
        const parsed = JSON.parse(content);
        if (parsed.blocks) {
            text = blocksToPlainText(parsed);
        }
    } catch {
        // Already HTML - strip tags
        text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return (
        <span className={className}>
            {text || '-'}
        </span>
    );
}
