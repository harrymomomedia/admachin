import { Plus, Trash2 } from 'lucide-react';
import type { Project, Subproject } from '../../lib/supabase-service';

interface SubprojectsTabProps {
    subprojects: Subproject[];
    projects: Project[];
    isLoading: boolean;
    onAddClick: () => void;
    onDeleteClick: (subprojectId: string) => void;
}

export function SubprojectsTab({
    subprojects,
    projects,
    isLoading,
    onAddClick,
    onDeleteClick
}: SubprojectsTabProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Subprojects</h2>
                <button
                    onClick={onAddClick}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Subproject
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 font-medium text-gray-500">Subproject Name</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Project</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Created</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    Loading subprojects...
                                </td>
                            </tr>
                        ) : subprojects.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    No subprojects yet. Add your first subproject.
                                </td>
                            </tr>
                        ) : (
                            subprojects.map(sub => {
                                const project = projects.find(p => p.id === sub.project_id);
                                return (
                                    <tr key={sub.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{sub.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                {project?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(sub.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => onDeleteClick(sub.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete subproject"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
