import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Copy, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LongTextProps {
    value: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    expanded?: boolean;
    maxLines?: number;
}

export function LongText({
    value,
    onChange,
    placeholder = 'Enter text...',
    className,
    disabled = false,
    expanded = false,
    maxLines = 1
}: LongTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [copied, setCopied] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Sync editValue when value prop changes
    useEffect(() => {
        setEditValue(value);
    }, [value]);

    // Focus textarea when editing starts
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    // Close on click outside when editing
    useEffect(() => {
        if (!isEditing) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                modalRef.current && !modalRef.current.contains(e.target as Node)
            ) {
                handleSave();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing, editValue]);

    const handleSave = () => {
        if (onChange && editValue !== value) {
            onChange(editValue);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleCancel();
        } else if (e.key === 'Enter' && e.metaKey) {
            handleSave();
        }
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled && onChange) {
            setIsEditing(true);
        }
    };

    const getModalPosition = () => {
        if (!containerRef.current) return { top: 100, left: 100 };
        const rect = containerRef.current.getBoundingClientRect();
        const modalWidth = 500;
        const modalHeight = 300;

        // Center the modal on screen
        return {
            top: Math.max(50, (window.innerHeight - modalHeight) / 2),
            left: Math.max(50, (window.innerWidth - modalWidth) / 2)
        };
    };

    const position = getModalPosition();

    return (
        <>
            <div
                ref={containerRef}
                className={cn(
                    "group/longtext flex items-start gap-1 w-full cursor-pointer",
                    className
                )}
                onClick={() => !disabled && onChange && setIsEditing(true)}
            >
                <span
                    className={cn(
                        "flex-1 min-w-0 text-xs text-gray-700",
                        !expanded && maxLines === 1 && "line-clamp-1",
                        !expanded && maxLines === 2 && "line-clamp-2",
                        !expanded && maxLines === 3 && "line-clamp-3",
                        expanded && "whitespace-pre-wrap",
                        !value && "text-gray-400"
                    )}
                >
                    {value || placeholder}
                </span>

                {/* Action buttons - visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/longtext:opacity-100 transition-opacity flex-shrink-0">
                    {value && (
                        <button
                            onClick={handleCopy}
                            className={cn(
                                "p-1 rounded transition-colors",
                                copied
                                    ? "text-green-600 bg-green-50"
                                    : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            )}
                            title={copied ? "Copied!" : "Copy to clipboard"}
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                    )}
                    {onChange && !disabled && (
                        <button
                            onClick={handleExpand}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Expand"
                        >
                            <Maximize2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && createPortal(
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/30 z-[9998]"
                        onClick={handleCancel}
                    />

                    {/* Modal */}
                    <div
                        ref={modalRef}
                        className="fixed bg-white rounded-xl shadow-2xl z-[9999] flex flex-col overflow-hidden"
                        style={{
                            top: position.top,
                            left: position.left,
                            width: 500,
                            maxHeight: '80vh'
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">Edit Text</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">⌘+Enter to save</span>
                                <button
                                    onClick={handleCancel}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Textarea */}
                        <div className="flex-1 p-4">
                            <textarea
                                ref={textareaRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                className="w-full h-[200px] text-sm text-gray-700 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                            <span className="text-xs text-gray-400">
                                {editValue.length} characters
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

export default LongText;
