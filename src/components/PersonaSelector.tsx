
import { Check, User, Code, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '../utils/cn';
import type { Persona } from '../lib/supabase-service';

interface PersonaSelectorProps {
    personas: Persona[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    maxSelections?: number;
    onSave?: (persona: Persona) => void;
    onSaveSelected?: (personas: Persona[]) => void;
    onViewPrompts?: () => void;
    hasPrompts?: boolean;
    // Liked/disliked for iterative refinement
    likedIds?: Set<string>;
    dislikedIds?: Set<string>;
    onToggleLiked?: (id: string) => void;
    onToggleDisliked?: (id: string) => void;
}

export function PersonaSelector({
    personas,
    selectedIds,
    onSelectionChange,
    maxSelections,
    onSave,
    onSaveSelected,
    onViewPrompts,
    hasPrompts,
    likedIds,
    dislikedIds,
    onToggleLiked,
    onToggleDisliked
}: PersonaSelectorProps) {
    const toggleSelection = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id));
        } else {
            if (maxSelections && selectedIds.length >= maxSelections) return;
            onSelectionChange([...selectedIds, id]);
        }
    };

    const selectAll = () => {
        if (maxSelections) {
            onSelectionChange(personas.slice(0, maxSelections).map(p => p.id));
        } else {
            onSelectionChange(personas.map(p => p.id));
        }
    };

    const clearAll = () => onSelectionChange([]);

    const handleBulkSave = () => {
        if (onSaveSelected) {
            const selectedPersonas = personas.filter(p => selectedIds.includes(p.id));
            onSaveSelected(selectedPersonas);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">Select All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={clearAll} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">Clear</button>
                    {onSaveSelected && selectedIds.length > 0 && (
                        <>
                            <span className="text-gray-300">|</span>
                            <button onClick={handleBulkSave} className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 font-medium">
                                <div className="w-3 h-3 border border-current rounded-sm flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-current rounded-sm" />
                                </div>
                                Save Selected
                            </button>
                        </>
                    )}
                </div>
                <span className="text-[10px] text-blue-600 font-medium">{selectedIds.length} selected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {personas.map(persona => {
                    const isSelected = selectedIds.includes(persona.id);
                    const isLiked = likedIds?.has(persona.id);
                    const isDisliked = dislikedIds?.has(persona.id);
                    return (
                        <div
                            key={persona.id}
                            className={cn(
                                "relative rounded-lg border-2 p-3 cursor-pointer transition-all",
                                isSelected ? "border-blue-500 bg-blue-50/50" : "border-gray-200 bg-white hover:border-gray-300",
                                isLiked && "ring-2 ring-green-400 ring-offset-1",
                                isDisliked && "ring-2 ring-red-400 ring-offset-1"
                            )}
                            onClick={() => toggleSelection(persona.id)}
                        >
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            )}
                            <div className="pr-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                        <User className="w-3 h-3 text-white" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm">{persona.name}</h3>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">{persona.description}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                {/* Thumbs up/down for refinement feedback */}
                                {onToggleLiked && onToggleDisliked && (
                                    <div className="flex items-center gap-1 mr-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLiked(persona.id);
                                            }}
                                            className={cn(
                                                "p-1.5 rounded transition-colors",
                                                isLiked
                                                    ? "bg-green-100 text-green-600"
                                                    : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                                            )}
                                            title="More like this"
                                        >
                                            <ThumbsUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleDisliked(persona.id);
                                            }}
                                            className={cn(
                                                "p-1.5 rounded transition-colors",
                                                isDisliked
                                                    ? "bg-red-100 text-red-600"
                                                    : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                                            )}
                                            title="Less like this"
                                        >
                                            <ThumbsDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                {hasPrompts && onViewPrompts && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewPrompts();
                                        }}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="View Generation Prompts"
                                    >
                                        <Code className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onSave && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSave(persona);
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-green-600 transition-colors"
                                        title="Save to Library"
                                    >
                                        <div className="w-3 h-3 border border-current rounded-sm flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-current rounded-sm" />
                                        </div>
                                        Save
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

