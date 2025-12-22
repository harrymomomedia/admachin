import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Project } from '../../../lib/supabase-service';

interface AddSubprojectModalProps {
    isOpen: boolean;
    projects: Project[];
    onClose: () => void;
    onAdd: (projectId: string, name: string) => Promise<void>;
}

export function AddSubprojectModal({ isOpen, projects, onClose, onAdd }: AddSubprojectModalProps) {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [name, setName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedProjectId || !name.trim()) return;
        await onAdd(selectedProjectId, name);
        setSelectedProjectId('');
        setName('');
    };

    const handleClose = () => {
        setSelectedProjectId('');
        setName('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add New Subproject</h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project <span className="text-red-500">*</span></label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select a project...</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subproject Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Women's Prison"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedProjectId || !name.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        Add Subproject
                    </button>
                </div>
            </div>
        </div>
    );
}
