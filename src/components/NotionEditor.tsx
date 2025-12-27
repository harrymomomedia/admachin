/**
 * NotionEditor - Full Tiptap Notion-like editor with AI & Collaboration
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
 * - Comments and threads
 *
 * Required environment variables (from cloud.tiptap.dev):
 * - VITE_TIPTAP_COLLAB_DOC_PREFIX
 * - VITE_TIPTAP_COLLAB_APP_ID
 * - VITE_TIPTAP_COLLAB_TOKEN
 * - VITE_TIPTAP_AI_APP_ID
 * - VITE_TIPTAP_AI_TOKEN
 */

// Re-export the full template editor
export { NotionEditor } from '../../@/components/tiptap-templates/notion-like/notion-like-editor';

// Also export the standalone version for offline/non-collaborative use cases
export {
  NotionLikeEditorStandalone,
  NotionLikeEditorDisplay as NotionEditorDisplay,
  notionLikeContentToHtml as notionContentToHtml,
  notionLikeContentToPlainText as notionContentToPlainText,
  htmlToNotionLikeContent as htmlToNotionContent,
} from '../../@/components/tiptap-templates/notion-like/notion-like-editor-standalone';
