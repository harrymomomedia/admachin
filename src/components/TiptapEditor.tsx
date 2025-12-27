/**
 * TiptapEditor - Full Tiptap Notion-like editor with AI & Collaboration
 *
 * This uses the official Tiptap Notion-like template with all features:
 * - Real-time collaboration with live cursors
 * - AI writing assistant (generate, improve, summarize)
 * - Slash commands for blocks (headings, lists, quotes, code, tables, etc.)
 * - Drag & drop block reordering
 * - Floating toolbar for inline formatting
 * - Emoji picker and mentions
 * - Tables with resize handles
 * - Image uploads
 *
 * Usage:
 *   <TiptapEditor room="document-id" placeholder="Start writing..." />
 *
 * Each document needs a unique room ID for collaboration.
 * For DataTable cells, use: room={`adcopy-${row.id}`}
 */

// Re-export the full collaborative template editor with all features
// The underlying component is still called NotionEditor in the tiptap-templates
// but we export it as TiptapEditor for our app's naming convention
export { NotionEditor as TiptapEditor } from '../../@/components/tiptap-templates/notion-like/notion-like-editor';
export type { NotionEditorProps as TiptapEditorProps } from '../../@/components/tiptap-templates/notion-like/notion-like-editor';

// Re-export contexts for advanced usage
export { useCollab, CollabProvider } from '../../@/contexts/collab-context';
export { useAi, AiProvider } from '../../@/contexts/ai-context';
export { useUser, UserProvider } from '../../@/contexts/user-context';
export { AppProvider } from '../../@/contexts/app-context';
