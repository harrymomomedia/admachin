// Type declarations for Editor.js plugins

declare module '@editorjs/header' {
    import { BlockTool, BlockToolConstructable } from '@editorjs/editorjs';
    const Header: BlockToolConstructable;
    export default Header;
}

declare module '@editorjs/list' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const List: BlockToolConstructable;
    export default List;
}

declare module '@editorjs/quote' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Quote: BlockToolConstructable;
    export default Quote;
}

declare module '@editorjs/code' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Code: BlockToolConstructable;
    export default Code;
}

declare module '@editorjs/checklist' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Checklist: BlockToolConstructable;
    export default Checklist;
}

declare module '@editorjs/delimiter' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Delimiter: BlockToolConstructable;
    export default Delimiter;
}

declare module '@editorjs/inline-code' {
    import { InlineToolConstructable } from '@editorjs/editorjs';
    const InlineCode: InlineToolConstructable;
    export default InlineCode;
}

declare module '@editorjs/marker' {
    import { InlineToolConstructable } from '@editorjs/editorjs';
    const Marker: InlineToolConstructable;
    export default Marker;
}

declare module '@editorjs/underline' {
    import { InlineToolConstructable } from '@editorjs/editorjs';
    const Underline: InlineToolConstructable;
    export default Underline;
}

declare module '@editorjs/table' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Table: BlockToolConstructable;
    export default Table;
}

declare module '@editorjs/simple-image' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const SimpleImage: BlockToolConstructable;
    export default SimpleImage;
}

declare module '@editorjs/warning' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Warning: BlockToolConstructable;
    export default Warning;
}

declare module '@editorjs/raw' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Raw: BlockToolConstructable;
    export default Raw;
}

declare module '@editorjs/embed' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Embed: BlockToolConstructable;
    export default Embed;
}

declare module '@editorjs/link' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const LinkTool: BlockToolConstructable;
    export default LinkTool;
}

declare module '@editorjs/nested-list' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const NestedList: BlockToolConstructable;
    export default NestedList;
}

declare module '@editorjs/attaches' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Attaches: BlockToolConstructable;
    export default Attaches;
}

declare module '@editorjs/paragraph' {
    import { BlockToolConstructable } from '@editorjs/editorjs';
    const Paragraph: BlockToolConstructable;
    export default Paragraph;
}
