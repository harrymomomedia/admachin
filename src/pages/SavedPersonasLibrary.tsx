import { useState, useEffect } from 'react';
import {
    Search,
    Loader2,
    User,
    Calendar,
    Layers,
    ChevronDown,
    ChevronUp,
    Eye,
    FolderOpen,
    X
} from 'lucide-react';
import {
    getSavedPersonas,
    type SavedPersona,
    getProjects,
    type Project
} from '../lib/supabase-service';

export function SavedPersonasLibrary() {
    const [personas, setPersonas] = useState<SavedPersona[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('');
    const [sortField, setSortField] = useState<'created_at' | 'name' | 'project'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedPersona, setSelectedPersona] = useState<SavedPersona | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [personasData, projectsData] = await Promise.all([
                getSavedPersonas(),
                getProjects()
            ]);
            setPersonas(personasData);
            setProjects(projectsData);
        } catch (error) {
            console.error('Failed to load saved personas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredAndSortedPersonas = personas
        .filter(p => {
            const matchesSearch =
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.vertical.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.project?.name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesProject = !selectedProjectFilter || p.project_id === selectedProjectFilter;

            return matchesSearch && matchesProject;
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'created_at':
                    comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    break;
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'project':
                    comparison = (a.project?.name || '').localeCompare(b.project?.name || '');
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

    const SortHeader = ({ field, label }: { field: typeof sortField; label: string }) => (
        <button
            onClick={() => handleSort(field)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
        >
            {label}
            {sortField === field && (
                sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Saved Personas Library</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Browse and manage all AI-generated personas saved by your team
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {filteredAndSortedPersonas.length} persona{filteredAndSortedPersonas.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, role, vertical, or project..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <select
                            value={selectedProjectFilter}
                            onChange={(e) => setSelectedProjectFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p>Loading personas...</p>
                    </div>
                ) : filteredAndSortedPersonas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-xl border border-gray-200">
                        <FolderOpen className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium">No saved personas found</p>
                        <p className="text-sm mt-1">Personas you save from AI Copywriting will appear here</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">
                                        <SortHeader field="name" label="Persona" />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Vertical / Description
                                    </th>
                                    <th className="px-6 py-4">
                                        <SortHeader field="project" label="Project" />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Created By
                                    </th>
                                    <th className="px-6 py-4">
                                        <SortHeader field="created_at" label="Date" />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredAndSortedPersonas.map(persona => (
                                    <tr key={persona.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                                    {persona.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{persona.name}</p>
                                                    <p className="text-xs text-gray-500">{persona.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-sm text-gray-600 line-clamp-2" title={persona.vertical}>
                                                {persona.vertical}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                                                    {persona.project?.name || 'Unknown'}
                                                </div>
                                                {persona.subproject && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-5">
                                                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                                                        {persona.subproject.name}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <User className="w-4 h-4 text-gray-400" />
                                                {persona.profile?.fb_name || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                {new Date(persona.created_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedPersona(persona)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedPersona && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                    {selectedPersona.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {selectedPersona.name}, {selectedPersona.data.age}
                                    </h2>
                                    <p className="text-sm text-gray-600">{selectedPersona.role}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPersona(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {selectedPersona.data.tagline && (
                                <p className="text-blue-600 italic text-sm">"{selectedPersona.data.tagline}"</p>
                            )}

                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Background</h4>
                                <p className="text-sm text-gray-700">{selectedPersona.data.background}</p>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Situation</h4>
                                <p className="text-sm text-gray-700">{selectedPersona.data.current_situation}</p>
                            </div>

                            {selectedPersona.data.pain_points?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pain Points</h4>
                                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                                        {selectedPersona.data.pain_points.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedPersona.data.goals?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Goals</h4>
                                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                                        {selectedPersona.data.goals.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedPersona.data.motivations?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Motivations</h4>
                                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                                        {selectedPersona.data.motivations.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedPersona.data.objections?.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Potential Objections</h4>
                                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                                        {selectedPersona.data.objections.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Metadata</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Project:</span>
                                        <span className="ml-2 font-medium text-gray-900">{selectedPersona.project?.name || 'Unknown'}</span>
                                    </div>
                                    {selectedPersona.subproject && (
                                        <div>
                                            <span className="text-gray-500">Subproject:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedPersona.subproject.name}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-gray-500">Created by:</span>
                                        <span className="ml-2 font-medium text-gray-900">{selectedPersona.profile?.fb_name || 'Unknown'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Date:</span>
                                        <span className="ml-2 font-medium text-gray-900">
                                            {new Date(selectedPersona.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedPersona(null)}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
