
import { useState } from 'react';
import { Check, Info, X, Target, AlertTriangle, Lightbulb, User } from 'lucide-react';
import { cn } from '../utils/cn';
import type { Persona } from '../lib/supabase-service';

interface PersonaSelectorProps {
    personas: Persona[];
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    maxSelections?: number;
    onSave?: (persona: Persona) => void;
    onSaveSelected?: (personas: Persona[]) => void;
}

export function PersonaSelector({
    personas,
    selectedIds,
    onSelectionChange,
    maxSelections,
    onSave,
    onSaveSelected
}: PersonaSelectorProps) {
    const [detailPersona, setDetailPersona] = useState<Persona | null>(null);

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
                                Save {selectedIds.length} Selected
                            </button>
                        </>
                    )}
                </div>
                <span className="text-[10px] text-blue-600 font-medium">{selectedIds.length} selected</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personas.map(persona => {
                    const isSelected = selectedIds.includes(persona.id);
                    return (
                        <div
                            key={persona.id}
                            className={cn(
                                "relative rounded-xl border-2 p-4 cursor-pointer transition-all",
                                isSelected ? "border-blue-500 bg-blue-50/50" : "border-gray-200 bg-white hover:border-gray-300"
                            )}
                            onClick={() => toggleSelection(persona.id)}
                        >
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <div className="pr-8 space-y-2">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">{persona.name}, {persona.age}, {persona.role}</h3>
                                    <p className="text-xs text-blue-600 italic mt-0.5">{persona.tagline}</p>
                                </div>

                                <p className="text-xs text-gray-700 leading-relaxed">{persona.current_situation}</p>

                                {persona.pain_points && persona.pain_points.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <AlertTriangle className="w-3 h-3 text-red-500" />
                                            <p className="text-[10px] font-semibold text-gray-500 uppercase">Pain Points</p>
                                        </div>
                                        <ul className="text-xs text-gray-700 space-y-0.5 list-disc list-inside">
                                            {persona.pain_points.slice(0, 3).map((point, idx) => (
                                                <li key={idx}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {persona.goals && persona.goals.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <Target className="w-3 h-3 text-green-500" />
                                            <p className="text-[10px] font-semibold text-gray-500 uppercase">Goals</p>
                                        </div>
                                        <ul className="text-xs text-gray-700 space-y-0.5 list-disc list-inside">
                                            {persona.goals.slice(0, 3).map((goal, idx) => (
                                                <li key={idx}>{goal}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {persona.objections && persona.objections.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1 mb-1">
                                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                                            <p className="text-[10px] font-semibold text-gray-500 uppercase">Potential Objections</p>
                                        </div>
                                        <ul className="text-xs text-gray-700 space-y-0.5 list-disc list-inside">
                                            {persona.objections.slice(0, 3).map((obj, idx) => (
                                                <li key={idx}>{obj}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDetailPersona(persona); }}
                                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                                >
                                    <Info className="w-3.5 h-3.5" />
                                    View full profile
                                </button>
                                {onSave && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSave(persona);
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
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

            {detailPersona && <PersonaDetailModal persona={detailPersona} onClose={() => setDetailPersona(null)} />}
        </div>
    );
}

function PersonaDetailModal({ persona, onClose }: { persona: Persona; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{persona.name}, {persona.age}</h2>
                            <p className="text-sm text-gray-600">{persona.role}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-blue-800 italic font-medium">"{persona.tagline}"</p>
                    </div>

                    <Section title="Background" icon={<User className="w-4 h-4" />}><p className="text-gray-700">{persona.background}</p></Section>
                    <Section title="Current Situation" icon={<Target className="w-4 h-4" />}><p className="text-gray-700">{persona.current_situation}</p></Section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Section title="Pain Points" icon={<AlertTriangle className="w-4 h-4 text-red-500" />}>
                            <ul className="space-y-2">{persona.pain_points?.map((point, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />{point}</li>)}</ul>
                        </Section>
                        <Section title="Goals" icon={<Target className="w-4 h-4 text-green-500" />}>
                            <ul className="space-y-2">{persona.goals?.map((goal, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />{goal}</li>)}</ul>
                        </Section>
                    </div>

                    <Section title="What Motivates Them" icon={<Lightbulb className="w-4 h-4 text-amber-500" />}>
                        <div className="flex flex-wrap gap-2">{persona.motivations?.map((m, i) => <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-sm">{m}</span>)}</div>
                    </Section>

                    {persona.objections?.length > 0 && (
                        <Section title="Potential Objections" icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}>
                            <ul className="space-y-2">{persona.objections.map((obj, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-700"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />{obj}</li>)}</ul>
                        </Section>
                    )}


                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button onClick={onClose} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">Close</button>
                </div>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return <div><div className="flex items-center gap-2 mb-3">{icon}<h3 className="font-semibold text-gray-900">{title}</h3></div>{children}</div>;
}
