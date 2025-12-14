import { useState, useEffect } from 'react';
import { X, Search, Loader2, Download, Calendar, User, Briefcase, Layers } from 'lucide-react';
import { type SavedPersona, getSavedPersonas, type Persona } from '../lib/supabase-service';
import { cn } from '../utils/cn';

interface SavedPersonasModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadPersonas: (personas: Persona[]) => void;
}

export function SavedPersonasModal({ isOpen, onClose, onLoadPersonas }: SavedPersonasModalProps) {
    const [savedPersonas, setSavedPersonas] = useState<SavedPersona[]>([]);
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
            const data = await getSavedPersonas();
            setSavedPersonas(data);
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
        const selected = savedPersonas
            .filter(p => selectedIds.includes(p.id))
            .map(p => ({
                ...p.data, // The stored persona object
                id: crypto.randomUUID(), // New ID to avoid conflicts
                selected: false
            }));

        onLoadPersonas(selected);
        onClose();
    };

    const filteredPersonas = savedPersonas.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.vertical.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vertical / Description</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Context</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredPersonas.map(persona => (
                                    <tr
                                        key={persona.id}
                                        onClick={() => toggleSelection(persona.id)}
                                        className={cn(
                                            "hover:bg-blue-50/50 cursor-pointer transition-colors",
                                            selectedIds.includes(persona.id) ? "bg-blue-50" : "bg-white"
                                        )}
                                    >
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300"
                                                checked={selectedIds.includes(persona.id)}
                                                onChange={() => toggleSelection(persona.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{persona.name}</span>
                                                <span className="text-xs text-gray-500">{persona.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <div className="flex items-start gap-2">
                                                <Briefcase className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                                <span className="text-xs text-gray-600 line-clamp-2" title={persona.vertical}>
                                                    {persona.vertical}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                                                    <Layers className="w-3.5 h-3.5" />
                                                    {persona.project?.name || 'Unknown Project'}
                                                </div>
                                                {persona.subproject && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 ml-5">
                                                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                                                        {persona.subproject.name}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-900">
                                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                                    {persona.profile?.fb_name || 'Unknown User'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(persona.created_at).toLocaleDateString()}
                                                </div>
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
