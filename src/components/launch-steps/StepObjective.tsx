import { Target, MousePointer2, Users, ShoppingBag } from "lucide-react";
import { cn } from "../../utils/cn";
import type { LaunchAdFormData } from "../../types/launch";

interface StepObjectiveProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

const objectives = [
    {
        id: "OUTCOME_AWARENESS",
        title: "Awareness",
        description: "Show your ads to people who are most likely to remember them.",
        icon: Target,
    },
    {
        id: "OUTCOME_TRAFFIC",
        title: "Traffic",
        description: "Send people to a destination, like your website, app or Facebook event.",
        icon: MousePointer2,
    },
    {
        id: "OUTCOME_LEADS",
        title: "Leads",
        description: "Collect leads for your business or brand.",
        icon: Users,
    },
    {
        id: "OUTCOME_SALES",
        title: "Sales",
        description: "Find people likely to purchase your product or service.",
        icon: ShoppingBag,
    },
];

export function StepObjective({ data, updateData }: StepObjectiveProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900">Choose a Campaign Objective</h2>
                <p className="text-gray-500">Select the goal that best fits your advertising needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {objectives.map((obj) => (
                    <div
                        key={obj.id}
                        onClick={() => updateData({ ...data, objective: obj.id })}
                        className={cn(
                            "p-6 border rounded-xl cursor-pointer transition-all shadow-sm",
                            data.objective === obj.id
                                ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                                : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                        )}
                    >
                        <div className={cn(
                            "p-3 rounded-lg w-fit mb-4 border",
                            data.objective === obj.id
                                ? "bg-white border-blue-200"
                                : "bg-gray-50 border-gray-100"
                        )}>
                            <obj.icon className={cn(
                                "h-6 w-6",
                                data.objective === obj.id ? "text-blue-600" : "text-gray-500"
                            )} />
                        </div>
                        <h3 className={cn(
                            "font-semibold mb-2",
                            data.objective === obj.id ? "text-blue-900" : "text-gray-900"
                        )}>{obj.title}</h3>
                        <p className={cn(
                            "text-sm",
                            data.objective === obj.id ? "text-blue-700" : "text-gray-500"
                        )}>{obj.description}</p>
                    </div>
                ))}
            </div>

            <div className="space-y-4 pt-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Campaign Name</label>
                    <input
                        type="text"
                        value={data.name || ""}
                        onChange={(e) => updateData({ ...data, name: e.target.value })}
                        placeholder="e.g. Summer Campaign 2025"
                        className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        required
                    />
                </div>
            </div>
        </div>
    );
}
