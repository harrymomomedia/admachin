"use client"

import { useCallback, useEffect, useRef, memo } from "react"
import { EditorContent, EditorContext, useEditor, generateHTML, generateJSON } from "@tiptap/react"
import type { JSONContent, Extensions } from "@tiptap/core"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Mention } from "@tiptap/extension-mention"
import { TaskList, TaskItem } from "@tiptap/extension-list"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Placeholder, Selection } from "@tiptap/extensions"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"
import { TextAlign } from "@tiptap/extension-text-align"
import { UniqueID } from "@tiptap/extension-unique-id"
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji"

// --- Hooks ---
import { useUiEditorState } from "@/hooks/use-ui-editor-state"

// --- Custom Extensions ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { UiState } from "@/components/tiptap-extension/ui-state-extension"
import { Image } from "@/components/tiptap-node/image-node/image-node-extension"
import { NodeBackground } from "@/components/tiptap-extension/node-background-extension"
import { NodeAlignment } from "@/components/tiptap-extension/node-alignment-extension"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"

// --- Table Node ---
import { TableKit } from "@/components/tiptap-node/table-node/extensions/table-node-extension"
import { TableHandleExtension } from "@/components/tiptap-node/table-node/extensions/table-handle"
import { TableHandle } from "@/components/tiptap-node/table-node/ui/table-handle/table-handle"
import { TableSelectionOverlay } from "@/components/tiptap-node/table-node/ui/table-selection-overlay"
import { TableCellHandleMenu } from "@/components/tiptap-node/table-node/ui/table-cell-handle-menu"
import { TableExtendRowColumnButtons } from "@/components/tiptap-node/table-node/ui/table-extend-row-column-button"
import "@/components/tiptap-node/table-node/styles/prosemirror-table.scss"
import "@/components/tiptap-node/table-node/styles/table-node.scss"

import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { EmojiDropdownMenu } from "@/components/tiptap-ui/emoji-dropdown-menu"
import { MentionDropdownMenu } from "@/components/tiptap-ui/mention-dropdown-menu"
import { SlashDropdownMenu } from "@/components/tiptap-ui/slash-dropdown-menu"
import { DragContextMenu } from "@/components/tiptap-ui/drag-context-menu"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/notion-like/notion-like-editor.scss"

// --- Custom Toolbar (without AI) ---
import { StandaloneToolbarFloating } from "./notion-like-editor-toolbar-standalone"
import { ListNormalizationExtension } from "@/components/tiptap-extension/list-normalization-extension"

// ============ Types ============

export interface NotionLikeEditorStandaloneProps {
  /** Content as JSON string (Tiptap native format) */
  content: string
  /** Called with JSON string on every change */
  onChange?: (json: string) => void
  onBlur?: () => void
  placeholder?: string
  editable?: boolean
  minHeight?: string
  className?: string
  autoFocus?: boolean
}

// ============ Extensions Configuration ============

const getExtensions = (editable: boolean, placeholder: string): Extensions => [
  StarterKit.configure({
    horizontalRule: false,
    dropcursor: {
      width: 2,
    },
    link: { openOnClick: !editable },
  }),
  HorizontalRule,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Placeholder.configure({
    placeholder,
    emptyNodeClass: "is-empty with-slash",
  }),
  Mention,
  Emoji.configure({
    emojis: gitHubEmojis.filter(
      (emoji) => !emoji.name.includes("regional")
    ),
    forceFallbackImages: true,
  }),
  TableKit.configure({
    table: {
      resizable: true,
      cellMinWidth: 120,
    },
  }),
  NodeBackground,
  NodeAlignment,
  TextStyle,
  Superscript,
  Subscript,
  Color,
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  Selection,
  Image,
  TableHandleExtension,
  ListNormalizationExtension,
  ImageUploadNode.configure({
    accept: "image/*",
    maxSize: MAX_FILE_SIZE,
    limit: 3,
    upload: handleImageUpload,
    onError: (error) => console.error("Upload failed:", error),
  }),
  UniqueID.configure({
    types: [
      "table",
      "paragraph",
      "bulletList",
      "orderedList",
      "taskList",
      "heading",
      "blockquote",
      "codeBlock",
    ],
  }),
  Typography,
  UiState,
]

// Display extensions for generateHTML
const displayExtensions: Extensions = [
  StarterKit.configure({
    horizontalRule: false,
    link: { openOnClick: true },
  }),
  HorizontalRule,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  Color,
  Superscript,
  Subscript,
  TableKit.configure({
    table: { resizable: false },
  }),
  Image,
]

// ============ Helper Functions ============

/**
 * Parse content string to JSONContent
 */
function parseContent(content: string): JSONContent {
  if (!content || content.trim() === '') {
    return { type: 'doc', content: [] }
  }

  try {
    const parsed = JSON.parse(content)
    if (parsed && parsed.type === 'doc') {
      return parsed
    }
    if (Array.isArray(parsed)) {
      return { type: 'doc', content: parsed }
    }
    return { type: 'doc', content: [] }
  } catch {
    // If not valid JSON, try to convert from HTML
    try {
      const json = generateJSON(`<p>${content}</p>`, displayExtensions)
      return json
    } catch {
      return { type: 'doc', content: [] }
    }
  }
}

/**
 * Convert JSONContent to HTML for display purposes
 */
export function notionLikeContentToHtml(content: string): string {
  if (!content || content.trim() === '') {
    return ''
  }

  try {
    const json = parseContent(content)
    return generateHTML(json, displayExtensions)
  } catch {
    return content
  }
}

/**
 * Convert HTML to JSON string for migration purposes
 */
export function htmlToNotionLikeContent(html: string): string {
  if (!html || html.trim() === '') {
    return JSON.stringify({ type: 'doc', content: [] })
  }

  try {
    const json = generateJSON(html, displayExtensions)
    return JSON.stringify(json)
  } catch {
    return JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: html }]
      }]
    })
  }
}

// ============ Editor Content Area ============

interface EditorContentAreaProps {
  editor: ReturnType<typeof useEditor>
}

function EditorContentArea({ editor }: EditorContentAreaProps) {
  const { isDragging } = useUiEditorState(editor)

  if (!editor) {
    return null
  }

  return (
    <EditorContent
      editor={editor}
      role="presentation"
      className="notion-like-editor-content"
      style={{
        cursor: isDragging ? "grabbing" : "auto",
      }}
    >
      <DragContextMenu />
      <EmojiDropdownMenu />
      <MentionDropdownMenu />
      <SlashDropdownMenu />
      <StandaloneToolbarFloating />
    </EditorContent>
  )
}

// ============ Main Editor Component ============

export const NotionLikeEditorStandalone = memo(function NotionLikeEditorStandalone({
  content,
  onChange,
  onBlur,
  placeholder = "Type '/' for commands...",
  editable = true,
  minHeight = '120px',
  className,
  autoFocus = false,
}: NotionLikeEditorStandaloneProps) {
  const contentRef = useRef(content)

  useEffect(() => {
    contentRef.current = content
  }, [content])

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "notion-like-editor",
        style: `min-height: ${minHeight}`,
      },
    },
    extensions: getExtensions(editable, placeholder),
    content: parseContent(content),
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON())
      onChange?.(json)
    },
    onBlur: () => {
      onBlur?.()
    },
  })

  // Sync content when it changes externally
  useEffect(() => {
    if (editor && content !== contentRef.current) {
      const currentJson = JSON.stringify(editor.getJSON())
      if (content !== currentJson) {
        editor.commands.setContent(parseContent(content))
      }
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div
      className={`notion-like-editor-wrapper ${className || ''}`}
      draggable={false}
      onDragStart={(e) => e.stopPropagation()}
      onDragOver={(e) => { e.stopPropagation(); e.preventDefault() }}
      onDragEnter={(e) => e.stopPropagation()}
      onDrop={(e) => e.stopPropagation()}
    >
      <EditorContext.Provider value={{ editor }}>
        <EditorContentArea editor={editor} />

        <TableExtendRowColumnButtons />
        <TableHandle />
        <TableSelectionOverlay
          showResizeHandles={true}
          cellMenu={(props) => (
            <TableCellHandleMenu
              editor={props.editor}
              onMouseDown={(e) => props.onResizeStart?.("br")(e)}
            />
          )}
        />
      </EditorContext.Provider>
    </div>
  )
})

// ============ Display Component ============

/**
 * Read-only display for Notion-like editor content
 */
export function NotionLikeEditorDisplay({ content, className }: { content: string; className?: string }) {
  const html = notionLikeContentToHtml(content)

  if (!html || html === '<p></p>') {
    return <span className={`text-gray-400 ${className || ''}`}>-</span>
  }

  return (
    <div
      className={`notion-like-editor max-w-none ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Get plain text from Notion-like content
 */
export function notionLikeContentToPlainText(content: string): string {
  if (!content || content.trim() === '') {
    return ''
  }

  try {
    const json = parseContent(content)
    const extractText = (node: JSONContent): string => {
      if (node.text) return node.text
      if (node.content) {
        return node.content.map(extractText).join('')
      }
      return ''
    }
    return extractText(json)
  } catch {
    return content
  }
}
