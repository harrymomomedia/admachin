# BlockNote Editor - Troubleshooting & Configuration

BlockNote is a Notion-style block editor built on Prosemirror/Tiptap. We use `@blocknote/mantine` for the UI theme.

## Tailwind CSS Conflicts

Tailwind's preflight CSS resets default browser styles, which breaks BlockNote's expected styling. All fixes are in `src/components/blocknote-editor.scss`.

### 1. Margin on `<p>` elements (Toggle/Checkbox alignment)

- **Problem**: Tailwind adds `margin-top: 1.25rem` to all `<p>` elements
- **Impact**: BlockNote uses `<p class="bn-inline-content">` for text inside blocks. This margin pushes text below toggle arrows, checkboxes, and list bullets
- **Solution**:
  ```scss
  .bn-inline-content {
    margin: 0 !important;
  }
  ```

### 2. Code block text color

- **Problem**: BlockNote code blocks have dark background but inherit dark text color
- **Impact**: Black text on black background = illegible
- **Solution**:
  ```scss
  [data-content-type="codeBlock"] {
    pre, code {
      color: #fff !important;
    }
  }
  ```

### 3. Side menu alignment (+ button and drag handle)

- **Problem**: The + button and drag handle in BlockNote's side menu become vertically misaligned
- **Root Cause**: BlockNote has **hardcoded side menu heights** per block type that match its DEFAULT heading sizes:
  ```css
  .bn-side-menu { height: 30px }  /* paragraph */
  .bn-side-menu[data-block-type=heading][data-level="1"] { height: 78px }
  .bn-side-menu[data-block-type=heading][data-level="2"] { height: 54px }
  .bn-side-menu[data-block-type=heading][data-level="3"] { height: 37px }
  ```
- **Impact**: If you override heading font sizes (e.g., `--level: 1.875em` instead of `3em`), the block heights no longer match the side menu heights, causing misalignment
- **Solution**: Do NOT override BlockNote's heading sizes. Use the defaults:
  - H1: 3em (48px)
  - H2: 2em (32px)
  - H3: 1.3em (21px)
- **Alternative**: If you must use custom heading sizes, also override the side menu heights to match
- **Additional safety fix**:
  ```scss
  .bn-side-menu {
    display: flex !important;
    align-items: center !important;
    flex-direction: row !important;
    gap: 0 !important;
  }
  ```

### 4. Image caption spacing

- **Problem**: Tailwind adds margin to `<p>` elements inside image captions
- **Solution**:
  ```scss
  .bn-file-caption,
  .bn-image-block-content-wrapper p,
  [data-content-type="image"] p {
    margin: 0 !important;
  }
  ```

## Configuration

### Current Setup

- **Package**: `@blocknote/mantine` v0.45.0
- **Styles file**: `src/components/blocknote-editor.scss`
- **Component**: `src/components/BlockNoteEditor.tsx`

### BlockNoteView Props

```tsx
<BlockNoteView
  editor={editor}
  onChange={handleChange}
  theme={darkMode ? 'dark' : 'light'}
  formattingToolbar={!hideMenu}
  slashMenu={true}
  sideMenu={true}  // Enables + button and drag handle
/>
```

## Debugging Tips

1. **Inspect side menu**: Look for `.bn-side-menu` element and check its `height` attribute
2. **Check block type**: Side menu has `data-block-type` attribute (e.g., `heading`, `paragraph`)
3. **Compare heights**: Block's actual height vs side menu's hardcoded height

## References

- [BlockNote Docs](https://www.blocknotejs.org/docs)
- [BlockNote Side Menu](https://www.blocknotejs.org/docs/ui-components/side-menu)
- [GitHub Issue #2321 - Transform Container Bug](https://github.com/TypeCellOS/BlockNote/issues/2321)
- [Tailwind Preflight Docs](https://tailwindcss.com/docs/preflight)
