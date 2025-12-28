"use client"

import { useContext, useEffect, useRef } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import type { Doc as YDoc } from "yjs"
import type { TiptapCollabProvider } from "@tiptap-pro/provider"
import { createPortal } from "react-dom"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Mention } from "@tiptap/extension-mention"
import { TaskList, TaskItem } from "@tiptap/extension-list"
import { Color, TextStyle } from "@tiptap/extension-text-style"
import { Placeholder, Selection } from "@tiptap/extensions"
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration"
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Superscript } from "@tiptap/extension-superscript"
import { Subscript } from "@tiptap/extension-subscript"
import { TextAlign } from "@tiptap/extension-text-align"
import { Mathematics } from "@tiptap/extension-mathematics"
import { Ai } from "@tiptap-pro/extension-ai"
import { UniqueID } from "@tiptap/extension-unique-id"
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji"

// --- Hooks ---
import { useUiEditorState } from "@/hooks/use-ui-editor-state"
import { useScrollToHash } from "@/components/tiptap-ui/copy-anchor-link-button/use-scroll-to-hash"

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
import { AiMenu } from "@/components/tiptap-ui/ai-menu"

// --- Contexts ---
import { AppProvider } from "@/contexts/app-context"
import { UserProvider, useUser } from "@/contexts/user-context"
import { CollabProvider, useCollab } from "@/contexts/collab-context"
import { AiProvider, useAi } from "@/contexts/ai-context"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"
import { TIPTAP_AI_APP_ID } from "@/lib/tiptap-collab-utils"

// --- Styles ---
import "@/components/tiptap-templates/notion-like/notion-like-editor.scss"

// --- Content ---
import { NotionEditorHeader } from "@/components/tiptap-templates/notion-like/notion-like-editor-header"
import { MobileToolbar } from "@/components/tiptap-templates/notion-like/notion-like-editor-mobile-toolbar"
import { NotionToolbarFloating } from "@/components/tiptap-templates/notion-like/notion-like-editor-toolbar-floating"
import { ListNormalizationExtension } from "@/components/tiptap-extension/list-normalization-extension"

export interface NotionEditorProps {
  room: string
  placeholder?: string
  /** Initial HTML content from database */
  initialContent?: string
  /** Called when content should be saved to database (on blur/change) */
  onSave?: (html: string) => void
  /** Hide the header bar with undo/redo and theme toggle */
  hideHeader?: boolean
}

export interface EditorProviderProps {
  provider: TiptapCollabProvider | null
  ydoc: YDoc
  placeholder?: string
  aiToken: string | null
  /** Initial HTML content from database */
  initialContent?: string
  /** Called when content should be saved to database */
  onSave?: (html: string) => void
  /** Hide the header bar with undo/redo and theme toggle */
  hideHeader?: boolean
}

/**
 * Loading spinner component shown while connecting to the notion server
 */
export function LoadingSpinner({ text = "Connecting..." }: { text?: string }) {
  return (
    <div className="spinner-container">
      <div className="spinner-content">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="spinner-loading-text">{text}</div>
      </div>
    </div>
  )
}

/**
 * EditorContent component that renders the actual editor
 */
export function EditorContentArea() {
  const { editor } = useContext(EditorContext)!
  const {
    aiGenerationIsLoading,
    aiGenerationIsSelection,
    aiGenerationHasMessage,
    isDragging,
  } = useUiEditorState(editor)

  // Selection based effect to handle AI generation acceptance
  useEffect(() => {
    if (!editor) return

    if (
      !aiGenerationIsLoading &&
      aiGenerationIsSelection &&
      aiGenerationHasMessage
    ) {
      editor.chain().focus().aiAccept().run()
      editor.commands.resetUiState()
    }
  }, [
    aiGenerationHasMessage,
    aiGenerationIsLoading,
    aiGenerationIsSelection,
    editor,
  ])

  useScrollToHash()

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
      <AiMenu />
      <EmojiDropdownMenu />
      <MentionDropdownMenu />
      <SlashDropdownMenu />
      <NotionToolbarFloating />

      {createPortal(<MobileToolbar />, document.body)}
    </EditorContent>
  )
}

/**
 * Component that creates and provides the editor instance
 */
export function EditorProvider(props: EditorProviderProps) {
  const { provider, ydoc, placeholder = "Start writing...", aiToken, initialContent, onSave, hideHeader = false } = props

  const { user } = useUser()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContent = useRef<string>(initialContent || '')

  // For inline editors (DataTable cells), we don't use collaboration
  // Database is always source of truth - collaboration was causing content duplication
  // by syncing cached cloud content THEN adding database content on top
  const useCollaboration = false // Disabled - each cell has unique room, no real-time collab needed

  // Build collaboration extensions only when provider is available AND collaboration is enabled
  const collabExtensions = (provider && useCollaboration) ? [
    Collaboration.configure({ document: ydoc }),
    CollaborationCaret.configure({
      provider,
      user: { id: user.id, name: user.name, color: user.color },
    }),
  ] : []

  const editor = useEditor({
    immediatelyRender: false,
    // Always set initial content from database (source of truth)
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: "notion-like-editor",
      },
    },
    onBlur: ({ editor }) => {
      // Save to database on blur
      if (onSave) {
        const html = editor.getHTML()
        if (html !== lastSavedContent.current) {
          lastSavedContent.current = html
          onSave(html)
        }
      }
    },
    onUpdate: ({ editor }) => {
      // Debounced save on update
      if (onSave && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (onSave) {
        saveTimeoutRef.current = setTimeout(() => {
          const html = editor.getHTML()
          if (html !== lastSavedContent.current) {
            lastSavedContent.current = html
            onSave(html)
          }
        }, 2000) // Save 2 seconds after last change
      }
    },
    extensions: [
      StarterKit.configure({
        undoRedo: useCollaboration ? false : {}, // Enable undo/redo when not using collaboration
        horizontalRule: false,
        dropcursor: {
          width: 2,
        },
        link: { openOnClick: false },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ...collabExtensions,
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
      Mathematics,
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
        filterTransaction: (transaction) => !isChangeOrigin(transaction),
      }),
      Typography,
      UiState,
      Ai.configure({
        appId: TIPTAP_AI_APP_ID,
        token: aiToken || undefined,
        autocompletion: false,
        showDecorations: true,
        hideDecorationsOnStreamEnd: false,
        onLoading: (context) => {
          context.editor.commands.aiGenerationSetIsLoading(true)
          context.editor.commands.aiGenerationHasMessage(false)
        },
        onChunk: (context) => {
          context.editor.commands.aiGenerationSetIsLoading(true)
          context.editor.commands.aiGenerationHasMessage(true)
        },
        onSuccess: (context) => {
          const hasMessage = !!context.response
          context.editor.commands.aiGenerationSetIsLoading(false)
          context.editor.commands.aiGenerationHasMessage(hasMessage)
        },
      }),
    ],
  })

  // Content is now set directly in useEditor above
  // No need for delayed initialization - database content is source of truth

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!editor) {
    return <LoadingSpinner />
  }

  return (
    <div className="notion-like-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        {!hideHeader && <NotionEditorHeader />}
        <EditorContentArea />

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
}

/**
 * Full editor with all necessary providers, ready to use with just a room ID
 */
export function NotionEditor({
  room,
  placeholder = "Start writing...",
  initialContent,
  onSave,
  hideHeader = false,
}: NotionEditorProps) {
  return (
    <UserProvider>
      <AppProvider>
        <CollabProvider room={room}>
          <AiProvider>
            <NotionEditorContent
              placeholder={placeholder}
              initialContent={initialContent}
              onSave={onSave}
              hideHeader={hideHeader}
            />
          </AiProvider>
        </CollabProvider>
      </AppProvider>
    </UserProvider>
  )
}

/**
 * Internal component that handles the editor loading state
 */
export function NotionEditorContent({
  placeholder,
  initialContent,
  onSave,
  hideHeader = false,
}: {
  placeholder?: string
  initialContent?: string
  onSave?: (html: string) => void
  hideHeader?: boolean
}) {
  const { provider, ydoc } = useCollab()
  const { aiToken } = useAi()

  // Don't wait for collaboration - load immediately with database content
  // Collaboration is disabled for inline editors to prevent content duplication
  // AI token is optional - editor works without it
  return (
    <EditorProvider
      provider={provider}
      ydoc={ydoc}
      placeholder={placeholder}
      aiToken={aiToken}
      initialContent={initialContent}
      onSave={onSave}
      hideHeader={hideHeader}
    />
  )
}
