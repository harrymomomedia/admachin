import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, GripVertical } from 'lucide-react';
import { cn } from '../../../utils/cn';

const PRESET_COLORS = [
    { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', name: 'Red' },
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', name: 'Orange' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', name: 'Amber' },
    { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', name: 'Yellow' },
    { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200', name: 'Lime' },
    { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', name: 'Green' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', name: 'Emerald' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', name: 'Teal' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', name: 'Cyan' },
    { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', name: 'Sky' },
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', name: 'Blue' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', name: 'Indigo' },
    { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', name: 'Violet' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', name: 'Purple' },
    { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', name: 'Fuchsia' },
    { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', name: 'Pink' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', name: 'Rose' },
    { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', name: 'Gray' },
];

interface FieldEditorProps {
    columnKey: string;
    columnHeader: string;
    options: { label: string; value: string | number }[];
    colorMap: Record<string, string>;
    colorOnly?: boolean; // When true, only allow color changes (no add/remove/rename options)
    onSave: (updates: { options: { label: string; value: string | number }[]; colorMap: Record<string, string> }) => void;
    onClose: () => void;
}

export function FieldEditor({
    columnHeader,
    options: initialOptions,
    colorMap: initialColorMap,
    colorOnly = false,
    onSave,
    onClose
}: FieldEditorProps) {
    const [options, setOptions] = useState<{ label: string; value: string | number }[]>([...initialOptions]);
    const [colorMap, setColorMap] = useState<Record<string, string>>({ ...initialColorMap });
    const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close color picker on click outside
    useEffect(() => {
        if (!colorPickerOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setColorPickerOpen(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [colorPickerOpen]);

    const handleAddOption = () => {
        const newValue = `option_${Date.now()}`;
        setOptions([...options, { label: 'New option', value: newValue }]);
    };

    const handleRemoveOption = (index: number) => {
        const opt = options[index];
        setOptions(options.filter((_, i) => i !== index));
        // Also remove from colorMap
        const newColorMap = { ...colorMap };
        delete newColorMap[String(opt.value)];
        setColorMap(newColorMap);
    };

    const handleOptionLabelChange = (index: number, newLabel: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], label: newLabel };
        setOptions(newOptions);
    };

    const handleColorChange = (value: string, colorClass: string) => {
        setColorMap({ ...colorMap, [value]: colorClass });
        setColorPickerOpen(null);
    };

    const handleSave = () => {
        onSave({ options, colorMap });
        onClose();
    };

    const getColorClasses = (value: string) => {
        return colorMap[String(value)] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/30 z-[9998] flex items-center justify-center">
            <div
                ref={modalRef}
                className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[80vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Edit field</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Field Name */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Field name</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                            {columnHeader}
                        </div>
                    </div>

                    {/* Field Type */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Field type</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                            Single Select
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Options</label>
                        {colorOnly && (
                            <p className="text-[11px] text-gray-400 mb-2">Options are managed externally. You can only change colors.</p>
                        )}
                        <div className="space-y-1.5">
                            {options.map((opt, index) => (
                                <div key={String(opt.value)} className="flex items-center gap-2 group">
                                    {/* Drag Handle - hidden in colorOnly mode */}
                                    {!colorOnly && (
                                        <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab" />
                                    )}

                                    {/* Color Picker Button */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setColorPickerOpen(colorPickerOpen === String(opt.value) ? null : String(opt.value))}
                                            className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center transition-all hover:scale-110",
                                                getColorClasses(String(opt.value))
                                            )}
                                        />

                                        {/* Color Picker Dropdown */}
                                        {colorPickerOpen === String(opt.value) && (
                                            <div
                                                ref={colorPickerRef}
                                                className="absolute top-7 left-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-[280px]"
                                            >
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {PRESET_COLORS.map((color) => (
                                                        <button
                                                            key={color.name}
                                                            type="button"
                                                            onClick={() => handleColorChange(String(opt.value), `${color.bg} ${color.text} ${color.border}`)}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 text-center truncate",
                                                                color.bg,
                                                                color.text,
                                                                color.border
                                                            )}
                                                        >
                                                            {opt.label || 'Option'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Option Label - editable input or read-only text */}
                                    {colorOnly ? (
                                        <span className="flex-1 px-2 py-1.5 text-sm text-gray-700">
                                            {opt.label}
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={opt.label}
                                            onChange={(e) => handleOptionLabelChange(index, e.target.value)}
                                            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    )}

                                    {/* Delete Button - hidden in colorOnly mode */}
                                    {!colorOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveOption(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Option Button - hidden in colorOnly mode */}
                        {!colorOnly && (
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add option
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export { PRESET_COLORS };
