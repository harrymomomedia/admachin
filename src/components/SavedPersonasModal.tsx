import { useState, useEffect } from 'react';
import { X, Search, Loader2, Download, Calendar, User } from 'lucide-react';
import { getAIPersonas, type AIPersona, type AIPrompts, type Persona } from '../lib/supabase-service';
import { cn } from '../utils/cn';

// Parsed persona from ai_personas table
interface ParsedAIPersona {
    id: string;
    content: Persona;
    prompts: AIPrompts | null;
    created_at: string;
}

interface SavedPersonasModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadPersonas: (personas: Persona[], prompts?: AIPrompts | null) => void;
}

export function SavedPersonasModal({ isOpen, onClose, onLoadPersonas }: SavedPersonasModalProps) {
    const [savedPersonas, setSavedPersonas] = useState<ParsedAIPersona[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadSavedPersonas();
            setSelectedIds([]);
        }
    }, [isOpen]);

    const loadSavedPersonas = async () => {
        try {
            setLoading(true);
            const data = await getAIPersonas();
            // Parse the JSON content field
            const parsed: ParsedAIPersona[] = data.map((item: AIPersona) => {
                try {
                    return {
                        id: item.id,
                        content: JSON.parse(item.content) as Persona,
                        prompts: item.prompts,
                        created_at: item.created_at,
                    };
                } catch {
                    return null;
                }
            }).filter((p): p is ParsedAIPersona => p !== null);
            setSavedPersonas(parsed);
        } catch (error) {
            console.error('Failed to load saved personas:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    const handleLoad = () => {
        const selectedItems = savedPersonas.filter(p => selectedIds.includes(p.id));

        const personas = selectedItems.map(p => ({
            ...p.content, // The stored persona object
            id: crypto.randomUUID(), // New ID to avoid conflicts
            selected: false
        }));

        // Find the first item that has prompts (if any)
        const promptsItem = selectedItems.find(p => p.prompts);

        onLoadPersonas(personas, promptsItem?.prompts);
        onClose();
    };

    const filteredPersonas = savedPersonas.filter(p => {
        const search = searchTerm.toLowerCase();
        const persona = p.content;
        return (
            (persona.name?.toLowerCase().includes(search) ?? false) ||
            (persona.description?.toLowerCase().includes(search) ?? false)
        );
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Saved Personas Library</h2>
                        <p className="text-sm text-gray-500 mt-1">Load previously saved personas into your current workspace</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search personas, verticals, or projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <p>Loading library...</p>
                        </div>
                    ) : filteredPersonas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <User className="w-12 h-12 mb-3 opacity-20" />
                            <p>No saved personas found</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300"
                                            checked={selectedIds.length === filteredPersonas.length && filteredPersonas.length > 0}
                                            onChange={() => {
                                                if (selectedIds.length === filteredPersonas.length) {
                                                    setSelectedIds([]);
                                                } else {
                                                    setSelectedIds(filteredPersonas.map(p => p.id));
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Persona</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredPersonas.map(item => (
                                    <tr
                                        key={item.id}
                                        onClick={() => toggleSelection(item.id)}
                                        className={cn(
                                            "hover:bg-blue-50/50 cursor-pointer transition-colors",
                                            selectedIds.includes(item.id) ? "bg-blue-50" : "bg-white"
                                        )}
                                    >
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                                    <User className="w-3 h-3 text-white" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{item.content.name || 'Unnamed'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-md">
                                            <span className="text-xs text-gray-600 line-clamp-2" title={item.content.description}>
                                                {item.content.description || 'No description'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleLoad}
                        disabled={selectedIds.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Load {selectedIds.length} Persona{selectedIds.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
