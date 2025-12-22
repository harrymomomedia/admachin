import { useState } from 'react';
import { X, Check } from 'lucide-react';

interface AddProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (data: { name: string; description: string }) => Promise<void>;
}

export function AddProjectModal({ isOpen, onClose, onAdd }: AddProjectModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!name.trim()) return;
        await onAdd({ name, description });
        setName('');
        setDescription('');
    };

    const handleClose = () => {
        setName('');
        setDescription('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Add New Project</h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="My Project"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="Project description..."
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
                        disabled={!name.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        Add Project
                    </button>
                </div>
            </div>
        </div>
    );
}
